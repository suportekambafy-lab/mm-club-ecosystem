import * as React from 'react'
import { Text } from '@react-email/components'

import { Shell, Title, styles } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <Shell preview="O teu código de verificação MM Club.">
    <Title>Código de verificação</Title>
    <Text style={styles.text}>
      Usa o código abaixo para confirmares a tua identidade:
    </Text>
    <Text style={styles.code}>{token}</Text>
    <Text style={styles.muted}>
      Este código expira dentro de pouco tempo. Se não fizeste este pedido,
      ignora este email.
    </Text>
  </Shell>
)

export default ReauthenticationEmail
