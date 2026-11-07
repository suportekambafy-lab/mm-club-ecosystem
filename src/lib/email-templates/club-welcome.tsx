import * as React from 'react'
import { Text } from '@react-email/components'

import { SITE_URL, Shell, Title, styles } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
  password?: string
  accessDescription?: string
}

const box: React.CSSProperties = {
  background: '#f6f3ea',
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '0 0 22px',
  fontSize: '15px',
  lineHeight: '1.7',
  color: '#1a1a1a',
}

const Email = ({ name = 'membro', email, password, accessDescription = 'A tua conta MM Club está pronta.' }: Props) => (
  <Shell preview="O teu acesso ao MM Club está pronto">
    <Title>Bem-vindo(a) ao MM Club, {name}! 🎉</Title>
    <Text style={styles.text}>
      {accessDescription} Entra com estes dados:
    </Text>
    {email && password && <Text style={box}>
      <strong>Email:</strong> {email}
      <br />
      <strong>Palavra-passe:</strong> {password}
    </Text>}
    <Text style={styles.text}>
      Entra em <a href={`${SITE_URL}/auth`}>mmclub.pt/auth</a>. Recomendamos que alteres a palavra-passe no teu
      perfil depois do primeiro acesso.
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'O teu acesso ao MM Club está pronto',
  displayName: 'Boas-vindas com dados de acesso',
  previewData: { name: 'Ana', email: 'ana@exemplo.com', password: 'Abc123xyz!' },
} satisfies TemplateEntry
