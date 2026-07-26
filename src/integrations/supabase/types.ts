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
          created_at: string
          destination: string
          destination_type: Database["public"]["Enums"]["endpoint_type"]
          enabled: boolean
          exclude_keywords: string[]
          forward_delay: number
          forwarded_count: number
          id: string
          include_keywords: string[]
          max_forward_count: number | null
          name: string | null
          source: string
          source_type: Database["public"]["Enums"]["endpoint_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination: string
          destination_type?: Database["public"]["Enums"]["endpoint_type"]
          enabled?: boolean
          exclude_keywords?: string[]
          forward_delay?: number
          forwarded_count?: number
          id?: string
          include_keywords?: string[]
          max_forward_count?: number | null
          name?: string | null
          source: string
          source_type?: Database["public"]["Enums"]["endpoint_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination?: string
          destination_type?: Database["public"]["Enums"]["endpoint_type"]
          enabled?: boolean
          exclude_keywords?: string[]
          forward_delay?: number
          forwarded_count?: number
          id?: string
          include_keywords?: string[]
          max_forward_count?: number | null
          name?: string | null
          source?: string
          source_type?: Database["public"]["Enums"]["endpoint_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
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
