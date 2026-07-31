import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const SITE_URL = 'https://mmclub.pt'

export const styles = {
  main: {
    backgroundColor: '#ffffff',
    margin: 0,
    padding: '32px 12px',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },
  container: {
    width: '100%',
    maxWidth: '600px',
    backgroundColor: '#0f0f0f',
    borderRadius: '16px',
    border: '1px solid #1f1f1f',
    padding: '0',
    overflow: 'hidden' as const,
  },
  header: { padding: '32px 40px 0' },
  kicker: {
    fontSize: '11px',
    letterSpacing: '0.28em',
    color: '#c9a961',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
    margin: 0,
  },
  content: { padding: '24px 40px 32px' },
  h1: {
    fontSize: '26px',
    lineHeight: '1.25',
    fontWeight: 600,
    color: '#ffffff',
    margin: '0 0 14px',
  },
  text: {
    fontSize: '15px',
    lineHeight: '1.65',
    color: '#d4d4d4',
    margin: '0 0 22px',
  },
  muted: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#8a8a8a',
    margin: '26px 0 0',
  },
  button: {
    display: 'inline-block',
    backgroundColor: '#c9a961',
    color: '#0a0a0a',
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: '999px',
    padding: '14px 28px',
    textDecoration: 'none',
  },
  link: { color: '#c9a961', textDecoration: 'underline' },
  code: {
    fontFamily: 'Courier, monospace',
    fontSize: '30px',
    letterSpacing: '0.22em',
    fontWeight: 700,
    color: '#c9a961',
    margin: '0 0 24px',
  },
  footer: {
    padding: '20px 40px',
    borderTop: '1px solid #1f1f1f',
    fontSize: '12px',
    lineHeight: '1.6',
    color: '#6b6b6b',
    textAlign: 'center' as const,
    margin: 0,
  },
}

export const Shell = ({
  preview,
  children,
}: {
  preview: string
  children: React.ReactNode
}) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.kicker}>MM · Club</Text>
        </Section>
        <Section style={styles.content}>{children}</Section>
        <Section>
          <Text style={styles.footer}>
            MM Club ·{' '}
            <Link href={SITE_URL} style={styles.link}>
              mmclub.pt
            </Link>
            <br />
            Recebeste este email porque tens conta no MM Club.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const Title = ({ children }: { children: React.ReactNode }) => (
  <Heading style={styles.h1}>{children}</Heading>
)
