import * as React from 'react'
import { Section, Text } from '@react-email/components'

import { SITE_URL, Shell, Title, styles } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  closerName?: string
  leadName?: string
  whenLabel?: string
  kind?: 'day' | 'hour'
}

const highlight: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#c9a961',
  margin: '0 0 22px',
}

const Email = ({
  closerName = 'Victor',
  leadName = 'o lead',
  whenLabel = 'amanhã às 15:00 (Lisboa)',
  kind = 'day',
}: Props) => {
  const isDay = kind !== 'hour'
  return (
    <Shell
      preview={
        isDay
          ? `Reunião de fecho amanhã com ${leadName}`
          : `A tua reunião com ${leadName} é quase já`
      }
    >
      <Title>
        {isDay
          ? `${closerName}, não te esqueças: amanhã é dia de fecho.`
          : `${closerName}, é quase hora. Bora fechar.`}
      </Title>
      <Text style={styles.text}>
        {isDay
          ? `Tens uma reunião de fecho marcada para amanhã com ${leadName}. Prepara a proposta, revê as respostas da aplicação e entra na call com tudo.`
          : `A tua reunião de fecho com ${leadName} começa daqui a poucos minutos. Abre o link da reunião e entra uns minutos antes.`}
      </Text>
      <Text style={highlight}>{whenLabel}</Text>
      <Text style={styles.text}>
        {isDay
          ? 'Vamos buscar essa venda? 💪'
          : 'Vamos buscar essa venda. Boa call! 🔔'}
      </Text>
      <Section>
        <Text style={styles.muted}>
          Vê os detalhes da call em{' '}
          <a href={`${SITE_URL}/comercial`} style={styles.link.color ? { color: styles.link.color } : undefined}>
            mmclub.pt/comercial
          </a>
          .
        </Text>
      </Section>
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.kind === 'hour'
      ? `🔔 A tua reunião com ${d?.leadName ?? 'o lead'} é quase já`
      : `📅 Amanhã: reunião de fecho com ${d?.leadName ?? 'o lead'}`,
  displayName: 'Lembrete de call agendada',
  previewData: {
    closerName: 'Victor',
    leadName: 'João Silva',
    whenLabel: 'amanhã às 15:00 (Lisboa)',
    kind: 'day',
  },
} satisfies TemplateEntry
