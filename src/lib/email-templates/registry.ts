import type { ComponentType } from 'react'

import { template as invoiceReceiptTemplate } from './invoice-receipt'
import { template as waitlistHeadsUpTemplate } from './waitlist-heads-up'
import { template as waitlistOpenTemplate } from './waitlist-open'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'invoice-receipt': invoiceReceiptTemplate,
  'waitlist-heads-up': waitlistHeadsUpTemplate,
  'waitlist-open': waitlistOpenTemplate,
}

