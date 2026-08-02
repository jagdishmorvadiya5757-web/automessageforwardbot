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
      claim_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          duration_days: number
          id: string
          max_uses: number
          note: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          id?: string
          max_uses?: number
          note?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          id?: string
          max_uses?: number
          note?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          counterparty_id: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          counterparty_id?: string | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          counterparty_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          created_at: string
          credits_awarded: number
          day: string
          id: string
          streak: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_awarded?: number
          day?: string
          id?: string
          streak?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits_awarded?: number
          day?: string
          id?: string
          streak?: number
          user_id?: string
        }
        Relationships: []
      }
      forwarding_logs: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          rule_id: string | null
          source_msg_ref: string | null
          status: Database["public"]["Enums"]["forward_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          rule_id?: string | null
          source_msg_ref?: string | null
          status: Database["public"]["Enums"]["forward_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          rule_id?: string | null
          source_msg_ref?: string | null
          status?: Database["public"]["Enums"]["forward_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forwarding_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "forwarding_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarding_rules: {
        Row: {
          ai_rewrite: boolean
          auto_join: boolean
          block_media: boolean
          created_at: string
          crypto_mode: boolean
          destination: string
          destination_type: Database["public"]["Enums"]["endpoint_type"]
          enabled: boolean
          exclude_keywords: string[]
          footer_text: string | null
          forward_delay: number
          forwarded_count: number
          header_text: string | null
          id: string
          include_keywords: string[]
          max_forward_count: number | null
          name: string | null
          replacements: Json
          sender_blacklist: string[]
          sender_whitelist: string[]
          source: string
          source_type: Database["public"]["Enums"]["endpoint_type"]
          strip_forward_tag: boolean
          translate_to: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_rewrite?: boolean
          auto_join?: boolean
          block_media?: boolean
          created_at?: string
          crypto_mode?: boolean
          destination: string
          destination_type?: Database["public"]["Enums"]["endpoint_type"]
          enabled?: boolean
          exclude_keywords?: string[]
          footer_text?: string | null
          forward_delay?: number
          forwarded_count?: number
          header_text?: string | null
          id?: string
          include_keywords?: string[]
          max_forward_count?: number | null
          name?: string | null
          replacements?: Json
          sender_blacklist?: string[]
          sender_whitelist?: string[]
          source: string
          source_type?: Database["public"]["Enums"]["endpoint_type"]
          strip_forward_tag?: boolean
          translate_to?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_rewrite?: boolean
          auto_join?: boolean
          block_media?: boolean
          created_at?: string
          crypto_mode?: boolean
          destination?: string
          destination_type?: Database["public"]["Enums"]["endpoint_type"]
          enabled?: boolean
          exclude_keywords?: string[]
          footer_text?: string | null
          forward_delay?: number
          forwarded_count?: number
          header_text?: string | null
          id?: string
          include_keywords?: string[]
          max_forward_count?: number | null
          name?: string | null
          replacements?: Json
          sender_blacklist?: string[]
          sender_whitelist?: string[]
          source?: string
          source_type?: Database["public"]["Enums"]["endpoint_type"]
          strip_forward_tag?: boolean
          translate_to?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      license_keys: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          duration_days: number
          id: string
          note: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          redeemed_at: string | null
          redeemed_by: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          id?: string
          note?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          redeemed_at?: string | null
          redeemed_by?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          id?: string
          note?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          redeemed_at?: string | null
          redeemed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          duration_days: number
          id: string
          name: string
          payment_link: string | null
          period: string
          perks: string[]
          plan: Database["public"]["Enums"]["subscription_plan"]
          price: string
          slug: string
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          duration_days?: number
          id?: string
          name: string
          payment_link?: string | null
          period?: string
          perks?: string[]
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price?: string
          slug: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          duration_days?: number
          id?: string
          name?: string
          payment_link?: string | null
          period?: string
          perks?: string[]
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          referral_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          referral_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          referral_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          credits_awarded: number
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          credits_awarded?: number
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          credits_awarded?: number
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          plan: Database["public"]["Enums"]["subscription_plan"]
          subscription_ends_at: string | null
          trial_ends_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_ends_at?: string | null
          trial_ends_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_ends_at?: string | null
          trial_ends_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_auth: {
        Row: {
          code: string | null
          created_at: string
          detail: string | null
          id: string
          pending_action: string | null
          phone: string | null
          phone_code_hash: string | null
          status: string
          two_fa_password: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          pending_action?: string | null
          phone?: string | null
          phone_code_hash?: string | null
          status?: string
          two_fa_password?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          pending_action?: string | null
          phone?: string | null
          phone_code_hash?: string | null
          status?: string
          two_fa_password?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_channels: {
        Row: {
          can_post: boolean
          chat_id: string
          created_at: string
          id: string
          kind: string
          title: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          can_post?: boolean
          chat_id: string
          created_at?: string
          id?: string
          kind?: string
          title: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          can_post?: boolean
          chat_id?: string
          created_at?: string
          id?: string
          kind?: string
          title?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_sessions: {
        Row: {
          created_at: string
          id: string
          phone: string | null
          session_ciphertext: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone?: string | null
          session_ciphertext?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string | null
          session_ciphertext?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          lifetime_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          lifetime_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          lifetime_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      worker_health: {
        Row: {
          active_clients: number
          detail: string | null
          id: number
          last_heartbeat: string | null
          queued_messages: number
          started_at: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          active_clients?: number
          detail?: string | null
          id?: number
          last_heartbeat?: string | null
          queued_messages?: number
          started_at?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          active_clients?: number
          detail?: string | null
          id?: number
          last_heartbeat?: string | null
          queued_messages?: number
          started_at?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      worker_tokens: {
        Row: {
          created_at: string
          id: string
          last_heartbeat: string | null
          token_hash: string
          token_preview: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_heartbeat?: string | null
          token_hash: string
          token_preview?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_heartbeat?: string | null
          token_hash?: string
          token_preview?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_credits: {
        Args: {
          _amount: number
          _counterparty?: string
          _kind: string
          _note?: string
          _user_id: string
        }
        Returns: number
      }
      claim_license_key: {
        Args: { _code: string }
        Returns: {
          duration_days: number
          license_code: string
          message: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          success: boolean
        }[]
      }
      daily_checkin: {
        Args: { _user_id: string }
        Returns: {
          balance: number
          credits: number
          message: string
          streak: number
          success: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_subscription_active: { Args: { _user_id: string }; Returns: boolean }
      record_forwarded_count: {
        Args: { _rule_id: string; _user_id: string }
        Returns: {
          enabled: boolean
          forwarded_count: number
          max_forward_count: number
        }[]
      }
      redeem_license_key: {
        Args: { _code: string; _user_id: string }
        Returns: {
          ends_at: string
          message: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          success: boolean
        }[]
      }
      redeem_referral: {
        Args: { _code: string; _referred: string }
        Returns: {
          credits: number
          message: string
          success: boolean
        }[]
      }
      release_forwarding_slot: {
        Args: { _rule_id: string; _user_id: string }
        Returns: {
          enabled: boolean
          forwarded_count: number
        }[]
      }
      reserve_forwarding_slot: {
        Args: { _rule_id: string; _user_id: string }
        Returns: {
          allowed: boolean
          disabled: boolean
          forwarded_count: number
          max_forward_count: number
        }[]
      }
      transfer_credits: {
        Args: { _amount: number; _from: string; _note?: string; _to: string }
        Returns: {
          balance: number
          message: string
          success: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      endpoint_type: "channel" | "bot"
      forward_status: "forwarded" | "skipped" | "error" | "waiting"
      subscription_plan: "trial" | "pro" | "business" | "expired"
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
      app_role: ["admin", "user"],
      endpoint_type: ["channel", "bot"],
      forward_status: ["forwarded", "skipped", "error", "waiting"],
      subscription_plan: ["trial", "pro", "business", "expired"],
    },
  },
} as const
