import * as React from 'react'
import { Button, Text } from '@react-email/components'

import { Shell, Title, styles } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Shell preview="O teu link de entrada no MM Club.">
    <Title>Entrar no MM Club</Title>
    <Text style={styles.text}>
      Clica no botão abaixo para entrares na tua conta. Este link expira dentro
      de pouco tempo.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Entrar agora →
    </Button>
    <Text style={styles.muted}>
      Se não pediste este link, podes ignorar este email com segurança.
    </Text>
  </Shell>
)

export default MagicLinkEmail
