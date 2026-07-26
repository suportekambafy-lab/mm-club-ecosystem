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
          expert_id: string | null
          id: string
          livekit_room_prefix: string | null
          mode: Database["public"]["Enums"]["live_mode"]
          published_lesson_id: string | null
          recording_video_uid: string | null
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
          expert_id?: string | null
          id?: string
          livekit_room_prefix?: string | null
          mode?: Database["public"]["Enums"]["live_mode"]
          published_lesson_id?: string | null
          recording_video_uid?: string | null
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
          expert_id?: string | null
          id?: string
          livekit_room_prefix?: string | null
          mode?: Database["public"]["Enums"]["live_mode"]
          published_lesson_id?: string | null
          recording_video_uid?: string | null
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
      mm_credit_orders: {
        Row: {
          amount_eur: number
          created_at: string
          credits: number
          fulfilled_at: string | null
          id: string
          pack_id: string
          provider: string
          provider_payment_id: string
          raw: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_eur: number
          created_at?: string
          credits: number
          fulfilled_at?: string | null
          id?: string
          pack_id: string
          provider?: string
          provider_payment_id: string
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_eur?: number
          created_at?: string
          credits?: number
          fulfilled_at?: string | null
          id?: string
          pack_id?: string
          provider?: string
          provider_payment_id?: string
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mm_mollie_subscriptions: {
        Row: {
          amount_eur: number
          created_at: string
          first_payment_id: string
          id: string
          interval: string
          mollie_customer_id: string
          mollie_mandate_id: string | null
          mollie_subscription_id: string | null
          plan_id: string
          raw: Json | null
          starts_at: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_eur: number
          created_at?: string
          first_payment_id: string
          id?: string
          interval?: string
          mollie_customer_id: string
          mollie_mandate_id?: string | null
          mollie_subscription_id?: string | null
          plan_id: string
          raw?: Json | null
          starts_at?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_eur?: number
          created_at?: string
          first_payment_id?: string
          id?: string
          interval?: string
          mollie_customer_id?: string
          mollie_mandate_id?: string | null
          mollie_subscription_id?: string | null
          plan_id?: string
          raw?: Json | null
          starts_at?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
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
      paddle_customers: {
        Row: {
          created_at: string
          email: string
          environment: string
          paddle_customer_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          environment?: string
          paddle_customer_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          environment?: string
          paddle_customer_id?: string
          updated_at?: string
          user_id?: string | null
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          scheduled_change_action: string | null
          scheduled_change_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          scheduled_change_action?: string | null
          scheduled_change_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          scheduled_change_action?: string | null
          scheduled_change_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
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
      [_ in never]: never
    }
    Functions: {
      can_access_live: {
        Args: { _live_id: string; _user_id: string }
        Returns: boolean
      }
      extract_mention_user_ids: { Args: { _text: string }; Returns: string[] }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      content_visibility: "public" | "purchased" | "club" | "premium"
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
      content_visibility: ["public", "purchased", "club", "premium"],
      live_mode: ["broadcast", "interactive"],
      live_role: ["host", "cohost", "speaker", "participant", "viewer"],
      live_room_target: ["backstage", "main"],
      live_stage_layout: ["solo", "host_guest", "spotlight", "grid"],
      live_status: ["scheduled", "live", "ended", "published"],
    },
  },
} as const
