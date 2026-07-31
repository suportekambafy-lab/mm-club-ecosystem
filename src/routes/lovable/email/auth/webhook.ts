import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "MM Club"
const SENDER_DOMAIN = "notify.mmclub.pt"
const ROOT_DOMAIN = "mmclub.pt"
const FROM_DOMAIN = "mmclub.pt"
const SITE_URL = "https://mmclub.online"

// The SDK handler owns verification, dispatch, and retry semantics; this file
// owns only the email decisions: subjects, templates, and per-type props.
// `sendUrl` points at our own relay so every auth email is delivered by
// Resend (and therefore visible in the Resend dashboard).
// NOTE: must be the canonical host (mmclub.pt). www.mmclub.online answers with a
// cross-host 307 redirect, and fetch drops the Authorization header on those,
// so the relay replied 401 and auth emails silently never reached Resend.
const RELAY_URL =
  process.env.LOVABLE_SEND_URL ?? 'https://mmclub.pt/api/public/hooks/email-relay'

const handler = createAuthEmailHandler({
  apiKey: process.env.LOVABLE_API_KEY!,
  from: `${SITE_NAME} <geral@${FROM_DOMAIN}>`,
  senderDomain: SENDER_DOMAIN,
  sendUrl: RELAY_URL,
  emails: {
    signup: {
      subject: 'Confirma o teu email — MM Club',

      render: (data) =>
        React.createElement(SignupEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipient: data.email,
          confirmationUrl: data.url,
        }),
    },
    invite: {
      subject: 'Foste convidado para o MM Club',
      render: (data) =>
        React.createElement(InviteEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          confirmationUrl: data.url,
        }),
    },
    magiclink: {
      subject: 'O teu link de entrada — MM Club',
      render: (data) =>
        React.createElement(MagicLinkEmail, {
          siteName: SITE_NAME,
          confirmationUrl: data.url,
        }),
    },
    recovery: {
      subject: 'Redefinir a tua palavra-passe — MM Club',
      render: (data) =>
        React.createElement(RecoveryEmail, {
          siteName: SITE_NAME,
          confirmationUrl: data.url,
        }),
    },
    email_change: {
      subject: 'Confirma o teu novo email — MM Club',
      render: (data) =>
        React.createElement(EmailChangeEmail, {
          siteName: SITE_NAME,
          oldEmail: data.old_email ?? '',
          email: data.email,
          newEmail: data.new_email ?? '',
          confirmationUrl: data.url,
        }),
    },
    reauthentication: {
      subject: 'O teu código de verificação — MM Club',

      render: (data) =>
        React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
    },
  },
})

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
    },
  },
})
