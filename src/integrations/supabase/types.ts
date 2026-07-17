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
      live_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          live_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          live_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          live_id?: string
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
      lives: {
        Row: {
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
          expert_id: string | null
          id: string
          published_lesson_id: string | null
          recording_video_uid: string | null
          starts_at: string
          status: Database["public"]["Enums"]["live_status"]
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
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
          expert_id?: string | null
          id?: string
          published_lesson_id?: string | null
          recording_video_uid?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["live_status"]
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
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
          expert_id?: string | null
          id?: string
          published_lesson_id?: string | null
          recording_video_uid?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          title?: string
          updated_at?: string
          visibility?: string
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
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
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
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
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
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
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
      mm_short_increment_view: {
        Args: { _short_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      content_visibility: "public" | "purchased" | "club" | "premium"
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
      live_status: ["scheduled", "live", "ended", "published"],
    },
  },
} as const
