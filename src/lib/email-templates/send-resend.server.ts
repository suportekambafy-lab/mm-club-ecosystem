/**
 * Sends a registered React Email template through Resend (connector gateway),
 * so every delivery shows up in the Resend dashboard alongside the
 * Notification Engine messages.
 */
import * as React from 'react'
import { render } from '@react-email/render'
import { TEMPLATES } from './registry'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'
const FROM = 'MM Club <geral@mmclub.pt>'

export type SendResendResult =
  | { sent: true; providerId: string | null }
  | { sent: false; error: string }

export async function sendTemplateEmailResend(
  templateName: string,
  to: string,
  templateData: Record<string, unknown> = {},
): Promise<SendResendResult> {
  const lovableKey = process.env.LOVABLE_API_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!lovableKey || !resendKey) return { sent: false, error: 'missing_credentials' }

  const template = TEMPLATES[templateName]
  if (!template) return { sent: false, error: `unknown_template:${templateName}` }

  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': resendKey,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  })

  const body = await res.text()
  if (!res.ok) return { sent: false, error: `${res.status}: ${body}`.slice(0, 400) }
  try {
    return { sent: true, providerId: (JSON.parse(body) as { id?: string })?.id ?? null }
  } catch {
    return { sent: true, providerId: null }
  }
}
