// Server-only Resend sender via Lovable connector gateway.
// Do NOT import from client code. Load inside server handlers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "MM Club <geral@mmclub.pt>";
const APP_URL = "https://mmclub.pt";

export type EmailKind =
  | "welcome"
  | "credits_topup"
  | "new_lesson"
  | "weekly_summary"
  | "live_announcement"
  | "live_started"
  | "replay_ready"
  | "inactivity_nudge"
  | "upcoming_courses"
  | "community_post"
  | "short_published"
  | "short_reply";

type SendOpts = {
  to: string;
  subject: string;
  html: string;
  userId?: string | null;
  kind: EmailKind;
  ref?: string | null; // idempotency key
  replyTo?: string;
};

export async function sendEmail(opts: SendOpts): Promise<{
  sent: boolean;
  skipped?: boolean;
  id?: string | null;
  error?: string;
}> {
  const { to, subject, html, userId, kind, ref, replyTo } = opts;

  // Dedupe: same (user_id, kind, ref) is only ever sent once.
  if (userId && ref) {
    const { data: existing } = await supabaseAdmin
      .from("email_log")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", kind)
      .eq("ref", ref)
      .eq("status", "sent")
      .maybeSingle();
    if (existing) {
      return { sent: false, skipped: true };
    }
  }

  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    console.error("[email] missing gateway credentials");
    return { sent: false, error: "missing_credentials" };
  }

  const payload: Record<string, unknown> = {
    from: FROM,
    to: [to],
    subject,
    html,
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`[email] resend ${res.status}: ${body}`);
    await supabaseAdmin.from("email_log").insert({
      user_id: userId ?? null,
      recipient: to,
      kind,
      ref: ref ?? null,
      status: "error",
      error: `${res.status}: ${body}`.slice(0, 500),
    });
    return { sent: false, error: `${res.status}` };
  }

  let providerId: string | null = null;
  try {
    providerId = JSON.parse(body)?.id ?? null;
  } catch {}

  await supabaseAdmin.from("email_log").insert({
    user_id: userId ?? null,
    recipient: to,
    kind,
    ref: ref ?? null,
    provider_id: providerId,
    status: "sent",
  });

  return { sent: true, id: providerId };
}

// ---------- shared template layout ----------

function layout(previewText: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MM Club</title></head>
<body style="margin:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e5e5e5;">
<div style="display:none;overflow:hidden;height:0;max-height:0;opacity:0;">${escapeHtml(previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 40px 0;">
<div style="font-size:11px;letter-spacing:0.28em;color:#c9a961;text-transform:uppercase;font-weight:700;">MM · Club</div>
</td></tr>
<tr><td style="padding:24px 40px 32px;">${bodyHtml}</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #1f1f1f;font-size:12px;color:#666;text-align:center;line-height:1.6;">
MM Club · <a href="${APP_URL}" style="color:#c9a961;text-decoration:none;">mmclub.pt</a><br>
Recebeste este email porque tens conta no MM Club.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const btn = (label: string, href: string) =>
  `<a href="${href}" style="display:inline-block;background:#c9a961;color:#0a0a0a;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a>`;

// ---------- templates ----------

export const emailTemplates = {
  communityPost(opts: {
    name: string;
    authorName: string;
    body: string;
    imageUrl?: string | null;
    postId: string;
    categoryLabel?: string | null;
  }) {
    const safe = escapeHtml(opts.name);
    const author = escapeHtml(opts.authorName);
    const raw = opts.body.trim();
    const excerpt = escapeHtml(raw.length > 420 ? `${raw.slice(0, 420)}…` : raw);
    const image = opts.imageUrl
      ? opts.imageUrl.startsWith("http")
        ? opts.imageUrl
        : `${APP_URL}${opts.imageUrl}`
      : null;
    const heroImg = image
      ? `<div style="margin:0 -40px 24px;"><img src="${image}" alt="Publicação na comunidade" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"></div>`
      : "";
    const firstLine = raw.split("\n")[0] ?? "";
    const short = firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
    return {
      subject: `${opts.authorName} publicou na comunidade${short ? `: ${short}` : ""}`,
      html: layout(
        `${opts.authorName} publicou na comunidade do MM Club.`,
        `${heroImg}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Club · Comunidade${opts.categoryLabel ? ` · ${escapeHtml(opts.categoryLabel)}` : ""}</div>
         <h1 style="font-size:24px;color:#ffffff;margin:0 0 16px;font-weight:600;line-height:1.3;">${author} publicou na comunidade</h1>
         ${excerpt ? `<div style="background:#0a0a0a;border-left:3px solid #c9a961;padding:18px 22px;margin:0 0 24px;border-radius:8px;font-size:15px;line-height:1.7;color:#e5e5e5;white-space:pre-wrap;">${excerpt}</div>` : ""}
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 28px;">Olá ${safe}, entra na comunidade para responder e participar na conversa.</p>
         <p style="margin:0 0 8px;">${btn("Ver publicação →", `${APP_URL}/comunidade?post=${opts.postId}`)}</p>`,
      ),
    };
  },

  welcome(name: string, planLabel: string) {
    const safe = escapeHtml(name);
    const plan = escapeHtml(planLabel);
    return {
      subject: `Bem-vindo ao MM Club, ${safe}`,
      html: layout(
        `Ativaste o teu acesso ${planLabel}.`,
        `<h1 style="font-size:28px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.2;">Bem-vindo, ${safe}.</h1>
         <p style="font-size:16px;line-height:1.65;color:#d4d4d4;margin:0 0 20px;">Ativaste o teu acesso <strong style="color:#c9a961;">${plan}</strong>. Já tens acesso completo à Academia, MM Studio, MM Inteligente e à comunidade privada.</p>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 28px;">Sugestão para começar: entra em <em>Marca Milionária</em> — o método completo de posicionamento premium.</p>
         <p style="margin:0 0 8px;">${btn("Entrar no MM Club →", `${APP_URL}/dashboard`)}</p>`,
      ),
    };
  },

  creditsTopup(name: string, credits: number, packName: string) {
    const safe = escapeHtml(name);
    const pack = escapeHtml(packName);
    const formatted = credits.toLocaleString("pt-PT");
    return {
      subject: `+${formatted} créditos no MM Studio`,
      html: layout(
        `${formatted} créditos adicionados à tua conta.`,
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Studio</div>
         <h1 style="font-size:28px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.2;">+${formatted} créditos</h1>
         <p style="font-size:16px;line-height:1.65;color:#d4d4d4;margin:0 0 20px;">Olá ${safe}, o teu pack <strong style="color:#c9a961;">${pack}</strong> foi carregado. Já podes usar para gerar imagens, vídeos e criativos de alta conversão.</p>
         <p style="margin:0 0 8px;">${btn("Abrir MM Studio →", `${APP_URL}/ferramentas/studio`)}</p>`,
      ),
    };
  },

  newLesson(name: string, courseTitle: string, lessonTitle: string, courseId: string, lessonId: string) {
    const safe = escapeHtml(name);
    const course = escapeHtml(courseTitle);
    const lesson = escapeHtml(lessonTitle);
    return {
      subject: `Nova aula: ${lessonTitle}`,
      html: layout(
        `Acabou de sair conteúdo novo em ${courseTitle}.`,
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">${course}</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.25;">${lesson}</h1>
         <p style="font-size:16px;line-height:1.65;color:#d4d4d4;margin:0 0 24px;">${safe}, acabou de sair conteúdo novo no curso onde tens acesso. Assiste enquanto está fresco.</p>
         <p style="margin:0 0 8px;">${btn("Assistir agora →", `${APP_URL}/academia/${courseId}/${lessonId}`)}</p>`,
      ),
    };
  },

  weeklySummary(name: string, courseTitle: string, lessonTitle: string, summaryHtml: string, courseId: string, lessonId: string) {
    const safe = escapeHtml(name);
    const course = escapeHtml(courseTitle);
    const lesson = escapeHtml(lessonTitle);
    return {
      subject: `O teu resumo da semana — ${lessonTitle}`,
      html: layout(
        `Resumo semanal do que aprendeste em ${courseTitle}.`,
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Resumo semanal</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 8px;font-weight:600;line-height:1.25;">Olá ${safe}.</h1>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 20px;">Esta semana estás em <strong style="color:#fff;">${course}</strong> — <em style="color:#c9a961;font-style:normal;">${lesson}</em>. O essencial do que viste:</p>
         <div style="background:#0a0a0a;border-left:3px solid #c9a961;padding:20px 24px;margin:0 0 28px;border-radius:8px;font-size:15px;line-height:1.75;color:#e5e5e5;">${summaryHtml}</div>
         <p style="margin:0 0 8px;">${btn("Continuar a aula →", `${APP_URL}/academia/${courseId}/${lessonId}`)}</p>`,
      ),
    };
  },

  liveAnnouncement(opts: {
    name: string;
    title: string;
    description?: string | null;
    startsAt: string;
    coverUrl?: string | null;
    liveId: string;
    isScheduled: boolean;
  }) {
    const safe = escapeHtml(opts.name);
    const title = escapeHtml(opts.title);
    const desc = opts.description ? escapeHtml(opts.description) : "";
    const dateFmt = new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Lisbon",
    }).format(new Date(opts.startsAt));
    const cover = opts.coverUrl
      ? (opts.coverUrl.startsWith("http") ? opts.coverUrl : `${APP_URL}${opts.coverUrl}`)
      : null;
    const kicker = opts.isScheduled ? "Nova live agendada" : "Estamos AO VIVO";
    const eyebrow = opts.isScheduled ? "MM Club · Direto" : "MM Club · AO VIVO agora";
    const cta = opts.isScheduled ? "Ver detalhes da live →" : "Entrar na live →";
    const subject = opts.isScheduled
      ? `Nova live agendada: ${opts.title}`
      : `AO VIVO agora: ${opts.title}`;
    const heroImg = cover
      ? `<div style="margin:0 -40px 24px;"><img src="${cover}" alt="${title}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"></div>`
      : "";
    return {
      subject,
      html: layout(
        `${kicker}: ${opts.title} — ${dateFmt}`,
        `${heroImg}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(eyebrow)}</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.25;">${title}</h1>
         <p style="font-size:14px;line-height:1.6;color:#c9a961;margin:0 0 16px;font-weight:500;">${escapeHtml(dateFmt)} (Lisboa)</p>
         ${desc ? `<p style="font-size:15px;line-height:1.7;color:#d4d4d4;margin:0 0 20px;">${desc}</p>` : ""}
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 28px;">Olá ${safe}, ${opts.isScheduled ? "guarda a data. Vais receber o link direto do direto na comunidade e no dashboard." : "o direto começou. Entra agora para não perderes."}</p>
         <p style="margin:0 0 8px;">${btn(cta, `${APP_URL}/lives/${opts.liveId}`)}</p>`,
      ),
    };
  },

  replayReady(opts: {
    name: string;
    title: string;
    description?: string | null;
    startsAt: string;
    coverUrl?: string | null;
    liveId: string;
  }) {
    const safe = escapeHtml(opts.name);
    const title = escapeHtml(opts.title);
    const desc = opts.description ? escapeHtml(opts.description) : "";
    const dateFmt = new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "long",
      timeZone: "Europe/Lisbon",
    }).format(new Date(opts.startsAt));
    const cover = opts.coverUrl
      ? opts.coverUrl.startsWith("http")
        ? opts.coverUrl
        : `${APP_URL}${opts.coverUrl}`
      : null;
    const heroImg = cover
      ? `<div style="margin:0 -40px 24px;"><img src="${cover}" alt="${title}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"></div>`
      : "";
    return {
      subject: `Gravação disponível: ${opts.title}`,
      html: layout(
        `A gravação de ${opts.title} já está disponível.`,
        `${heroImg}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Club · Replay disponível</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.25;">${title}</h1>
         <p style="font-size:14px;line-height:1.6;color:#c9a961;margin:0 0 16px;font-weight:500;">Sessão de ${escapeHtml(dateFmt)}</p>
         ${desc ? `<p style="font-size:15px;line-height:1.7;color:#d4d4d4;margin:0 0 20px;">${desc}</p>` : ""}
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 28px;">Olá ${safe}, a gravação já terminou de processar e está pronta para ver quando quiseres.</p>
         <p style="margin:0 0 8px;">${btn("Ver gravação →", `${APP_URL}/lives/${opts.liveId}`)}</p>`,
      ),
    };
  },

  inactivityNudge(opts: {
    name: string;
    days: number;
    courseTitle?: string | null;
    lessonTitle?: string | null;
    courseId?: string | null;
    lessonId?: string | null;
  }) {
    const safe = escapeHtml(opts.name);
    const hasLesson = Boolean(opts.courseId && opts.lessonId && opts.lessonTitle);
    const lesson = escapeHtml(opts.lessonTitle ?? "");
    const course = escapeHtml(opts.courseTitle ?? "");
    const href = hasLesson
      ? `${APP_URL}/academia/${opts.courseId}/${opts.lessonId}`
      : `${APP_URL}/dashboard`;
    return {
      subject: hasLesson
        ? `Ficaste a meio de "${opts.lessonTitle}"`
        : `${opts.name}, o clube continua a andar`,
      html: layout(
        `Faltas há ${opts.days} dias. Retomar leva 10 minutos.`,
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Club</div>
         <h1 style="font-size:27px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.25;">${hasLesson ? `Retoma onde ficaste, ${safe}.` : `Voltamos ao trabalho, ${safe}?`}</h1>
         <p style="font-size:16px;line-height:1.65;color:#d4d4d4;margin:0 0 20px;">${hasLesson
           ? `Estavas em <strong style="color:#c9a961;">${lesson}</strong>${course ? ` (${course})` : ""} e já passaram ${opts.days} dias. Dez minutos hoje valem mais do que três horas dentro de um mês.`
           : `Já passaram ${opts.days} dias desde a tua última visita. Escolhe uma aula, aplica uma ideia e volta a ganhar ritmo.`}</p>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 28px;">Entretanto tens novas sessões ao vivo, publicações na comunidade e o MM Studio à espera.</p>
         <p style="margin:0 0 8px;">${btn(hasLesson ? "Continuar a aula →" : "Entrar no MM Club →", href)}</p>`,
      ),
    };
  },

  upcomingCourses(
    name: string,
    items: {
      title: string;
      tagline?: string;
      release: string;
      courseId: string;
      cover?: string | null;
    }[],
  ) {
    const safe = escapeHtml(name);
    const cards = items
      .map((c) => {
        const cover = c.cover
          ? c.cover.startsWith("http")
            ? c.cover
            : `${APP_URL}${c.cover}`
          : null;
        const img = cover
          ? `<tr><td style="padding:0;">
              <img src="${cover}" alt="${escapeHtml(c.title)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;border-radius:12px 12px 0 0;">
            </td></tr>`
          : "";
        return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;background:#161616;border:1px solid #232323;border-radius:12px;overflow:hidden;">
          ${img}
          <tr><td style="padding:16px 18px;">
            <div style="font-size:11px;color:#c9a961;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">${escapeHtml(c.release)}</div>
            <div style="font-size:17px;color:#ffffff;font-weight:600;line-height:1.3;">${escapeHtml(c.title)}</div>
            ${c.tagline ? `<div style="font-size:14px;color:#a3a3a3;line-height:1.55;margin-top:6px;">${escapeHtml(c.tagline)}</div>` : ""}
          </td></tr>
        </table>`;
      })
      .join("");
    return {
      subject:
        items.length === 1
          ? `A caminho: ${items[0].title}`
          : `${items.length} novos cursos a caminho do MM Club`,
      html: layout(
        "Novos cursos a caminho — já incluídos no teu acesso.",
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Academia</div>
         <h1 style="font-size:27px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.25;">Novos cursos a caminho, ${safe}.</h1>
         <p style="font-size:16px;line-height:1.65;color:#d4d4d4;margin:0 0 22px;">Estão a chegar novas formações à Academia — e já estão incluídas no teu acesso, sem custo adicional. Assim que abrirem, avisamos-te.</p>
         ${cards}
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:18px 0 26px;">Podes vê-los já na Academia, com contador para a data de lançamento.</p>
         <p style="margin:0 0 8px;">${btn("Ver na Academia →", `${APP_URL}/academia`)}</p>`,
      ),
    };
  },

  shortPublished(opts: {
    name: string;
    authorName: string;
    caption?: string | null;
    thumbnailUrl?: string | null;
    shortId: string;
  }) {
    const safe = escapeHtml(opts.name);
    const author = escapeHtml(opts.authorName);
    const raw = (opts.caption ?? "").trim();
    const excerpt = escapeHtml(raw.length > 300 ? `${raw.slice(0, 300)}…` : raw);
    const thumb = opts.thumbnailUrl?.startsWith("http")
      ? `<div style="margin:0 -40px 24px;"><img src="${opts.thumbnailUrl}" alt="MM Short" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></div>`
      : "";
    return {
      subject: `Novo MM Short${raw ? `: ${raw.slice(0, 60)}` : ` de ${opts.authorName}`}`,
      html: layout(
        `${opts.authorName} publicou um novo MM Short.`,
        `${thumb}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Shorts</div>
         <h1 style="font-size:24px;color:#ffffff;margin:0 0 16px;font-weight:600;line-height:1.3;">${author} publicou um novo Short</h1>
         ${excerpt ? `<div style="background:#0a0a0a;border-left:3px solid #c9a961;padding:18px 22px;margin:0 0 24px;border-radius:8px;font-size:15px;line-height:1.7;color:#e5e5e5;white-space:pre-wrap;">${excerpt}</div>` : ""}
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 28px;">Olá ${safe}, são poucos segundos — vê agora no MM Club.</p>
         <p style="margin:0 0 8px;">${btn("Ver o Short →", `${APP_URL}/shorts?s=${opts.shortId}`)}</p>`,
      ),
    };
  },

  shortReply(opts: {
    name: string;
    authorName: string;
    body: string;
    yourComment?: string | null;
    shortId: string;
  }) {
    const safe = escapeHtml(opts.name);
    const author = escapeHtml(opts.authorName);
    const raw = opts.body.trim();
    const reply = escapeHtml(raw.length > 300 ? `${raw.slice(0, 300)}…` : raw);
    const mine = (opts.yourComment ?? "").trim();
    const mineHtml = mine
      ? `<p style="font-size:13px;color:#666;margin:0 0 10px;">O teu comentário: “${escapeHtml(mine.length > 140 ? `${mine.slice(0, 140)}…` : mine)}”</p>`
      : "";
    return {
      subject: `${opts.authorName} respondeu ao teu comentário`,
      html: layout(
        `${opts.authorName} respondeu ao teu comentário num MM Short.`,
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Shorts</div>
         <h1 style="font-size:24px;color:#ffffff;margin:0 0 16px;font-weight:600;line-height:1.3;">${author} respondeu-te</h1>
         ${mineHtml}
         <div style="background:#0a0a0a;border-left:3px solid #c9a961;padding:18px 22px;margin:0 0 24px;border-radius:8px;font-size:15px;line-height:1.7;color:#e5e5e5;white-space:pre-wrap;">${reply}</div>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 28px;">Olá ${safe}, continua a conversa no MM Club.</p>
         <p style="margin:0 0 8px;">${btn("Responder →", `${APP_URL}/shorts?s=${opts.shortId}`)}</p>`,
      ),
    };
  },
};



// ---------- helpers ----------

export async function getUserEmailAndName(userId: string): Promise<{ email: string; name: string } | null> {
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) return null;
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const name =
    (p as { display_name?: string } | null)?.display_name ??
    (u?.user?.user_metadata?.display_name as string | undefined) ??
    email.split("@")[0] ??
    "amigo";
  return { email, name };
}

// Map Paddle price external_id to a human plan label for the welcome email.
export function planLabelFromPriceId(priceId: string | null | undefined): string {
  if (!priceId) return "MM Club";
  const map: Record<string, string> = {
    mm_club_monthly: "MM Club Elite",
    mm_club_annual: "MM Club Elite Anual",
    mm_club_elite_monthly: "MM Club Elite",
    mm_club_elite_annual: "MM Club Elite Anual",
    mm_club_vip: "MM Club VIP",
  };
  return map[priceId] ?? "MM Club";
}
