import * as React from 'react'
import { Button, Hr, Section, Text } from '@react-email/components'

import { SITE_URL, Shell, Title, styles } from './brand'
import type { TemplateEntry } from './registry'

interface InvoiceLine {
  description: string
  quantity?: number
  amount?: string
}

interface Props {
  name?: string
  invoiceNumber?: string
  issuedAt?: string
  total?: string
  lines?: InvoiceLine[]
}

const row: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#d4d4d4',
  margin: '0 0 8px',
}

const totalRow: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#c9a961',
  margin: '12px 0 0',
}

const Email = ({
  name,
  invoiceNumber = 'MM-0000-00000',
  issuedAt,
  total = '—',
  lines = [],
}: Props) => (
  <Shell preview={`Fatura ${invoiceNumber} · MM Club`}>
    <Title>Fatura/recibo {invoiceNumber}</Title>
    <Text style={styles.text}>
      {name ? `Olá ${name},` : 'Olá,'} obrigado pelo teu pagamento. Em anexo a
      esta mensagem está o resumo da tua fatura — podes descarregar o PDF na tua
      área de subscrição.
    </Text>

    <Section>
      {lines.map((line, index) => (
        <Text key={index} style={row}>
          {line.quantity && line.quantity > 1 ? `${line.quantity}× ` : ''}
          {line.description}
          {line.amount ? ` — ${line.amount}` : ''}
        </Text>
      ))}
      <Hr style={{ borderColor: '#1f1f1f', margin: '16px 0 0' }} />
      <Text style={totalRow}>Total pago: {total}</Text>
      {issuedAt ? (
        <Text style={{ ...row, margin: '6px 0 0', color: '#8a8a8a' }}>
          Emitida a {issuedAt}
        </Text>
      ) : null}
    </Section>

    <Section style={{ margin: '28px 0 0' }}>
      <Button href={`${SITE_URL}/subscricao`} style={styles.button}>
        Descarregar fatura
      </Button>
    </Section>

    <Text style={styles.muted}>
      Kambafy, LLC · EIN 38-4416614 · Orlando, FL, United States
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Fatura ${data?.invoiceNumber ?? ''} · MM Club`.trim(),
  displayName: 'Fatura / recibo',
  previewData: {
    name: 'João',
    invoiceNumber: 'MM-2026-00012',
    issuedAt: '26/07/2026',
    total: '29,90 €',
    lines: [
      { description: 'MM Club Start — subscrição mensal', quantity: 1, amount: '29,90 €' },
    ],
  },
} satisfies TemplateEntry
