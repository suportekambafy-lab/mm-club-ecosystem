import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import { SITE_URL, Shell, Title, styles } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  launchLabel?: string
}

const highlight: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#c9a961',
  margin: '0 0 22px',
}

const Email = ({ launchLabel = '28 de julho, 18:30 (Lisboa)' }: Props) => (
  <Shell preview={`O MM Club abre a ${launchLabel}`}>
    <Title>Estás na lista. Abrimos amanhã.</Title>
    <Text style={styles.text}>
      Olá! O MM Club — o ecossistema privado da Marca Milionária — abre ao
      público:
    </Text>
    <Text style={highlight}>{launchLabel}</Text>
    <Text style={styles.text}>
      Como estás na lista de espera, vais receber um email assim que abrirmos,
      com o link direto para aderir. Nada a fazer agora — só marcar a hora.
    </Text>
    <Section>
      <Button href={`${SITE_URL}/quiz`} style={styles.button}>
        Ver o que te espera
      </Button>
    </Section>
    <Text style={styles.muted}>
      Recebes este email porque te inscreveste na lista de espera do MM Club.
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'O MM Club abre amanhã às 18:30',
  displayName: 'Lista de espera — aviso de abertura',
  previewData: { launchLabel: '28 de julho, 18:30 (Lisboa)' },
} satisfies TemplateEntry
