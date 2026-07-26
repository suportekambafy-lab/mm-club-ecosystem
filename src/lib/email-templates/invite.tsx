import * as React from 'react'
import { Button, Link, Text } from '@react-email/components'

import { Shell, Title, styles } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Shell preview="Foste convidado para o MM Club.">
    <Title>Foste convidado</Title>
    <Text style={styles.text}>
      Tens um convite para te juntares ao{' '}
      <Link href={siteUrl} style={styles.link}>
        <strong>MM Club</strong>
      </Link>
      . Aceita o convite para criares a tua conta e acederes à Academia, ao MM
      Studio e à comunidade privada.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Aceitar convite →
    </Button>
    <Text style={styles.muted}>
      Se não estavas à espera deste convite, podes ignorar este email.
    </Text>
  </Shell>
)

export default InviteEmail
