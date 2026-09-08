/**
 * "Novidades MM Club" — email de anúncio das novas funcionalidades.
 * Server-only. Envio de teste (1 destinatário) ou broadcast a todos os
 * membros com email confirmado que não desativaram os emails do clube.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email.server";
import { optedOutUserIds } from "@/lib/community-email.server";
// Os anexos (≈300 KB em base64) são carregados só quando o email é enviado —
// importá-los no topo punha esse peso em cada render do site (memória).

const APP_URL = "https://mmclub.pt";

export const NOVIDADES_REF = "novidades-2026-08";
export const NOVIDADES_SUBJECT = "Novidades MM Club: quizzes, certificados, MM Suporte e muito mais";

type Group = { title: string; items: [string, string][] };

export const NOVIDADES: Group[] = [
  {
    title: "Aprender a sério",
    items: [
      ["MM Quiz no fim de cada módulo", "Perguntas geradas a partir das aulas. Acertas 80% e desbloqueias o módulo seguinte — com resposta certa revelada quando erras."],
      ["Notas de aula com marcação de tempo", "Escreves a nota e voltas ao segundo exato do vídeo com um clique."],
      ["Aula seguinte automática", "Contador no fim da aula, progressão sequencial e sem saltos de aulas."],
      ["Rever sem perder progresso", "Podes repetir uma aula concluída do início: continua concluída e não altera as tuas horas."],
      ["Sequência de estudo (streak)", "Acompanha os teus dias seguidos de estudo direto no painel."],
    ],
  },
  {
    title: "Certificados",
    items: [
      ["Certificado em PDF com assinatura", "Logo oficial, assinatura do CEO e código público de verificação."],
      ["Página \"Certificados\"", "Vês o que já está pronto e quantas aulas faltam para o próximo."],
      ["Entrega automática por email", "Concluis o curso e o certificado chega à tua caixa de correio."],
    ],
  },
  {
    title: "Comunidade mais saudável",
    items: [
      ["Código do Clube", "Regras claras aceites por todos os membros, com sanções progressivas e recurso."],
      ["Agente de moderação com IA", "Analisa posts, comentários, shorts e chat antes de irem ao ar."],
      ["Notificações a sério", "Sino, push no telemóvel e email para likes, respostas e menções."],
      ["MM Shorts", "Vídeos verticais estilo reels, com likes, comentários e visualizações."],
      ["Ranking e distintivos", "Gamificação com pontuação de participação e Top 1–5 da comunidade."],
    ],
  },
  {
    title: "Ajuda e ferramentas",
    items: [
      ["MM Suporte", "Assistente disponível 24/7 no canto do ecrã, com escalamento para humano."],
      ["MM Studio", "Imagens, logótipos, criativos, thumbnails e vídeos com IA."],
      ["MM Product Lab", "Valida e pontua ideias de produto num quadro visual."],
      ["Links essenciais", "Todos os links importantes do clube num só lugar, com pesquisa."],
      ["MM Inteligence", "Assistente que conhece o catálogo e guarda as tuas conversas."],
    ],
  },
  {
    title: "Lives melhores",
    items: [
      ["Sala interativa e convidados", "Entrada de convidados por link, levantar a mão e partilha de ecrã."],
      ["Escolha de câmara e microfone", "Trocas de dispositivo a qualquer momento, com autoimagem espelhada."],
      ["Gravações com editor", "Cortamos o início e o fim; o replay retoma onde ficaste."],
      ["Avisos de direto", "Email e notificação quando entramos ao vivo ou mudamos o horário."],
    ],
  },
  {
    title: "Conta e subscrição",
    items: [
      ["Portal de subscrição", "Gere o plano, método de pagamento e faturas em /subscricao."],
      ["Faturas em PDF", "Recibo automático de cada pagamento."],
      ["App instalável (PWA)", "Instala o MM Club no telemóvel e recebe notificações."],
    ],
  },
];

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Imagem inline (cid) mostrada no topo de algumas secções. */
const GROUP_IMAGE: Record<string, string> = {
  "Aprender a sério": "aprender",
  "Ajuda e ferramentas": "studio",
};

/** Anexos: 4 imagens inline (cid) + o PDF das novidades. */
export async function novidadesAttachments() {
  const { NOVIDADES_ASSETS, NOVIDADES_PDF_B64 } = await import("@/lib/novidades-assets");
  const imgs = Object.entries(NOVIDADES_ASSETS).map(([key, a]) => ({
    filename: `${key}.${a.type === "image/png" ? "png" : "jpg"}`,
    content: a.b64,
    content_type: a.type,
    content_id: key,
  }));
  return [
    ...imgs,
    {
      filename: "MM-Club-Novidades.pdf",
      content: NOVIDADES_PDF_B64,
      content_type: "application/pdf",
    },
  ];
}

const imgBlock = (cid: string) =>
  `<img src="cid:${cid}" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;border:1px solid #1f1f1f;margin:0 0 18px;">`;

export function buildNovidadesHtml(name: string): string {
  const groups = NOVIDADES.map(
    (g) => `
<div style="margin:0 0 30px;">
  <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a961;font-weight:700;margin:0 0 14px;">${esc(g.title)}</div>
  ${GROUP_IMAGE[g.title] ? imgBlock(GROUP_IMAGE[g.title]!) : ""}
  ${g.items
    .map(
      ([t, d]) => `<div style="border-left:2px solid #c9a961;padding:2px 0 2px 14px;margin:0 0 16px;">
    <div style="font-size:15px;font-weight:600;color:#ffffff;line-height:1.4;">${esc(t)}</div>
    <div style="font-size:14px;color:#b5b5b5;line-height:1.6;margin-top:4px;">${esc(d)}</div>
  </div>`,
    )
    .join("")}
</div>`,
  ).join("");

  const preview = "Quizzes, certificados, MM Suporte, MM Shorts e muito mais dentro do clube.";

  return `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Novidades MM Club</title></head>
<body style="margin:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e5e5e5;">
<div style="display:none;overflow:hidden;height:0;max-height:0;opacity:0;">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 40px 0;">
<img src="cid:logo" width="120" alt="MM Club" style="display:block;width:120px;height:auto;border:0;">
</td></tr>
<tr><td style="padding:22px 40px 0;">
${imgBlock("hero")}
</td></tr>
<tr><td style="padding:24px 40px 8px;">
<h1 style="font-size:27px;line-height:1.25;font-weight:600;color:#ffffff;margin:0 0 14px;">O clube cresceu. Muito.</h1>
<p style="font-size:15px;line-height:1.65;color:#d4d4d4;margin:0 0 8px;">Olá ${esc(name)}, nas últimas semanas construímos dezenas de novidades dentro do MM Club — para aprenderes melhor, provares o que aprendeste e teres ajuda sempre à mão. Aqui está tudo:</p>
</td></tr>
<tr><td style="padding:16px 40px 8px;">${groups}</td></tr>
<tr><td style="padding:6px 40px 26px;">
<div style="background:#161616;border:1px solid #262626;border-radius:12px;padding:18px 20px;">
<div style="font-size:14px;font-weight:600;color:#ffffff;margin:0 0 6px;"><span style="color:#c9a961;">PDF</span> &nbsp;Guia das novidades em anexo</div>
<div style="font-size:13px;color:#b5b5b5;line-height:1.6;">Vai em anexo neste email — guarda ou imprime para consultar quando quiseres.</div>
</div>
</td></tr>
<tr><td style="padding:0 40px 34px;" align="center">
<a href="${APP_URL}/dashboard" style="display:inline-block;background:#c9a961;color:#0a0a0a;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">Entrar no MM Club</a>
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #1f1f1f;font-size:12px;color:#666;text-align:center;line-height:1.6;">
MM Club · <a href="${APP_URL}" style="color:#c9a961;text-decoration:none;">mmclub.pt</a><br>
Recebeste este email porque tens conta no MM Club.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** Envio de teste — sem dedupe, para aprovação interna. */
export async function sendNovidadesTest(to: string, name = "Victor") {
  const r = await sendEmail({
    to,
    subject: `[TESTE] ${NOVIDADES_SUBJECT}`,
    html: buildNovidadesHtml(name),
    kind: "product_update",
    attachments: await novidadesAttachments(),
  });
  return { sent: r.sent ? 1 : 0, error: r.error ?? null };
}

/** Broadcast a todos os membros confirmados que não desativaram emails. */
export async function sendNovidadesBroadcast() {
  const optedOut = await optedOutUserIds("community_posts");
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let page = 1;

  for (let i = 0; i < 40; i++) {
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !list?.users?.length) break;
    for (const u of list.users) {
      if (!u.email || !u.email_confirmed_at) {
        skipped += 1;
        continue;
      }
      if (optedOut.has(u.id)) {
        skipped += 1;
        continue;
      }
      const name =
        (u.user_metadata as { display_name?: string } | null)?.display_name ??
        u.email.split("@")[0] ??
        "amigo";
      try {
        const r = await sendEmail({
          to: u.email,
          subject: NOVIDADES_SUBJECT,
          html: buildNovidadesHtml(name),
          attachments: await novidadesAttachments(),
          userId: u.id,
          kind: "product_update",
          ref: NOVIDADES_REF,
        });
        if (r.sent) sent += 1;
        else skipped += 1;
      } catch (e) {
        failed += 1;
        console.error("[novidades-email] falhou", u.email, e);
      }
    }
    if (list.users.length < 100) break;
    page += 1;
  }

  console.log("[novidades-email]", { sent, skipped, failed });
  return { sent, skipped, failed };
}
