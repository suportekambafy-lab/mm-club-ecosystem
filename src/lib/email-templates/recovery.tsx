import * as React from 'react'
import { Button, Text } from '@react-email/components'

import { Shell, Title, styles } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Shell preview="Redefine a tua palavra-passe do MM Club.">
    <Title>Redefinir palavra-passe</Title>
    <Text style={styles.text}>
      Recebemos um pedido para redefinir a palavra-passe da tua conta MM Club.
      Clica no botão abaixo para escolheres uma nova palavra-passe.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Definir nova palavra-passe →
    </Button>
    <Text style={styles.muted}>
      Se não pediste esta alteração, ignora este email — a tua palavra-passe
      permanece inalterada.
    </Text>
  </Shell>
)

export default RecoveryEmail
