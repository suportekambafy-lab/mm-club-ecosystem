import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import { SITE_URL, Shell, Title, styles } from './brand'
import type { TemplateEntry } from './registry'

const steps: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.8',
  color: '#d4d4d4',
  margin: '0 0 22px',
}

const Email = () => (
  <Shell preview="O MM Club está aberto — adere agora">
    <Title>Está aberto. Bem-vindo ao MM Club.</Title>
    <Text style={styles.text}>
      Chegou a hora. As portas do MM Club estão abertas e o teu lugar está a um
      clique.
    </Text>
    <Text style={steps}>
      1. Responde ao diagnóstico rápido (2 minutos)
      <br />
      2. Recebes o plano recomendado para a tua fase
      <br />
      3. Finalizas a adesão e entras no ecossistema
    </Text>
    <Section>
      <Button href={`${SITE_URL}/quiz`} style={styles.button}>
        Aderir ao MM Club
      </Button>
    </Section>
    <Text style={styles.muted}>
      Recebes este email porque te inscreveste na lista de espera do MM Club.
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'Abrimos agora — o teu acesso ao MM Club',
  displayName: 'Lista de espera — abertura',
  previewData: {},
} satisfies TemplateEntry
