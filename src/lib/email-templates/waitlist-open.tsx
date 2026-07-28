import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import { SITE_URL, Shell, Title, styles } from './brand'
import type { TemplateEntry } from './registry'

const steps: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.9',
  color: '#d4d4d4',
  margin: '0 0 22px',
}

const urgency: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.7',
  color: '#e8e8e8',
  margin: '0 0 22px',
  padding: '16px 18px',
  borderLeft: '3px solid #c9a961',
  backgroundColor: '#151515',
  borderRadius: '8px',
}

const label: React.CSSProperties = {
  fontSize: '13px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: '#c9a961',
  fontWeight: 700,
  margin: '0 0 10px',
}

const Email = () => (
  <Shell preview="Chegou o momento. O teu acesso ao MM Club está pronto.">
    <Title>As portas abriram. O teu acesso está pronto.</Title>
    <Text style={styles.text}>
      Chegou o momento. Depois de estares na lista de espera, o teu acesso ao MM
      Club está finalmente disponível.
    </Text>
    <Text style={styles.text}>
      A partir de hoje entras numa comunidade criada para empreendedores que
      querem crescer mais rápido — com estratégia, inteligência artificial,
      automações, formação prática e ferramentas desenvolvidas para gerar
      resultados reais.
    </Text>
    <Text style={label}>O que acontece agora</Text>
    <Text style={steps}>
      Entrar demora cerca de 2 minutos.
      <br />
      1. Respondes ao diagnóstico rápido.
      <br />
      2. Recebes a recomendação do plano certo para o teu momento.
      <br />
      3. Concluis a adesão e entras imediatamente no ecossistema MM Club.
    </Text>
    <Section>
      <Button href={`${SITE_URL}/quiz`} style={styles.button}>
        Garantir o meu lugar
      </Button>
    </Section>
    <Text style={urgency}>
      O acesso encontra-se aberto neste momento. Se decidires adiar, poderás ter
      de esperar pela próxima abertura.
      <br />
      <strong style={{ color: '#ffffff' }}>Este é o momento de entrar.</strong>
    </Text>
    <Text style={styles.muted}>
      Recebes este email porque estiveste na lista de espera do MM Club.
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'As portas abriram — o teu lugar no MM Club está reservado',
  displayName: 'Lista de espera — abertura',
  previewData: {},
} satisfies TemplateEntry
