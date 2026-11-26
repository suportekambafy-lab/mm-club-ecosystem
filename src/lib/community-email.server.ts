// Server-only: fan out "X publicou na comunidade" emails, honouring each
// member's email preferences. Do NOT import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, emailTemplates } from "./email.server";

export type EmailPrefColumn =
  | "community_posts"
  | "community_replies"
  | "community_mentions"
  | "lives"
  | "courses"
  | "weekly_summary";

/** Users who opted OUT of a given email category. Missing row = opted in. */
export async function optedOutUserIds(column: EmailPrefColumn): Promise<Set<string>> {
  const out = new Set<string>();
  const { data, error } = await supabaseAdmin
    .from("email_preferences")
    .select(`user_id,${column}`)
    .eq(column, false);
  if (error) {
    console.error("[community-email] prefs read failed", error.message);
    return out;
  }
  for (const row of data ?? []) out.add((row as { user_id: string }).user_id);
  return out;
}

export async function sendCommunityPostEmails(postId: string) {
  const { data: post, error } = await supabaseAdmin
    .from("community_posts")
    .select("id,content,image_url,author_id,category_id,created_at")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!post) return { sent: 0, skipped: 0 };

  // Only announce fresh posts (protects against replays / edits).
  if (Date.now() - new Date(post.created_at).getTime() > 30 * 60 * 1000) {
    return { sent: 0, skipped: 0 };
  }

  // Membros silenciados/banidos nunca geram anúncios por email.
  const { data: sanctioned } = await supabaseAdmin.rpc("is_community_restricted", {
    _user_id: post.author_id,
  });
  if (sanctioned) return { sent: 0, skipped: 0 };

  const [{ data: author }, { data: category }] = await Promise.all([
    supabaseAdmin.from("profiles").select("display_name").eq("id", post.author_id).maybeSingle(),
    post.category_id
      ? supabaseAdmin.from("community_categories").select("name").eq("id", post.category_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  const authorName = author?.display_name ?? "Um membro";

  // Um só anúncio por post: o primeiro a reservar a linha ganha; edições,
  // varrimentos e pedidos paralelos nunca voltam a enviar.
  const claim = await supabaseAdmin
    .from("community_post_announcements")
    .insert({ post_id: post.id })
    .select("post_id")
    .maybeSingle();
  if (claim.error || !claim.data) return { sent: 0, skipped: 0 };

  const decision = await decideAnnouncement(post.content ?? "", category?.name ?? null);
  await supabaseAdmin
    .from("community_post_announcements")
    .update({ announce: decision.announce, reason: decision.reason })
    .eq("post_id", post.id);
  if (!decision.announce) return { sent: 0, skipped: 0 };
  // Só a equipa envia o texto e a imagem do post por email; para membros o
  // aviso é genérico (sem conteúdo escrito por eles) com link para o post.
  const [{ data: authorAdmin }, { data: authorMod }] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: post.author_id, _role: "admin" }),
    supabaseAdmin.rpc("has_role", { _user_id: post.author_id, _role: "moderator" }),
  ]);
  const authorIsStaff = authorAdmin === true || authorMod === true;
  const optedOut = await optedOutUserIds("community_posts");
  const { lapsedUserIds } = await import("@/lib/billing/lapsed-recipients.server");
  const lapsed = await lapsedUserIds();

  let sent = 0;
  let skipped = 0;
  let page = 1;
  for (let i = 0; i < 20; i++) {
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (listErr || !list?.users?.length) break;
    for (const u of list.users) {
      if (!u.email || !u.email_confirmed_at) continue;
      if (u.id === post.author_id) continue;
      if (optedOut.has(u.id)) {
        skipped += 1;
        continue;
      }
      const name =
        ((u.user_metadata as { display_name?: string } | null)?.display_name) ??
        u.email.split("@")[0] ??
        "amigo";
      const tpl = emailTemplates.communityPost({
        name,
        authorName,
        body: authorIsStaff ? (post.content ?? "") : "",
        imageUrl: authorIsStaff ? post.image_url : null,
        postId: post.id,
        categoryLabel: category?.name ?? null,
        locked: lapsed.has(u.id),
      });
      const res = await sendEmail({
        to: u.email,
        subject: tpl.subject,
        html: tpl.html,
        userId: u.id,
        kind: "community_post",
        ref: post.id,
      }).catch((e) => {
        console.error("[community-email] send failed", u.email, e);
        return { sent: false };
      });
      if (res.sent) sent += 1;
      else skipped += 1;
    }
    if (list.users.length < 100) break;
    page += 1;
  }

  return { sent, skipped };
}

/** A IA decide se o post interessa a todos os membros o suficiente para um email. */
export async function decideAnnouncement(text: string, category: string | null): Promise<{ announce: boolean; reason: string }> {
  const body = text.trim();
  if (body.length < 20) return { announce: false, reason: "Texto demasiado curto." };
  if (/reembols|cobran|cobrad|fatura|cancel|devolu|burla|golpe|reclama|n[aã]o funciona|suporte|ajuda/i.test(body)) {
    return { announce: false, reason: "Reclamação ou pedido de ajuda." };
  }
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { announce: false, reason: "IA indisponível." };
  const { generateText } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);
  try {
    const r = await generateText({
      model: gateway("openai/gpt-6-astra"),
      system: "És o editor da comunidade MM Club (empreendedores de e-commerce). Decide se um novo post merece um email para TODOS os membros. SIM só para conteúdo de valor para a maioria: aprendizagens, resultados/vitórias, dicas práticas, oportunidades, anúncios relevantes. NÃO para reclamações, queixas, pedidos de suporte ou ajuda pessoal, problemas técnicos, perguntas simples, conversa casual, saudações, autopromoção ou spam. Responde só JSON: {\"announce\": true|false, \"reason\": \"curto\"}",
      prompt: `Categoria: ${category ?? "Geral"}\nPost:\n${body.slice(0, 3000)}`,
    });
    const m = (r.text ?? "").match(/\{[\s\S]*\}/);
    const v = m ? (JSON.parse(m[0]) as { announce?: unknown; reason?: unknown }) : null;
    return { announce: v?.announce === true, reason: typeof v?.reason === "string" ? v.reason.slice(0, 300) : "" };
  } catch (e) {
    console.error("[community-email] announce decision failed", e);
    return { announce: false, reason: "Falha da IA." };
  }
}
