import * as React from 'react'
import { Button, Link, Text } from '@react-email/components'

import { Shell, Title, styles } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Shell preview="Confirma o teu email para ativar o acesso ao MM Club.">
    <Title>Confirma o teu email</Title>
    <Text style={styles.text}>
      Bem-vindo ao MM Club. Falta apenas um passo: confirma o endereço{' '}
      <Link href={`mailto:${recipient}`} style={styles.link}>
        {recipient}
      </Link>{' '}
      para ativares a tua conta.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirmar email →
    </Button>
    <Text style={styles.muted}>
      Se não criaste esta conta, podes ignorar este email com segurança.
    </Text>
  </Shell>
)

export default SignupEmail
