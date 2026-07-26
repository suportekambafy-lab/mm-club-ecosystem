export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_action_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          geo: string | null
          id: string
          ip: string | null
          request_id: string | null
          result: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          geo?: string | null
          id?: string
          ip?: string | null
          request_id?: string | null
          result?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          geo?: string | null
          id?: string
          ip?: string | null
          request_id?: string | null
          result?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_overrides: {
        Row: {
          data: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data?: Json
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      billing_checkout_intents: {
        Row: {
          account_created: boolean
          coupon_code: string | null
          created_at: string
          email: string
          error: string | null
          gateway: string | null
          gateway_payment_id: string | null
          id: string
          metadata: Json
          name: string | null
          price_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_created?: boolean
          coupon_code?: string | null
          created_at?: string
          email: string
          error?: string | null
          gateway?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          price_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_created?: boolean
          coupon_code?: string | null
          created_at?: string
          email?: string
          error?: string | null
          gateway?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          price_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_checkout_intents_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "catalog_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          redeemed_at?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "billing_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_coupon_redemptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_coupons: {
        Row: {
          active: boolean
          amount_off_cents: number | null
          code: string
          created_at: string
          currency: string
          duration: string
          duration_in_months: number | null
          id: string
          max_redemptions: number | null
          metadata: Json
          name: string | null
          percent_off: number | null
          redemptions: number
          restricted_price_ids: string[]
          trial_days_override: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          amount_off_cents?: number | null
          code: string
          created_at?: string
          currency?: string
          duration?: string
          duration_in_months?: number | null
          id?: string
          max_redemptions?: number | null
          metadata?: Json
          name?: string | null
          percent_off?: number | null
          redemptions?: number
          restricted_price_ids?: string[]
          trial_days_override?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          amount_off_cents?: number | null
          code?: string
          created_at?: string
          currency?: string
          duration?: string
          duration_in_months?: number | null
          id?: string
          max_redemptions?: number | null
          metadata?: Json
          name?: string | null
          percent_off?: number | null
          redemptions?: number
          restricted_price_ids?: string[]
          trial_days_override?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      billing_customer_profiles: {
        Row: {
          avg_days_failure_to_payment: number | null
          avg_hours_suspension_to_recovery: number | null
          avg_hours_to_recover: number | null
          best_method: string | null
          best_method_rate: number | null
          best_pay_hour: number | null
          cancellations: number
          card_changes: number
          chargebacks: number
          consecutive_successes: number
          created_at: string
          customer_since: string | null
          expired_cards: number
          invoices_total: number
          last_failure_at: string | null
          last_login_at: string | null
          last_method_change_at: string | null
          last_payment_at: string | null
          last_score: number | null
          last_score_at: string | null
          months_as_customer: number
          payments_failed: number
          payments_succeeded: number
          preferred_method: string | null
          recoveries_failed: number
          recoveries_succeeded: number
          recovery_rate: number
          refreshed_at: string
          refunds: number
          suspensions: number
          typical_pay_day: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_days_failure_to_payment?: number | null
          avg_hours_suspension_to_recovery?: number | null
          avg_hours_to_recover?: number | null
          best_method?: string | null
          best_method_rate?: number | null
          best_pay_hour?: number | null
          cancellations?: number
          card_changes?: number
          chargebacks?: number
          consecutive_successes?: number
          created_at?: string
          customer_since?: string | null
          expired_cards?: number
          invoices_total?: number
          last_failure_at?: string | null
          last_login_at?: string | null
          last_method_change_at?: string | null
          last_payment_at?: string | null
          last_score?: number | null
          last_score_at?: string | null
          months_as_customer?: number
          payments_failed?: number
          payments_succeeded?: number
          preferred_method?: string | null
          recoveries_failed?: number
          recoveries_succeeded?: number
          recovery_rate?: number
          refreshed_at?: string
          refunds?: number
          suspensions?: number
          typical_pay_day?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_days_failure_to_payment?: number | null
          avg_hours_suspension_to_recovery?: number | null
          avg_hours_to_recover?: number | null
          best_method?: string | null
          best_method_rate?: number | null
          best_pay_hour?: number | null
          cancellations?: number
          card_changes?: number
          chargebacks?: number
          consecutive_successes?: number
          created_at?: string
          customer_since?: string | null
          expired_cards?: number
          invoices_total?: number
          last_failure_at?: string | null
          last_login_at?: string | null
          last_method_change_at?: string | null
          last_payment_at?: string | null
          last_score?: number | null
          last_score_at?: string | null
          months_as_customer?: number
          payments_failed?: number
          payments_succeeded?: number
          preferred_method?: string | null
          recoveries_failed?: number
          recoveries_succeeded?: number
          recovery_rate?: number
          refreshed_at?: string
          refunds?: number
          suspensions?: number
          typical_pay_day?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          address: Json
          company_name: string | null
          created_at: string
          currency: string
          email: string | null
          gateway: string | null
          gateway_customer_id: string | null
          id: string
          metadata: Json
          name: string | null
          tax_country: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: Json
          company_name?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          gateway?: string | null
          gateway_customer_id?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          tax_country?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: Json
          company_name?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          gateway?: string | null
          gateway_customer_id?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          tax_country?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_dunning_attempts: {
        Row: {
          amount_cents: number
          attempt_number: number
          attempted_at: string | null
          created_at: string
          currency: string
          cycle_key: string | null
          error: string | null
          error_category: string | null
          gateway_error_code: string | null
          gateway_error_message: string | null
          gateway_payment_id: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          mandate_id: string | null
          method: string | null
          outcome: string | null
          payment_id: string | null
          phase: string
          recovered_at: string | null
          recovery_score: number | null
          scheduled_for: string
          score_factors: Json
          status: string
          strategy: string | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          attempt_number: number
          attempted_at?: string | null
          created_at?: string
          currency?: string
          cycle_key?: string | null
          error?: string | null
          error_category?: string | null
          gateway_error_code?: string | null
          gateway_error_message?: string | null
          gateway_payment_id?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          mandate_id?: string | null
          method?: string | null
          outcome?: string | null
          payment_id?: string | null
          phase?: string
          recovered_at?: string | null
          recovery_score?: number | null
          scheduled_for: string
          score_factors?: Json
          status?: string
          strategy?: string | null
          subscription_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          attempt_number?: number
          attempted_at?: string | null
          created_at?: string
          currency?: string
          cycle_key?: string | null
          error?: string | null
          error_category?: string | null
          gateway_error_code?: string | null
          gateway_error_message?: string | null
          gateway_payment_id?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          mandate_id?: string | null
          method?: string | null
          outcome?: string | null
          payment_id?: string | null
          phase?: string
          recovered_at?: string | null
          recovery_score?: number | null
          scheduled_for?: string
          score_factors?: Json
          status?: string
          strategy?: string | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_dunning_attempts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          created_at: string
          currency: string
          customer_id: string
          discount_cents: number
          id: string
          issued_at: string | null
          lines: Json
          metadata: Json
          number: string | null
          paid_at: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["billing_invoice_status"]
          subscription_id: string | null
          subtotal_cents: number
          tax_cents: number
          tax_country: string | null
          tax_rate: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_id: string
          discount_cents?: number
          id?: string
          issued_at?: string | null
          lines?: Json
          metadata?: Json
          number?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["billing_invoice_status"]
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tax_country?: string | null
          tax_rate?: number
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_id?: string
          discount_cents?: number
          id?: string
          issued_at?: string | null
          lines?: Json
          metadata?: Json
          number?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["billing_invoice_status"]
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tax_country?: string | null
          tax_rate?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_ledger_entries: {
        Row: {
          actor_id: string | null
          amount_cents: number
          balance_after: number | null
          created_at: string
          credits_delta: number
          currency: string
          customer_id: string | null
          direction: Database["public"]["Enums"]["billing_ledger_direction"]
          entry_type: Database["public"]["Enums"]["billing_ledger_entry_type"]
          event_id: string | null
          id: string
          idempotency_key: string
          memo: string | null
          metadata: Json
          reverses_entry_id: string | null
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          amount_cents: number
          balance_after?: number | null
          created_at?: string
          credits_delta?: number
          currency?: string
          customer_id?: string | null
          direction: Database["public"]["Enums"]["billing_ledger_direction"]
          entry_type: Database["public"]["Enums"]["billing_ledger_entry_type"]
          event_id?: string | null
          id?: string
          idempotency_key: string
          memo?: string | null
          metadata?: Json
          reverses_entry_id?: string | null
          source_id?: string | null
          source_type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          amount_cents?: number
          balance_after?: number | null
          created_at?: string
          credits_delta?: number
          currency?: string
          customer_id?: string | null
          direction?: Database["public"]["Enums"]["billing_ledger_direction"]
          entry_type?: Database["public"]["Enums"]["billing_ledger_entry_type"]
          event_id?: string | null
          id?: string
          idempotency_key?: string
          memo?: string | null
          metadata?: Json
          reverses_entry_id?: string | null
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_ledger_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_ledger_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "billing_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          customer_id: string
          exp_month: number | null
          exp_year: number | null
          gateway: string
          gateway_mandate_id: string | null
          id: string
          is_default: boolean
          last4: string | null
          metadata: Json
          method: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          customer_id: string
          exp_month?: number | null
          exp_year?: number | null
          gateway: string
          gateway_mandate_id?: string | null
          id?: string
          is_default?: boolean
          last4?: string | null
          metadata?: Json
          method?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          customer_id?: string
          exp_month?: number | null
          exp_year?: number | null
          gateway?: string
          gateway_mandate_id?: string | null
          id?: string
          is_default?: boolean
          last4?: string | null
          metadata?: Json
          method?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_methods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_id: string | null
          failure_reason: string | null
          gateway: string
          gateway_payment_id: string
          id: string
          invoice_id: string | null
          metadata: Json
          method: string | null
          paid_at: string | null
          price_id: string | null
          refunded_cents: number
          status: Database["public"]["Enums"]["billing_payment_status"]
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          customer_id?: string | null
          failure_reason?: string | null
          gateway: string
          gateway_payment_id: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          method?: string | null
          paid_at?: string | null
          price_id?: string | null
          refunded_cents?: number
          status?: Database["public"]["Enums"]["billing_payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_id?: string | null
          failure_reason?: string | null
          gateway?: string
          gateway_payment_id?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          method?: string | null
          paid_at?: string | null
          price_id?: string | null
          refunded_cents?: number
          status?: Database["public"]["Enums"]["billing_payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "catalog_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_id: string
          ended_at: string | null
          gateway: string | null
          gateway_subscription_id: string | null
          id: string
          metadata: Json
          payment_method_id: string | null
          price_id: string
          product_id: string
          scheduled_change_at: string | null
          scheduled_price_id: string | null
          status: Database["public"]["Enums"]["billing_subscription_status"]
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id: string
          ended_at?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          metadata?: Json
          payment_method_id?: string | null
          price_id: string
          product_id: string
          scheduled_change_at?: string | null
          scheduled_price_id?: string | null
          status?: Database["public"]["Enums"]["billing_subscription_status"]
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string
          ended_at?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          metadata?: Json
          payment_method_id?: string | null
          price_id?: string
          product_id?: string
          scheduled_change_at?: string | null
          scheduled_price_id?: string | null
          status?: Database["public"]["Enums"]["billing_subscription_status"]
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "billing_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "catalog_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_scheduled_price_id_fkey"
            columns: ["scheduled_price_id"]
            isOneToOne: false
            referencedRelation: "catalog_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_timeline: {
        Row: {
          amount_cents: number | null
          currency: string | null
          description: string | null
          event_id: string | null
          id: string
          kind: string
          occurred_at: string
          subscription_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          currency?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          kind: string
          occurred_at?: string
          subscription_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          currency?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          subscription_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_timeline_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_timeline_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_prices: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          currency: string
          display_label: string | null
          grants_credits: number
          id: string
          interval: Database["public"]["Enums"]["catalog_price_interval"]
          interval_count: number
          metadata: Json
          product_id: string
          replaces_price_id: string | null
          slug: string
          trial_days: number
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          currency?: string
          display_label?: string | null
          grants_credits?: number
          id?: string
          interval: Database["public"]["Enums"]["catalog_price_interval"]
          interval_count?: number
          metadata?: Json
          product_id: string
          replaces_price_id?: string | null
          slug: string
          trial_days?: number
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          currency?: string
          display_label?: string | null
          grants_credits?: number
          id?: string
          interval?: Database["public"]["Enums"]["catalog_price_interval"]
          interval_count?: number
          metadata?: Json
          product_id?: string
          replaces_price_id?: string | null
          slug?: string
          trial_days?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_prices_replaces_price_id_fkey"
            columns: ["replaces_price_id"]
            isOneToOne: false
            referencedRelation: "catalog_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_product_features: {
        Row: {
          created_at: string
          feature_key: string
          product_id: string
          quota: number | null
        }
        Insert: {
          created_at?: string
          feature_key: string
          product_id: string
          quota?: number | null
        }
        Update: {
          created_at?: string
          feature_key?: string
          product_id?: string
          quota?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_product_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "entitlement_features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "catalog_product_features_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["catalog_product_kind"]
          metadata: Json
          name: string
          slug: string
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["catalog_product_kind"]
          metadata?: Json
          name: string
          slug: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["catalog_product_kind"]
          metadata?: Json
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      community_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      community_chat_messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          category_id: string | null
          content: string
          created_at: string
          edited_at: string | null
          id: string
          image_url: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "community_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          emoji: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          emoji: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          actor_id: string | null
          aggregate_id: string | null
          aggregate_type: string
          id: string
          idempotency_key: string | null
          occurred_at: string
          payload: Json
          type: string
        }
        Insert: {
          actor_id?: string | null
          aggregate_id?: string | null
          aggregate_type: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          type: string
        }
        Update: {
          actor_id?: string | null
          aggregate_id?: string | null
          aggregate_type?: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          type?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          error: string | null
          id: string
          kind: string
          provider_id: string | null
          recipient: string
          ref: string | null
          sent_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          error?: string | null
          id?: string
          kind: string
          provider_id?: string | null
          recipient: string
          ref?: string | null
          sent_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          error?: string | null
          id?: string
          kind?: string
          provider_id?: string | null
          recipient?: string
          ref?: string | null
          sent_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      entitlement_features: {
        Row: {
          created_at: string
          description: string | null
          is_quota: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_quota?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_quota?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      entitlement_grants: {
        Row: {
          created_at: string
          expires_at: string | null
          feature_key: string
          granted_at: string
          id: string
          metadata: Json
          quota: number | null
          revoked_at: string | null
          source: Database["public"]["Enums"]["entitlement_source"]
          source_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          feature_key: string
          granted_at?: string
          id?: string
          metadata?: Json
          quota?: number | null
          revoked_at?: string | null
          source: Database["public"]["Enums"]["entitlement_source"]
          source_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          feature_key?: string
          granted_at?: string
          id?: string
          metadata?: Json
          quota?: number | null
          revoked_at?: string | null
          source?: Database["public"]["Enums"]["entitlement_source"]
          source_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_grants_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "entitlement_features"
            referencedColumns: ["key"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          consumer: string
          created_at: string
          event_id: string | null
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          consumer: string
          created_at?: string
          event_id?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          consumer?: string
          created_at?: string
          event_id?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          course_id: string
          created_at: string
          id: string
          last_watched_at: string
          lesson_id: string
          progress_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          course_id: string
          created_at?: string
          id?: string
          last_watched_at?: string
          lesson_id: string
          progress_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          course_id?: string
          created_at?: string
          id?: string
          last_watched_at?: string
          lesson_id?: string
          progress_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_transcript_chunks: {
        Row: {
          chunk_index: number
          content: string
          course_id: string
          course_title: string | null
          created_at: string
          embedding: string
          end_seconds: number | null
          id: string
          lesson_id: string
          lesson_title: string | null
          start_seconds: number | null
          transcript_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          course_id: string
          course_title?: string | null
          created_at?: string
          embedding: string
          end_seconds?: number | null
          id?: string
          lesson_id: string
          lesson_title?: string | null
          start_seconds?: number | null
          transcript_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          course_id?: string
          course_title?: string | null
          created_at?: string
          embedding?: string
          end_seconds?: number | null
          id?: string
          lesson_id?: string
          lesson_title?: string | null
          start_seconds?: number | null
          transcript_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_transcript_chunks_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "lesson_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_transcripts: {
        Row: {
          course_id: string
          course_title: string | null
          created_at: string
          duration_seconds: number | null
          error: string | null
          id: string
          language: string | null
          lesson_id: string
          lesson_title: string | null
          model: string | null
          status: string
          transcript: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          course_id: string
          course_title?: string | null
          created_at?: string
          duration_seconds?: number | null
          error?: string | null
          id?: string
          language?: string | null
          lesson_id: string
          lesson_title?: string | null
          model?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          course_id?: string
          course_title?: string | null
          created_at?: string
          duration_seconds?: number | null
          error?: string | null
          id?: string
          language?: string | null
          lesson_id?: string
          lesson_title?: string | null
          model?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      live_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          live_id: string
          pinned_at: string | null
          pinned_by: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          live_id: string
          pinned_at?: string | null
          pinned_by?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          live_id?: string
          pinned_at?: string | null
          pinned_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_participants: {
        Row: {
          banned: boolean
          banned_at: string | null
          cam_allowed: boolean
          connection_quality: string | null
          created_at: string
          hand_raised_at: string | null
          id: string
          invited_by: string | null
          invited_to_stage_at: string | null
          joined_at: string
          kicked_at: string | null
          left_at: string | null
          live_id: string
          mic_allowed: boolean
          on_stage: boolean
          role: Database["public"]["Enums"]["live_role"]
          room: Database["public"]["Enums"]["live_room_target"]
          screen_allowed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          banned?: boolean
          banned_at?: string | null
          cam_allowed?: boolean
          connection_quality?: string | null
          created_at?: string
          hand_raised_at?: string | null
          id?: string
          invited_by?: string | null
          invited_to_stage_at?: string | null
          joined_at?: string
          kicked_at?: string | null
          left_at?: string | null
          live_id: string
          mic_allowed?: boolean
          on_stage?: boolean
          role?: Database["public"]["Enums"]["live_role"]
          room?: Database["public"]["Enums"]["live_room_target"]
          screen_allowed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          banned?: boolean
          banned_at?: string | null
          cam_allowed?: boolean
          connection_quality?: string | null
          created_at?: string
          hand_raised_at?: string | null
          id?: string
          invited_by?: string | null
          invited_to_stage_at?: string | null
          joined_at?: string
          kicked_at?: string | null
          left_at?: string | null
          live_id?: string
          mic_allowed?: boolean
          on_stage?: boolean
          role?: Database["public"]["Enums"]["live_role"]
          room?: Database["public"]["Enums"]["live_room_target"]
          screen_allowed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_participants_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_poll_options: {
        Row: {
          created_at: string
          id: string
          label: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "live_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      live_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "live_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "live_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      live_polls: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          live_id: string
          opened_at: string | null
          question: string
          spotlight: boolean
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          live_id: string
          opened_at?: string | null
          question: string
          spotlight?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          live_id?: string
          opened_at?: string | null
          question?: string
          spotlight?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_polls_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_questions: {
        Row: {
          answered_at: string | null
          author_id: string
          body: string
          created_at: string
          highlighted_at: string | null
          id: string
          live_id: string
          status: string
          updated_at: string
          upvotes: number
        }
        Insert: {
          answered_at?: string | null
          author_id: string
          body: string
          created_at?: string
          highlighted_at?: string | null
          id?: string
          live_id: string
          status?: string
          updated_at?: string
          upvotes?: number
        }
        Update: {
          answered_at?: string | null
          author_id?: string
          body?: string
          created_at?: string
          highlighted_at?: string | null
          id?: string
          live_id?: string
          status?: string
          updated_at?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_questions_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          live_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          live_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          live_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stage_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          live_id: string
          payload: Json
          target_user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          live_id: string
          payload?: Json
          target_user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          live_id?: string
          payload?: Json
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_stage_events_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      lives: {
        Row: {
          backstage_started_at: string | null
          cf_live_input_id: string | null
          cf_playback_id: string | null
          cf_rtmps_url: string | null
          cf_stream_key: string | null
          cf_webrtc_url: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          enabled_modules: Json
          ended_at: string | null
          expert_id: string | null
          id: string
          livekit_room_prefix: string | null
          mode: Database["public"]["Enums"]["live_mode"]
          published_lesson_id: string | null
          recording_egress_id: string | null
          recording_filepath: string | null
          recording_started_at: string | null
          recording_stopped_at: string | null
          recording_video_uid: string | null
          replay_notified_at: string | null
          spotlight_user_id: string | null
          stage_layout: Database["public"]["Enums"]["live_stage_layout"]
          started_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["live_status"]
          stream_generation: number
          title: string
          updated_at: string
          visibility: string
          went_live_at: string | null
        }
        Insert: {
          backstage_started_at?: string | null
          cf_live_input_id?: string | null
          cf_playback_id?: string | null
          cf_rtmps_url?: string | null
          cf_stream_key?: string | null
          cf_webrtc_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          enabled_modules?: Json
          ended_at?: string | null
          expert_id?: string | null
          id?: string
          livekit_room_prefix?: string | null
          mode?: Database["public"]["Enums"]["live_mode"]
          published_lesson_id?: string | null
          recording_egress_id?: string | null
          recording_filepath?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          recording_video_uid?: string | null
          replay_notified_at?: string | null
          spotlight_user_id?: string | null
          stage_layout?: Database["public"]["Enums"]["live_stage_layout"]
          started_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["live_status"]
          stream_generation?: number
          title: string
          updated_at?: string
          visibility?: string
          went_live_at?: string | null
        }
        Update: {
          backstage_started_at?: string | null
          cf_live_input_id?: string | null
          cf_playback_id?: string | null
          cf_rtmps_url?: string | null
          cf_stream_key?: string | null
          cf_webrtc_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          enabled_modules?: Json
          ended_at?: string | null
          expert_id?: string | null
          id?: string
          livekit_room_prefix?: string | null
          mode?: Database["public"]["Enums"]["live_mode"]
          published_lesson_id?: string | null
          recording_egress_id?: string | null
          recording_filepath?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          recording_video_uid?: string | null
          replay_notified_at?: string | null
          spotlight_user_id?: string | null
          stage_layout?: Database["public"]["Enums"]["live_stage_layout"]
          started_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          stream_generation?: number
          title?: string
          updated_at?: string
          visibility?: string
          went_live_at?: string | null
        }
        Relationships: []
      }
      mm_short_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          short_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          short_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          short_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mm_short_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mm_short_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_short_comments_short_id_fkey"
            columns: ["short_id"]
            isOneToOne: false
            referencedRelation: "mm_shorts"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_short_likes: {
        Row: {
          created_at: string
          short_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          short_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          short_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mm_short_likes_short_id_fkey"
            columns: ["short_id"]
            isOneToOne: false
            referencedRelation: "mm_shorts"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_shorts: {
        Row: {
          author_id: string
          caption: string | null
          comments_count: number
          created_at: string
          id: string
          likes_count: number
          thumbnail_url: string | null
          updated_at: string
          video_url: string
          views_count: number
        }
        Insert: {
          author_id: string
          caption?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          likes_count?: number
          thumbnail_url?: string | null
          updated_at?: string
          video_url: string
          views_count?: number
        }
        Update: {
          author_id?: string
          caption?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          likes_count?: number
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string
          views_count?: number
        }
        Relationships: []
      }
      mm_studio_assets: {
        Row: {
          created_at: string
          credits_used: number
          format: string | null
          id: string
          kind: string
          metadata: Json
          product_id: string | null
          style: string | null
          thumb_url: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          format?: string | null
          id?: string
          kind: string
          metadata?: Json
          product_id?: string | null
          style?: string | null
          thumb_url?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          format?: string | null
          id?: string
          kind?: string
          metadata?: Json
          product_id?: string | null
          style?: string | null
          thumb_url?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mm_studio_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mm_studio_products"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_studio_brand: {
        Row: {
          audience: string | null
          brand_name: string | null
          colors: Json
          created_at: string
          description: string | null
          logo_url: string | null
          segment: string | null
          socials: Json
          tone: string | null
          typography: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          audience?: string | null
          brand_name?: string | null
          colors?: Json
          created_at?: string
          description?: string | null
          logo_url?: string | null
          segment?: string | null
          socials?: Json
          tone?: string | null
          typography?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          audience?: string | null
          brand_name?: string | null
          colors?: Json
          created_at?: string
          description?: string | null
          logo_url?: string | null
          segment?: string | null
          socials?: Json
          tone?: string | null
          typography?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      mm_studio_credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mm_studio_credits: {
        Row: {
          balance: number
          lifetime_granted: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          lifetime_granted?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          lifetime_granted?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mm_studio_products: {
        Row: {
          brand_colors: Json
          category: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          photos: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_colors?: Json
          category?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          photos?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_colors?: Json
          category?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          photos?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          category: string
          channel: string
          clicked_at: string | null
          context: Json
          created_at: string
          dedupe_key: string | null
          event_type: string | null
          id: string
          opened_at: string | null
          provider_id: string | null
          reason: string | null
          recipient: string
          resent_by: string | null
          resent_of: string | null
          status: string
          subject: string
          template_key: string
          user_id: string | null
        }
        Insert: {
          category?: string
          channel?: string
          clicked_at?: string | null
          context?: Json
          created_at?: string
          dedupe_key?: string | null
          event_type?: string | null
          id?: string
          opened_at?: string | null
          provider_id?: string | null
          reason?: string | null
          recipient: string
          resent_by?: string | null
          resent_of?: string | null
          status?: string
          subject: string
          template_key: string
          user_id?: string | null
        }
        Update: {
          category?: string
          channel?: string
          clicked_at?: string | null
          context?: Json
          created_at?: string
          dedupe_key?: string | null
          event_type?: string | null
          id?: string
          opened_at?: string | null
          provider_id?: string | null
          reason?: string | null
          recipient?: string
          resent_by?: string | null
          resent_of?: string | null
          status?: string
          subject?: string
          template_key?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          active: boolean
          body_html: string
          category: string
          channel: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          heading: string | null
          key: string
          locale: string
          preview_text: string
          subject: string
          text_body: string | null
          updated_at: string
          updated_by: string | null
          variables: Json
          version: number
        }
        Insert: {
          active?: boolean
          body_html: string
          category?: string
          channel?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          heading?: string | null
          key: string
          locale?: string
          preview_text?: string
          subject: string
          text_body?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
          version?: number
        }
        Update: {
          active?: boolean
          body_html?: string
          category?: string
          channel?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          heading?: string | null
          key?: string
          locale?: string
          preview_text?: string
          subject?: string
          text_body?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
          version?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          kind: string
          post_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          kind: string
          post_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          kind?: string
          post_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_heartbeats: {
        Row: {
          detail: Json
          duration_ms: number
          key: string
          last_run_at: string
          ok: boolean
          runs: number
        }
        Insert: {
          detail?: Json
          duration_ms?: number
          key: string
          last_run_at?: string
          ok?: boolean
          runs?: number
        }
        Update: {
          detail?: Json
          duration_ms?: number
          key?: string
          last_run_at?: string
          ok?: boolean
          runs?: number
        }
        Relationships: []
      }
      ops_webhook_log: {
        Row: {
          duration_ms: number | null
          error: string | null
          gateway: string
          gateway_payment_id: string | null
          id: string
          outcome: string
          received_at: string
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          gateway: string
          gateway_payment_id?: string | null
          id?: string
          outcome: string
          received_at?: string
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          gateway?: string
          gateway_payment_id?: string | null
          id?: string
          outcome?: string
          received_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          club_code_accepted_at: string | null
          cover_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          club_code_accepted_at?: string | null
          cover_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          club_code_accepted_at?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          category: string
          created_at: string
          dedupe_key: string | null
          detail: string | null
          id: string
          level: string
          metadata: Json
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          dedupe_key?: string | null
          detail?: string | null
          id?: string
          level?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          dedupe_key?: string | null
          detail?: string | null
          id?: string
          level?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_counters: {
        Row: {
          bucket: string
          count: number
          id: string
          subject: string
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          id?: string
          subject: string
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          id?: string
          subject?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      security_devices: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          fingerprint: string
          first_seen_at: string
          id: string
          last_ip: string | null
          last_seen_at: string
          os: string | null
          revoked_at: string | null
          trusted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_ip?: string | null
          last_seen_at?: string
          os?: string | null
          revoked_at?: string | null
          trusted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_ip?: string | null
          last_seen_at?: string
          os?: string | null
          revoked_at?: string | null
          trusted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          actor_email: string | null
          created_at: string
          id: string
          ip: string | null
          kind: string
          metadata: Json
          outcome: string
          reason: string | null
          route: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_email?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          kind: string
          metadata?: Json
          outcome?: string
          reason?: string | null
          route?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_email?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          kind?: string
          metadata?: Json
          outcome?: string
          reason?: string | null
          route?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_scans: {
        Row: {
          created_at: string
          findings: Json
          id: string
          score: number
          sections: Json
          trigger: string
        }
        Insert: {
          created_at?: string
          findings?: Json
          id?: string
          score?: number
          sections?: Json
          trigger?: string
        }
        Update: {
          created_at?: string
          findings?: Json
          id?: string
          score?: number
          sections?: Json
          trigger?: string
        }
        Relationships: []
      }
      security_sessions: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          ip: string | null
          last_seen_at: string
          revoked_at: string | null
          revoked_reason: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "security_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      security_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          entitlement: Database["public"]["Enums"]["content_visibility"]
          expires_at: string | null
          granted_at: string
          id: string
          source: string | null
          user_id: string
        }
        Insert: {
          entitlement: Database["public"]["Enums"]["content_visibility"]
          expires_at?: string | null
          granted_at?: string
          id?: string
          source?: string | null
          user_id: string
        }
        Update: {
          entitlement?: Database["public"]["Enums"]["content_visibility"]
          expires_at?: string | null
          granted_at?: string
          id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      billing_recovery_by_method: {
        Row: {
          attempts: number | null
          method: string | null
          recovered: number | null
          recovered_cents: number | null
        }
        Relationships: []
      }
      billing_recovery_by_phase: {
        Row: {
          attempts: number | null
          avg_seconds_to_recover: number | null
          phase: string | null
          recovered: number | null
          recovered_cents: number | null
        }
        Relationships: []
      }
      billing_recovery_by_reason: {
        Row: {
          attempts: number | null
          error_category: string | null
          gateway_error_code: string | null
          recovered: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_live: {
        Args: { _live_id: string; _user_id: string }
        Returns: boolean
      }
      extract_mention_user_ids: { Args: { _text: string }; Returns: string[] }
      has_feature: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_live_cohost: {
        Args: { _live_id: string; _user_id: string }
        Returns: boolean
      }
      is_live_publisher: {
        Args: { _live_id: string; _user_id: string }
        Returns: boolean
      }
      is_read_only_mode: { Args: never; Returns: boolean }
      match_lesson_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          content: string
          course_id: string
          course_title: string
          id: string
          lesson_id: string
          lesson_title: string
          similarity: number
        }[]
      }
      mm_short_increment_view: {
        Args: { _short_id: string }
        Returns: undefined
      }
      mm_studio_grant_credits: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      mm_studio_refund_credits: {
        Args: {
          _amount: number
          _reason: string
          _ref?: string
          _user_id: string
        }
        Returns: number
      }
      mm_studio_spend_credits: {
        Args: {
          _amount: number
          _reason: string
          _ref?: string
          _user_id: string
        }
        Returns: number
      }
      next_invoice_number: { Args: never; Returns: string }
      resolve_entitlements: {
        Args: { _user_id: string }
        Returns: {
          feature_key: string
          quota: number
          sources: string[]
        }[]
      }
      security_bump_counter: {
        Args: { _bucket: string; _subject: string; _window_seconds: number }
        Returns: number
      }
      security_posture_report: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      billing_invoice_status:
        | "draft"
        | "issued"
        | "paid"
        | "void"
        | "uncollectible"
        | "refunded"
      billing_ledger_direction: "debit" | "credit"
      billing_ledger_entry_type:
        | "payment"
        | "refund"
        | "chargeback"
        | "credit_granted"
        | "credit_consumed"
        | "adjustment"
        | "discount"
        | "tax"
        | "payout"
      billing_payment_status:
        | "pending"
        | "authorized"
        | "paid"
        | "failed"
        | "expired"
        | "canceled"
        | "refunded"
        | "partially_refunded"
        | "chargeback"
      billing_subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "grace_period"
        | "suspended"
        | "cancelled"
        | "expired"
      catalog_price_interval:
        | "day"
        | "week"
        | "month"
        | "year"
        | "one_time"
        | "lifetime"
      catalog_product_kind:
        | "subscription"
        | "course"
        | "event"
        | "credit_pack"
        | "certificate"
        | "addon"
        | "physical"
      content_visibility: "public" | "purchased" | "club" | "premium"
      entitlement_source:
        | "subscription"
        | "purchase"
        | "manual"
        | "gift"
        | "promo"
        | "signup"
      job_status: "pending" | "running" | "done" | "failed" | "dead"
      live_mode: "broadcast" | "interactive"
      live_role: "host" | "cohost" | "speaker" | "participant" | "viewer"
      live_room_target: "backstage" | "main"
      live_stage_layout: "solo" | "host_guest" | "spotlight" | "grid"
      live_status: "scheduled" | "live" | "ended" | "published"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      billing_invoice_status: [
        "draft",
        "issued",
        "paid",
        "void",
        "uncollectible",
        "refunded",
      ],
      billing_ledger_direction: ["debit", "credit"],
      billing_ledger_entry_type: [
        "payment",
        "refund",
        "chargeback",
        "credit_granted",
        "credit_consumed",
        "adjustment",
        "discount",
        "tax",
        "payout",
      ],
      billing_payment_status: [
        "pending",
        "authorized",
        "paid",
        "failed",
        "expired",
        "canceled",
        "refunded",
        "partially_refunded",
        "chargeback",
      ],
      billing_subscription_status: [
        "trialing",
        "active",
        "past_due",
        "grace_period",
        "suspended",
        "cancelled",
        "expired",
      ],
      catalog_price_interval: [
        "day",
        "week",
        "month",
        "year",
        "one_time",
        "lifetime",
      ],
      catalog_product_kind: [
        "subscription",
        "course",
        "event",
        "credit_pack",
        "certificate",
        "addon",
        "physical",
      ],
      content_visibility: ["public", "purchased", "club", "premium"],
      entitlement_source: [
        "subscription",
        "purchase",
        "manual",
        "gift",
        "promo",
        "signup",
      ],
      job_status: ["pending", "running", "done", "failed", "dead"],
      live_mode: ["broadcast", "interactive"],
      live_role: ["host", "cohost", "speaker", "participant", "viewer"],
      live_room_target: ["backstage", "main"],
      live_stage_layout: ["solo", "host_guest", "spotlight", "grid"],
      live_status: ["scheduled", "live", "ended", "published"],
    },
  },
} as const
