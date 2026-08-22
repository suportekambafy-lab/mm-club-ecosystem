import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import { SITE_URL, Shell, Title, styles } from './brand'
import type { TemplateEntry } from './registry'

const label: React.CSSProperties = {
  fontSize: '13px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: '#c9a961',
  fontWeight: 700,
  margin: '0 0 10px',
}

const card: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.8',
  color: '#e8e8e8',
  margin: '0 0 22px',
  padding: '16px 18px',
  borderLeft: '3px solid #c9a961',
  backgroundColor: '#151515',
  borderRadius: '8px',
}

interface Props {
  memberName?: string
  courseTitle?: string
  code?: string
  hours?: number
}

const Email = ({ memberName, courseTitle, code, hours }: Props) => (
  <Shell preview={`O teu certificado de ${courseTitle ?? 'curso'} está pronto.`}>
    <Title>Parabéns{memberName ? `, ${memberName}` : ''} — curso concluído.</Title>
    <Text style={styles.text}>
      Concluíste com êxito o programa{' '}
      <strong style={{ color: '#ffffff' }}>{courseTitle ?? 'do MM Club'}</strong>. O
      teu certificado oficial do MM Club já foi emitido e está disponível para
      download.
    </Text>
    <Text style={label}>Detalhes do certificado</Text>
    <Text style={card}>
      Curso: {courseTitle ?? '—'}
      <br />
      {hours && hours > 0 ? (
        <>
          Carga: {hours}h de formação
          <br />
        </>
      ) : null}
      Código de verificação: <strong style={{ color: '#ffffff' }}>{code ?? '—'}</strong>
    </Text>
    <Section>
      <Button href={`${SITE_URL}/certificado/${code ?? ''}`} style={styles.button}>
        Ver e descarregar certificado
      </Button>
    </Section>
    <Text style={styles.text}>
      Podes também aceder a todos os teus certificados em qualquer momento na área
      de membro, em Certificados.
    </Text>
    <Text style={styles.muted}>
      Este certificado é verificável publicamente através do código acima.
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Certificado emitido — ${data?.courseTitle ?? 'curso concluído'}`,
  displayName: 'Certificado de conclusão',
  previewData: {
    memberName: 'Victor',
    courseTitle: 'Marca Milionária 360',
    code: 'MMC-PREVIEW',
    hours: 12,
  },
} satisfies TemplateEntry
