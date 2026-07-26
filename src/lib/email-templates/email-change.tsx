import * as React from 'react'
import { Button, Link, Text } from '@react-email/components'

import { Shell, Title, styles } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Shell preview="Confirma a alteração do teu email no MM Club.">
    <Title>Confirmar alteração de email</Title>
    <Text style={styles.text}>
      Pediste para alterar o email da tua conta MM Club de{' '}
      <Link href={`mailto:${oldEmail}`} style={styles.link}>
        {oldEmail}
      </Link>{' '}
      para{' '}
      <Link href={`mailto:${newEmail}`} style={styles.link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirmar alteração →
    </Button>
    <Text style={styles.muted}>
      Se não fizeste este pedido, protege já a tua conta alterando a
      palavra-passe.
    </Text>
  </Shell>
)

export default EmailChangeEmail
