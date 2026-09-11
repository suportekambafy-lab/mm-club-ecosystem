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
  | "live_rescheduled"
  | "live_started"
  | "replay_ready"
  | "inactivity_nudge"
  | "streak_guard"
  | "wakeup_call"
  | "absence_ladder"
  | "upcoming_courses"
  | "legacy_teaser"
  | "legacy_winback"
  | "course_released"
  | "community_post"
  | "short_published"
  | "short_reply"
  | "product_update"
  | "winback";

type SendOpts = {
  to: string;
  subject: string;
  html: string;
  userId?: string | null;
  kind: EmailKind;
  ref?: string | null; // idempotency key
  replyTo?: string;
  /** Anexos Resend; usa content_id para imagens inline (cid:...). */
  attachments?: { filename: string; content: string; content_type?: string; content_id?: string }[];

};

export async function sendEmail(opts: SendOpts): Promise<{
  sent: boolean;
  skipped?: boolean;
  id?: string | null;
  error?: string;
}> {
  const { to, subject, html, userId, kind, ref, replyTo, attachments } = opts;

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
  if (attachments?.length) payload.attachments = attachments;

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
         <p style="font-size:16px;line-height:1.65;color:#d4d4d4;margin:0 0 20px;">Ativaste o teu acesso <strong style="color:#c9a961;">${plan}</strong>. Já tens acesso completo à Academia, MM Studio, MM Inteligence e à comunidade privada.</p>
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

  liveRescheduled(opts: {
    name: string;
    title: string;
    description?: string | null;
    oldStartsAt: string;
    startsAt: string;
    coverUrl?: string | null;
    liveId: string;
  }) {
    const safe = escapeHtml(opts.name);
    const title = escapeHtml(opts.title);
    const desc = opts.description ? escapeHtml(opts.description) : "";
    const fmt = (iso: string) =>
      new Intl.DateTimeFormat("pt-PT", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Europe/Lisbon",
      }).format(new Date(iso));
    const oldFmt = fmt(opts.oldStartsAt);
    const newFmt = fmt(opts.startsAt);
    const cover = opts.coverUrl
      ? opts.coverUrl.startsWith("http")
        ? opts.coverUrl
        : `${APP_URL}${opts.coverUrl}`
      : null;
    const heroImg = cover
      ? `<div style="margin:0 -40px 24px;"><img src="${cover}" alt="${title}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"></div>`
      : "";
    return {
      subject: `Novo horário: ${opts.title}`,
      html: layout(
        `A live ${opts.title} passou para ${newFmt}.`,
        `${heroImg}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Club · Horário alterado</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.25;">${title}</h1>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 20px;">Olá ${safe}, esta live mudou de horário. Actualiza a tua agenda.</p>
         <div style="background:#0a0a0a;border-left:3px solid #c9a961;padding:18px 22px;margin:0 0 24px;border-radius:8px;">
           <p style="margin:0 0 6px;font-size:14px;color:#737373;text-decoration:line-through;">${escapeHtml(oldFmt)}</p>
           <p style="margin:0;font-size:16px;color:#c9a961;font-weight:600;">${escapeHtml(newFmt)} (Lisboa)</p>
         </div>
         ${desc ? `<p style="font-size:15px;line-height:1.7;color:#d4d4d4;margin:0 0 20px;">${desc}</p>` : ""}
         <p style="margin:0 0 8px;">${btn("Ver detalhes da live →", `${APP_URL}/lives/${opts.liveId}`)}</p>`,
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

  /**
   * Guardião da ofensiva — enviado no fim do dia a quem tem sequência viva
   * e ainda não estudou hoje. Curto, positivo, uma única decisão.
   */
  streakGuard(opts: {
    name: string;
    streak: number;
    longest: number;
    courseTitle?: string | null;
    lessonTitle?: string | null;
    courseId?: string | null;
    lessonId?: string | null;
  }) {
    const safe = escapeHtml(opts.name.split(" ")[0] ?? opts.name);
    const hasLesson = Boolean(opts.courseId && opts.lessonId && opts.lessonTitle);
    const lesson = escapeHtml(opts.lessonTitle ?? "");
    const course = escapeHtml(opts.courseTitle ?? "");
    const href = hasLesson
      ? `${APP_URL}/academia/${opts.courseId}/${opts.lessonId}`
      : `${APP_URL}/academia`;
    const record = opts.streak >= opts.longest && opts.streak > 1;
    return {
      subject: `🔥 ${opts.streak} dias seguidos — não perças isso hoje, ${safe}`,
      html: layout(
        `A tua ofensiva de ${opts.streak} dias termina à meia-noite. 10 minutos resolvem.`,
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Club · Ofensiva</div>
         <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#0a0a0a;border:1px solid #2a2116;border-radius:14px;">
           <tr>
             <td style="padding:20px 26px;text-align:center;">
               <div style="font-size:38px;line-height:1;">🔥</div>
               <div style="font-size:40px;color:#c9a961;font-weight:700;line-height:1.1;margin-top:6px;">${opts.streak}</div>
               <div style="font-size:12px;color:#8a8a8a;letter-spacing:0.16em;text-transform:uppercase;margin-top:6px;">dias seguidos</div>
             </td>
           </tr>
         </table>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.28;">Ainda não estudaste hoje, ${safe}.</h1>
         <p style="font-size:16px;line-height:1.65;color:#d4d4d4;margin:0 0 18px;">${
           record
             ? `Estás no teu melhor recorde de sempre. Seria pena deixá-lo cair por causa de uma noite.`
             : `A tua sequência de ${opts.streak} dias termina à meia-noite. O teu recorde é ${opts.longest} dias.`
         }</p>
         ${
           hasLesson
             ? `<p style="font-size:15px;line-height:1.7;color:#a3a3a3;margin:0 0 26px;">Continua em <strong style="color:#c9a961;">${lesson}</strong>${course ? ` · ${course}` : ""}. Dez minutos contam como dia feito.</p>`
             : `<p style="font-size:15px;line-height:1.7;color:#a3a3a3;margin:0 0 26px;">Abre uma aula qualquer. Dez minutos contam como dia feito.</p>`
         }
         <p style="margin:0 0 8px;">${btn(hasLesson ? "Manter a ofensiva →" : "Estudar 10 minutos →", href)}</p>`,
      ),
    };
  },

  /**
   * Chamada de atenção — ausências longas. Direto, pessoal, sem culpa:
   * lembra a razão pela qual a pessoa entrou e devolve o próximo passo.
   */
  wakeUpCall(opts: {
    name: string;
    days: number;
    courseTitle?: string | null;
    lessonTitle?: string | null;
    courseId?: string | null;
    lessonId?: string | null;
  }) {
    const safe = escapeHtml(opts.name.split(" ")[0] ?? opts.name);
    const hasLesson = Boolean(opts.courseId && opts.lessonId && opts.lessonTitle);
    const lesson = escapeHtml(opts.lessonTitle ?? "");
    const course = escapeHtml(opts.courseTitle ?? "");
    const href = hasLesson
      ? `${APP_URL}/academia/${opts.courseId}/${opts.lessonId}`
      : `${APP_URL}/academia`;
    return {
      subject: `${safe}, já passaram ${opts.days} dias. Eu vou ser honesto contigo.`,
      html: layout(
        `Há ${opts.days} dias que não apareces. A liberdade que vieste buscar continua à espera.`,
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:10px;">MM Club · Sem filtros</div>
         <h1 style="font-size:28px;color:#ffffff;margin:0 0 16px;font-weight:700;line-height:1.2;">${safe}, vamos falar a sério.</h1>
         <p style="font-size:17px;line-height:1.7;color:#e5e5e5;margin:0 0 20px;">Há ${opts.days} dias que não entras. Não te vou enfeitar a verdade: a vida não te castigou por isso. Simplesmente não aconteceu <em style="color:#c9a961;font-style:normal;">nada</em>. E é exatamente esse o problema.</p>
         <div style="background:#0a0a0a;border-left:3px solid #c9a961;padding:22px 26px;margin:0 0 24px;border-radius:8px;">
           <p style="font-size:17px;line-height:1.75;color:#d4d4d4;margin:0 0 12px;">Lembras-te da razão pela qual entraste? Não foi por um curso. Foi por quereres deixar de depender de alguém para viver. Foi por quereres acordar e saber que o teu dia te pertence.</p>
           <p style="font-size:17px;line-height:1.75;color:#d4d4d4;margin:0;">Essa razão não desapareceu. <strong style="color:#c9a961;">Tu é que te ausentaste dela.</strong></p>
         </div>
         <p style="font-size:16px;line-height:1.75;color:#d4d4d4;margin:0 0 18px;">Cada dia que não apareces é uma decisão. Não é o universo a trabalhar contra ti — é o hábito a ganhar a partida. E o hábito é silencioso: hoje faltas, amanhã também parece fácil, e daqui a um mês nem te lembras por que começaste.</p>
         <p style="font-size:16px;line-height:1.75;color:#d4d4d4;margin:0 0 22px;">A boa notícia? O clube não te fechou a porta. As aulas continuam lá. A comunidade continua a crescer. A tua conta continua aberta. Tudo o que investiste continua à tua espera — só tens de <strong style="color:#c9a961;">decidir aparecer</strong>.</p>
         ${
           hasLesson
             ? `<p style="font-size:15px;line-height:1.7;color:#a3a3a3;margin:0 0 10px;">Ficaste em <strong style="color:#c9a961;">${lesson}</strong>${course ? ` · ${course}` : ""}. Não voltas do zero — voltas de onde paraste.</p>`
             : `<p style="font-size:15px;line-height:1.7;color:#a3a3a3;margin:0 0 10px;">Não precisas de plano perfeito. Precisas de 15 minutos e uma aula.</p>`
         }
         <p style="font-size:15px;line-height:1.7;color:#a3a3a3;margin:0 0 26px;">Quinze minutos hoje. Depois, se quiseres parar, paras — mas para por escolha tua, não porque o hábito decidiu por ti.</p>
         <p style="margin:0 0 20px;">${btn(hasLesson ? "Voltar agora →" : "Retomar o meu lugar →", href)}</p>
         <p style="font-size:14px;line-height:1.7;color:#6b6b6b;margin:0;">Acredito em ti, mesmo quando tu não.<br>— Victor Muabi, MM Club</p>`,
      ),
    };
  },

  /**
   * Escada de ausência — 5, 14, 30, 60 e 90 dias sem entrar.
   * Cada patamar é mais forte que o anterior; o de 90 dias fecha o ciclo
   * ("ok, tu escolheste isto") sem fechar a porta.
   */
  absenceLadder(opts: {
    name: string;
    days: number;
    stage: 5 | 14 | 30 | 60 | 90;
    courseTitle?: string | null;
    lessonTitle?: string | null;
    courseId?: string | null;
    lessonId?: string | null;
  }) {
    const safe = escapeHtml(opts.name.split(" ")[0] ?? opts.name);
    const hasLesson = Boolean(opts.courseId && opts.lessonId && opts.lessonTitle);
    const lesson = escapeHtml(opts.lessonTitle ?? "");
    const course = escapeHtml(opts.courseTitle ?? "");
    const href = hasLesson
      ? `${APP_URL}/academia/${opts.courseId}/${opts.lessonId}`
      : `${APP_URL}/academia`;
    const d = opts.days;

    const eyebrow = (t: string) =>
      `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:10px;">MM Club · ${t}</div>`;
    const h1 = (t: string) =>
      `<h1 style="font-size:28px;color:#ffffff;margin:0 0 16px;font-weight:700;line-height:1.22;">${t}</h1>`;
    const p = (t: string, color = "#d4d4d4", size = 16) =>
      `<p style="font-size:${size}px;line-height:1.75;color:${color};margin:0 0 18px;">${t}</p>`;
    const quote = (t: string) =>
      `<div style="background:#0a0a0a;border-left:3px solid #c9a961;padding:22px 26px;margin:0 0 24px;border-radius:8px;">${t}</div>`;
    const counter = (label: string) =>
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#0a0a0a;border:1px solid #2a2116;border-radius:14px;">
         <tr><td style="padding:20px 30px;text-align:center;">
           <div style="font-size:42px;color:#c9a961;font-weight:700;line-height:1.05;">${d}</div>
           <div style="font-size:12px;color:#8a8a8a;letter-spacing:0.16em;text-transform:uppercase;margin-top:6px;">${label}</div>
         </td></tr>
       </table>`;
    const resume = hasLesson
      ? p(
          `Ficaste em <strong style="color:#c9a961;">${lesson}</strong>${course ? ` · ${course}` : ""}. Não voltas do zero — voltas de onde paraste.`,
          "#a3a3a3",
          15,
        )
      : p("Não precisas de plano perfeito. Precisas de 15 minutos e uma aula.", "#a3a3a3", 15);
    const sign = (line: string) =>
      `<p style="font-size:14px;line-height:1.7;color:#6b6b6b;margin:0;">${line}<br>— Victor Muabi, MM Club</p>`;

    if (opts.stage === 5) {
      return {
        subject: `${safe}, 5 dias fora. Ainda é fácil voltar.`,
        html: layout(
          `Cinco dias sem estudar. Hoje resolve-se em 10 minutos.`,
          eyebrow("Ritmo") +
            counter("dias sem entrar") +
            h1(`Cinco dias, ${safe}.`) +
            p(
              `Não é grave — mas é assim que começa. Primeiro é uma semana ocupada, depois é um mês, e a seguir já não te lembras do que vieste buscar aqui.`,
            ) +
            p(
              `O ritmo é a única coisa que separa quem termina de quem desiste. E o ritmo recupera-se hoje, não amanhã.`,
            ) +
            resume +
            `<p style="margin:0 0 20px;">${btn("Estudar 10 minutos →", href)}</p>` +
            sign("Vai lá. Dez minutos."),
        ),
      };
    }

    if (opts.stage === 14) {
      return {
        subject: `${safe}, duas semanas. Isto já não é falta de tempo.`,
        html: layout(
          `14 dias fora. Já não é agenda — é prioridade.`,
          eyebrow("Sem rodeios") +
            counter("dias sem entrar") +
            h1(`Duas semanas, ${safe}.`) +
            p(
              `Vou ser directo: catorze dias já não são falta de tempo. Encontraste tempo para tudo o resto. Isto simplesmente deixou de estar na lista.`,
            ) +
            quote(
              p(
                `E o problema não é o MM Club. O problema é que a versão de ti que se inscreveu aqui queria algo — e essa versão está a ser ignorada há duas semanas.`,
                "#d4d4d4",
                17,
              ).replace("margin:0 0 18px", "margin:0"),
            ) +
            p(
              `Continuas a pagar por isto. Continuas a ter acesso a tudo. A única coisa que falta é aparecer.`,
            ) +
            resume +
            `<p style="margin:0 0 20px;">${btn("Retomar agora →", href)}</p>` +
            sign("Estou à espera de te ver dentro."),
        ),
      };
    }

    if (opts.stage === 30) {
      return {
        subject: `${safe}, um mês inteiro. E o que mudou na tua vida?`,
        html: layout(
          `30 dias. Nada mudou — e é isso que devia incomodar-te.`,
          eyebrow("Um mês") +
            counter("dias sem entrar") +
            h1(`Um mês, ${safe}. Vamos olhar para isto de frente.`) +
            p(
              `Trinta dias passaram. Pergunta honesta: o que mudou na tua vida neste mês? Se a resposta for "nada", já tens a informação mais importante do ano.`,
            ) +
            quote(
              `<p style="font-size:17px;line-height:1.75;color:#d4d4d4;margin:0 0 12px;">Ninguém acorda um dia e desiste. Desiste-se assim: um dia de cada vez, sempre com uma boa desculpa.</p>
               <p style="font-size:17px;line-height:1.75;color:#d4d4d4;margin:0;"><strong style="color:#c9a961;">Um mês de boas desculpas é um mês perdido.</strong></p>`,
            ) +
            p(
              `Não te escrevo para te fazer sentir mal. Escrevo porque já vi isto acontecer a demasiada gente boa — pessoas com mais talento do que disciplina, que ficaram exactamente onde estavam.`,
            ) +
            p(`Tu ainda tens a porta aberta. Hoje. Usa-a.`) +
            resume +
            `<p style="margin:0 0 20px;">${btn("Voltar ao trabalho →", href)}</p>` +
            sign("Ainda dá tempo de virar este mês."),
        ),
      };
    }

    if (opts.stage === 60) {
      return {
        subject: `${safe}, 60 dias. Isto já é uma escolha.`,
        html: layout(
          `Dois meses fora. Não é distração — é uma decisão silenciosa.`,
          eyebrow("Dois meses") +
            counter("dias sem entrar") +
            h1(`Dois meses, ${safe}. Já não posso chamar isto distração.`) +
            p(
              `Sessenta dias é tempo suficiente para mudar de vida. Havia gente que entrou contigo e que hoje já está a fazer coisas que tu ainda dizes que vais fazer.`,
            ) +
            quote(
              `<p style="font-size:17px;line-height:1.75;color:#d4d4d4;margin:0 0 12px;">A diferença entre essas pessoas e ti não é inteligência. Não é sorte. Não é dinheiro.</p>
               <p style="font-size:17px;line-height:1.75;color:#d4d4d4;margin:0;"><strong style="color:#c9a961;">É que elas apareceram e tu não.</strong></p>`,
            ) +
            p(
              `Cada dia que não entras estás a votar numa versão tua: a que fica igual. E o voto está a ganhar por sessenta a zero.`,
            ) +
            p(
              `Não te vou pedir motivação. Motivação não vem antes — vem depois de começares. Precisas de uma aula. Uma só.`,
            ) +
            resume +
            `<p style="margin:0 0 20px;">${btn("Uma aula. Agora. →", href)}</p>` +
            sign("Ainda acredito que voltas."),
        ),
      };
    }

    return {
      subject: `${safe}, 90 dias. Ok — tu escolheste isto.`,
      html: layout(
        `Três meses. Esta é a última vez que te escrevo assim.`,
        eyebrow("Última carta") +
          counter("dias sem entrar") +
          h1(`Ok, ${safe}. Tu escolheste isto.`) +
          p(
            `Noventa dias. Três meses. Não te vou perguntar outra vez se está tudo bem, nem inventar que foi falta de tempo. A esta altura já é claro: <strong style="color:#c9a961;">tu decidiste não aparecer</strong>. Todos os dias. Noventa vezes.`,
            "#e5e5e5",
            17,
          ) +
          quote(
            `<p style="font-size:17px;line-height:1.75;color:#d4d4d4;margin:0 0 12px;">E está bem. É a tua vida, é a tua escolha, e eu respeito-a. Mas alguém tinha de te dizer em voz alta o que aconteceu aqui: tu tinhas tudo em mãos — aulas, comunidade, ferramentas, acesso directo — e escolheste ficar exactamente onde estavas.</p>
             <p style="font-size:17px;line-height:1.75;color:#d4d4d4;margin:0;">Daqui a um ano, isto não vai doer por causa do que perdeste. Vai doer por causa de quem podias ter sido.</p>`,
          ) +
          p(
            `Não é castigo. Não é chantagem. É a verdade sem embalagem: ninguém vem salvar-te disto. Nem eu, nem o clube, nem o próximo curso que compras. Só tu.`,
          ) +
          p(
            `A porta continua aberta — não porque mereças ou não, mas porque eu prefiro deixá-la aberta. Se um dia decidires que a tua vida vale 15 minutos por dia, sabes exactamente onde estamos.`,
          ) +
          resume +
          `<p style="margin:0 0 20px;">${btn("Mudar isto hoje →", href)}</p>` +
          sign("A escolha sempre foi tua. Espero que mudes de ideias."),
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

  legacyTeaser(
    name: string,
    course: { courseId: string; title: string; release: string; cover?: string | null },
  ) {
    const safe = escapeHtml(name);
    const cover = course.cover
      ? course.cover.startsWith("http")
        ? course.cover
        : `${APP_URL}${course.cover}`
      : null;
    const hero = cover
      ? `<div style="margin:0 -40px 24px;"><img src="${cover}" alt="${escapeHtml(course.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"></div>`
      : "";
    const paragraphs = [
      "Foram dias e noites de trabalho para finalmente trazer o Marca Milionária Legacy. \u{1F525}",
      "E agora, você vai poder colocar as mãos nele em primeira mão. O contador já está ativo. Tic. Tac. \u{23F3}",
      "O Legacy é muito mais do que um simples curso. É um passo a passo estruturado, validado e testado por vários dos meus alunos, com resultados reais. É o tipo de conhecimento e acompanhamento que, muitas vezes, é vendido em mentorias que custam 5 mil, 10 mil euros ou até mais.",
      "Eu coloquei dentro do Legacy aquilo que considero essencial para quem realmente quer sair do lugar e construir resultados.",
      "Mas existe uma coisa que eu não consigo fazer por você: executar.",
      "O que vou precisar de você? Empenho. Disciplina. Consistência.",
      "Eu entrego o caminho. O resultado final depende de você.",
      "O contador já começou. Tic. Tac. \u{23F3}",
    ]
      .map(
        (t) =>
          `<p style="font-size:16px;line-height:1.7;color:#d4d4d4;margin:0 0 16px;">${escapeHtml(t)}</p>`,
      )
      .join("");
    return {
      subject: "Em breve: Marca Milionária Legacy \u{23F3}",
      html: layout(
        "O Marca Milionária Legacy está a chegar. O contador já está ativo.",
        `${hero}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Academia · Em breve</div>
         <h1 style="font-size:28px;color:#ffffff;margin:0 0 18px;font-weight:600;line-height:1.25;">${escapeHtml(course.title)}</h1>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 22px;">Olá ${safe},</p>
         ${paragraphs}
         <div style="background:#161616;border:1px solid #232323;border-radius:12px;padding:16px 18px;margin:6px 0 26px;">
           <div style="font-size:11px;color:#c9a961;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Lançamento</div>
           <div style="font-size:18px;color:#ffffff;font-weight:600;">${escapeHtml(course.release)}</div>
         </div>
         <p style="margin:0 0 8px;">${btn("Ver o contador →", `${APP_URL}/academia/${course.courseId}`)}</p>`,
      ),
    };
  },

  courseReleased(
    name: string,
    course: {
      courseId: string;
      title: string;
      tagline?: string;
      cover?: string | null;
    },
  ) {
    const safe = escapeHtml(name);
    const cover = course.cover
      ? course.cover.startsWith("http")
        ? course.cover
        : `${APP_URL}${course.cover}`
      : null;
    const hero = cover
      ? `<div style="margin:0 -40px 24px;"><img src="${cover}" alt="${escapeHtml(course.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></div>`
      : "";
    return {
      subject: `Já está disponível: ${course.title}`,
      html: layout(
        `${course.title} acabou de abrir na Academia.`,
        `${hero}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Academia</div>
         <h1 style="font-size:27px;color:#ffffff;margin:0 0 12px;font-weight:600;line-height:1.25;">Já está disponível, ${safe}.</h1>
         <p style="font-size:16px;line-height:1.65;color:#d4d4d4;margin:0 0 6px;"><strong style="color:#c9a961;">${escapeHtml(course.title)}</strong> acabou de abrir e já está incluído no teu acesso.</p>
         ${course.tagline ? `<p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 22px;">${escapeHtml(course.tagline)}</p>` : ""}
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 28px;">Começa pela primeira aula hoje — o momento certo é agora.</p>
         <p style="margin:0 0 8px;">${btn("Começar o curso →", `${APP_URL}/academia/${course.courseId}`)}</p>`,
      ),
    };
  },

  legacyWinback(
    name: string,
    course: { courseId: string; title: string; cover?: string | null },
  ) {
    const safe = escapeHtml(name);
    const cover = course.cover
      ? course.cover.startsWith("http")
        ? course.cover
        : `${APP_URL}${course.cover}`
      : null;
    const hero = cover
      ? `<div style="margin:0 -40px 24px;"><img src="${cover}" alt="${escapeHtml(course.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></div>`
      : "";
    const paragraphs = [
      "O Marca Milionária Legacy já saiu. \u{1F525}",
      "Não é mais um curso: é o passo a passo completo que uso e que já foi testado e validado por vários alunos, com resultados reais — o tipo de acompanhamento que normalmente só existe em mentorias de milhares de euros.",
      "Dentro do Legacy vais encontrar a estrutura de marca e posicionamento, a criação e validação do produto, a loja pronta a vender, o tráfego e os criativos que trazem clientes, e a parte que quase ninguém mostra: como escalar sem perder o controlo.",
      "Só há um detalhe: a tua conta está suspensa, por isso as aulas continuam fechadas para ti.",
      "Atualiza o teu plano e entras hoje mesmo — no Legacy e em tudo o resto do MM Club: academia completa, aulas ao vivo, comunidade e ferramentas.",
      "Eu entrego o caminho. A execução é tua.",
    ]
      .map(
        (t) =>
          `<p style="font-size:16px;line-height:1.7;color:#d4d4d4;margin:0 0 16px;">${escapeHtml(t)}</p>`,
      )
      .join("");
    return {
      subject: "Saiu o Marca Milionária Legacy — a tua conta está suspensa",
      html: layout(
        "O Marca Milionária Legacy já está aberto. Atualiza o teu plano para assistir.",
        `${hero}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Academia · Já disponível</div>
         <h1 style="font-size:28px;color:#ffffff;margin:0 0 18px;font-weight:600;line-height:1.25;">${escapeHtml(course.title)}</h1>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 22px;">Olá ${safe},</p>
         ${paragraphs}
         <div style="background:#161616;border:1px solid #232323;border-radius:12px;padding:16px 18px;margin:6px 0 26px;">
           <div style="font-size:11px;color:#c9a961;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">O teu acesso</div>
           <div style="font-size:16px;color:#ffffff;font-weight:600;line-height:1.5;">Conta suspensa — reativa em menos de um minuto e desbloqueia o Legacy.</div>
         </div>
         <p style="margin:0 0 8px;">${btn("Atualizar o meu plano →", `${APP_URL}/subscricao`)}</p>
         <p style="font-size:14px;line-height:1.65;color:#737373;margin:18px 0 0;">Já reativaste? Então começa aqui: <a href="${APP_URL}/academia/${course.courseId}" style="color:#c9a961;">${escapeHtml(course.title)}</a>.</p>`,
      ),
    };
  },

  /**
   * Recuperação inteligente: um email por gatilho, sempre com o mesmo pedido
   * (regularizar) mas com o motivo do momento — live a começar, aulas novas,
   * progresso interrompido, comunidade activa ou marco de dias em dívida.
   */
  winback(opts: {
    name: string;
    variant: "live" | "lessons" | "progress" | "community" | "milestone";
    days: number;
    debt?: string | null;
    /** Live que vem a caminho. */
    live?: { title: string; whenLabel: string; cover?: string | null } | null;
    /** Curso / aulas em destaque. */
    course?: { courseId: string; title: string; cover?: string | null } | null;
    lessonsCount?: number | null;
    /** Aula onde ficou. */
    progress?: { courseTitle: string; lessonTitle: string; percent: number } | null;
    posts?: number | null;
  }) {
    const safe = escapeHtml(opts.name);
    const first = safe.split(" ")[0] ?? safe;
    const coverRaw = opts.live?.cover ?? opts.course?.cover ?? null;
    const cover = coverRaw
      ? coverRaw.startsWith("http")
        ? coverRaw
        : `${APP_URL}${coverRaw}`
      : null;
    const hero = cover
      ? `<div style="margin:0 -40px 24px;"><img src="${cover}" alt="MM Club" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></div>`
      : "";

    let eyebrow = "Recuperação";
    let subject = "";
    let heading = "";
    let lines: string[] = [];

    if (opts.variant === "live" && opts.live) {
      eyebrow = "Aula ao vivo";
      subject = `${opts.live.title} é ${opts.live.whenLabel} — e tu estás de fora`;
      heading = opts.live.title;
      lines = [
        `${first}, temos aula ao vivo ${opts.live.whenLabel}.`,
        "Vai ser em direto, com perguntas e respostas, e não fica igual em gravação.",
        "O problema é este: a tua conta está suspensa por falta de pagamento, por isso a sala vai estar fechada para ti.",
        "Regulariza agora e entras na live com todos os outros.",
      ];
    } else if (opts.variant === "lessons" && opts.course) {
      eyebrow = "Academia";
      subject = `Tens ${opts.lessonsCount ?? "novas"} aulas fechadas no ${opts.course.title}`;
      heading = `${opts.course.title} está à tua espera`;
      lines = [
        `${first}, o ${opts.course.title} tem ${opts.lessonsCount ?? "várias"} aulas prontas: marca e posicionamento, produto, loja a vender, tráfego, criativos e escala.`,
        "É o caminho completo, na ordem certa, sem enfeites.",
        "Só que, com a conta suspensa, nenhuma dessas aulas abre.",
        "Regulariza o pagamento e desbloqueias tudo hoje mesmo.",
      ];
    } else if (opts.variant === "progress" && opts.progress) {
      eyebrow = "O teu progresso";
      subject = `Paraste em "${opts.progress.lessonTitle}" — falta pouco`;
      heading = "Estavas a meio do caminho";
      lines = [
        `${first}, ias em ${opts.progress.percent}% do ${opts.progress.courseTitle} e paraste em "${opts.progress.lessonTitle}".`,
        "Todo esse progresso continua guardado — nada foi apagado.",
        "Mas enquanto a conta estiver suspensa não consegues abrir a aula seguinte.",
        "Regulariza e continuas exactamente de onde ficaste.",
      ];
    } else if (opts.variant === "community") {
      eyebrow = "Comunidade";
      subject = `${opts.posts ?? "Vários"} tópicos novos na comunidade esta semana`;
      heading = "A comunidade não parou";
      lines = [
        `${first}, houve ${opts.posts ?? "vários"} tópicos novos esta semana: pessoas a mostrar lojas, criativos, números e a tirar dúvidas entre elas.`,
        "É ali que aparecem as ideias que ninguém publica no YouTube.",
        "Com a conta suspensa, a comunidade está fechada para ti.",
        "Volta hoje — é um minuto.",
      ];
    } else {
      eyebrow = "A tua conta";
      const stage =
        opts.days <= 3
          ? {
              subject: `${first}, o teu acesso está suspenso — resolve em 1 minuto`,
              heading: "Falta um passo",
              lines: [
                "O pagamento não foi concluído e o teu acesso ficou suspenso.",
                "Nada foi apagado: perfil, progresso, certificados e notas continuam guardados.",
                "Basta atualizar o método de pagamento e tudo volta imediatamente.",
              ],
            }
          : opts.days <= 14
            ? {
                subject: `Já vão ${opts.days} dias fora, ${first}`,
                heading: `${opts.days} dias parado`,
                lines: [
                  `Estás há ${opts.days} dias sem acesso às aulas, às lives e à comunidade.`,
                  "Quem continuou já avançou módulos inteiros neste tempo — e a diferença só cresce.",
                  "A boa notícia: voltas exactamente ao ponto onde ficaste.",
                ],
              }
            : opts.days <= 45
              ? {
                  subject: `${first}, ainda dá para recuperar o tempo perdido`,
                  heading: "Isto ainda não acabou",
                  lines: [
                    `Vais em ${opts.days} dias sem entrar. Não te escrevo por causa da dívida — escrevo porque começaste algo e ficou a meio.`,
                    "O plano continua o mesmo: uma aula por dia, executar, medir, ajustar.",
                    "Regulariza e em duas semanas estás outra vez à frente.",
                  ],
                }
              : {
                  subject: `Última chamada, ${first}`,
                  heading: "Última chamada",
                  lines: [
                    `São ${opts.days} dias em dívida. Ao chegar aos 90 a subscrição é cancelada de forma definitiva.`,
                    "Ainda dá para travar isso hoje e manter tudo o que já construíste dentro do clube.",
                    "Depois disso, voltar significa começar de novo.",
                  ],
                };
      subject = stage.subject;
      heading = stage.heading;
      lines = stage.lines;
    }

    const paragraphs = lines
      .map(
        (t) =>
          `<p style="font-size:16px;line-height:1.7;color:#d4d4d4;margin:0 0 16px;">${escapeHtml(t)}</p>`,
      )
      .join("");

    const debtBox = `<div style="background:#161616;border:1px solid #232323;border-radius:12px;padding:16px 18px;margin:6px 0 26px;">
      <div style="font-size:11px;color:#c9a961;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Estado da conta</div>
      <div style="font-size:16px;color:#ffffff;font-weight:600;line-height:1.5;">Suspensa${
        opts.debt ? ` · ${escapeHtml(opts.debt)} em dívida` : ""
      } — reativa em menos de um minuto.</div>
    </div>`;

    return {
      subject,
      html: layout(
        subject,
        `${hero}
         <div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(eyebrow)}</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 18px;font-weight:600;line-height:1.28;">${escapeHtml(heading)}</h1>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 22px;">Olá ${safe},</p>
         ${paragraphs}
         ${debtBox}
         <p style="margin:0 0 8px;">${btn("Regularizar e voltar →", `${APP_URL}/subscricao`)}</p>
         <p style="font-size:14px;line-height:1.65;color:#737373;margin:18px 0 0;">Se houve algum problema com o pagamento, responde a este email que resolvemos contigo.</p>`,
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

  partnerApplicationReceived(name: string) {
    const safe = escapeHtml(name);
    return {
      subject: "Recebemos a tua candidatura ao MM Partners",
      html: layout(
        "A tua candidatura ao programa de afiliados está em análise.",
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Partners</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 14px;font-weight:600;line-height:1.25;">Candidatura recebida</h1>
         <p style="font-size:16px;line-height:1.7;color:#d4d4d4;margin:0 0 16px;">Olá ${safe}, recebemos o teu pedido para entrar no MM Partners. A equipa vai analisar e recebes a resposta por email e no sino de avisos.</p>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 26px;">Assim que for aprovado, tens acesso ao teu link personalizado, às comissões de 10 € por indicado pago e ao MM Club Start grátis com 3 indicados ativos.</p>
         <p style="margin:0 0 8px;">${btn("Ver o meu pedido →", `${APP_URL}/parceiros`)}</p>`,
      ),
    };
  },

  partnerApproved(name: string, code: string) {
    const safe = escapeHtml(name);
    const link = `${APP_URL}/?ref=${encodeURIComponent(code)}`;
    return {
      subject: "Estás dentro do MM Partners 🎉",
      html: layout(
        "A tua candidatura foi aprovada — já podes começar a indicar.",
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Partners · Aprovado</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 14px;font-weight:600;line-height:1.25;">Bem-vindo ao MM Partners, ${safe}</h1>
         <p style="font-size:16px;line-height:1.7;color:#d4d4d4;margin:0 0 20px;">A tua candidatura foi aprovada. A partir de agora, cada pessoa que entrar pelo teu link e ficar com plano pago conta para ti.</p>
         <div style="background:#161616;border:1px solid #232323;border-radius:12px;padding:16px 18px;margin:0 0 24px;">
           <div style="font-size:11px;color:#c9a961;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">O teu link</div>
           <a href="${link}" style="font-size:15px;color:#ffffff;text-decoration:none;word-break:break-all;">${escapeHtml(link)}</a>
         </div>
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 26px;">Com 3 indicados pagos ativos tens o MM Club Start grátis. A partir do 4.º, ganhas 10 € por cada indicado pago.</p>
         <p style="margin:0 0 8px;">${btn("Abrir o meu painel →", `${APP_URL}/parceiros`)}</p>`,
      ),
    };
  },

  partnerRejected(name: string, note?: string | null) {
    const safe = escapeHtml(name);
    const reason = note?.trim()
      ? `<div style="background:#0a0a0a;border-left:3px solid #c9a961;padding:16px 20px;margin:0 0 22px;border-radius:8px;font-size:15px;line-height:1.7;color:#e5e5e5;white-space:pre-wrap;">${escapeHtml(note.trim())}</div>`
      : "";
    return {
      subject: "A tua candidatura ao MM Partners",
      html: layout(
        "Decisão sobre a tua candidatura ao programa de afiliados.",
        `<div style="font-size:12px;color:#c9a961;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">MM Partners</div>
         <h1 style="font-size:26px;color:#ffffff;margin:0 0 14px;font-weight:600;line-height:1.25;">Candidatura não aprovada por agora</h1>
         <p style="font-size:16px;line-height:1.7;color:#d4d4d4;margin:0 0 18px;">Olá ${safe}, analisámos o teu pedido e neste momento não conseguimos aprovar a tua entrada no MM Partners.</p>
         ${reason}
         <p style="font-size:15px;line-height:1.65;color:#a3a3a3;margin:0 0 26px;">Podes voltar a candidatar-te mais à frente. Se tiveres dúvidas, fala com a equipa no MM Suporte.</p>
         <p style="margin:0 0 8px;">${btn("Falar com o suporte →", `${APP_URL}/ajuda`)}</p>`,
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
