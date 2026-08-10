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
      current_work: {
        Row: {
          feature_description: string | null
          feature_title: string
          id: number
          started_at: string
          updated_at: string
        }
        Insert: {
          feature_description?: string | null
          feature_title: string
          id: number
          started_at?: string
          updated_at?: string
        }
        Update: {
          feature_description?: string | null
          feature_title?: string
          id?: number
          started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          action_slug: string | null
          created_at: string
          email: string | null
          hidden: boolean
          id: string
          launch_notified_at: string | null
          moscow: string
          notify_on_launch: boolean
          organization: string | null
          priority_rank: number | null
          role: string | null
          shipped_at: string | null
          state: string | null
          status: string
          wish: string
        }
        Insert: {
          action_slug?: string | null
          created_at?: string
          email?: string | null
          hidden?: boolean
          id?: string
          launch_notified_at?: string | null
          moscow?: string
          notify_on_launch?: boolean
          organization?: string | null
          priority_rank?: number | null
          role?: string | null
          shipped_at?: string | null
          state?: string | null
          status?: string
          wish: string
        }
        Update: {
          action_slug?: string | null
          created_at?: string
          email?: string | null
          hidden?: boolean
          id?: string
          launch_notified_at?: string | null
          moscow?: string
          notify_on_launch?: boolean
          organization?: string | null
          priority_rank?: number | null
          role?: string | null
          shipped_at?: string | null
          state?: string | null
          status?: string
          wish?: string
        }
        Relationships: []
      }
      game_feedback: {
        Row: {
          created_at: string
          description: string
          id: string
          implemented_at: string | null
          rank: number
          status: string
          submitter_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          implemented_at?: string | null
          rank?: number
          status?: string
          submitter_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          implemented_at?: string | null
          rank?: number
          status?: string
          submitter_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_improvement_pool: {
        Row: {
          baseline_pain: string
          code_hook: string
          created_at: string
          description: string
          key: string
          label: string
        }
        Insert: {
          baseline_pain: string
          code_hook: string
          created_at?: string
          description: string
          key: string
          label: string
        }
        Update: {
          baseline_pain?: string
          code_hook?: string
          created_at?: string
          description?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      game_scores: {
        Row: {
          created_at: string
          display_name: string
          duration_ms: number
          id: string
          mode: string
          score: number
        }
        Insert: {
          created_at?: string
          display_name: string
          duration_ms: number
          id?: string
          mode: string
          score: number
        }
        Update: {
          created_at?: string
          display_name?: string
          duration_ms?: number
          id?: string
          mode?: string
          score?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          bio: string | null
          created_at: string
          full_name: string
          hidden: boolean
          id: string
          photo_path: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          full_name: string
          hidden?: boolean
          id?: string
          photo_path?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          full_name?: string
          hidden?: boolean
          id?: string
          photo_path?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      versions: {
        Row: {
          id: string
          is_current: boolean
          notes: string | null
          released_at: string
          semver: string
          snapshot: Json | null
          title: string
        }
        Insert: {
          id?: string
          is_current?: boolean
          notes?: string | null
          released_at?: string
          semver: string
          snapshot?: Json | null
          title: string
        }
        Update: {
          id?: string
          is_current?: boolean
          notes?: string | null
          released_at?: string
          semver?: string
          snapshot?: Json | null
          title?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          bucket: string
          created_at: string
          feedback_id: string
          id: string
          voter_fingerprint: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          feedback_id: string
          id?: string
          voter_fingerprint: string
        }
        Update: {
          bucket?: string
          created_at?: string
          feedback_id?: string
          id?: string
          voter_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      feedback_public: {
        Row: {
          action_slug: string | null
          created_at: string | null
          id: string | null
          moscow: string | null
          priority_rank: number | null
          shipped_at: string | null
          status: string | null
          wish: string | null
        }
        Insert: {
          action_slug?: string | null
          created_at?: string | null
          id?: string | null
          moscow?: string | null
          priority_rank?: number | null
          shipped_at?: string | null
          status?: string | null
          wish?: string | null
        }
        Update: {
          action_slug?: string | null
          created_at?: string | null
          id?: string | null
          moscow?: string | null
          priority_rank?: number | null
          shipped_at?: string | null
          status?: string | null
          wish?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_my_votes: {
        Args: { _voter_fingerprint: string }
        Returns: {
          bucket: string
          feedback_id: string
          id: string
        }[]
      }
      remove_vote: {
        Args: {
          _bucket: string
          _feedback_id: string
          _voter_fingerprint: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
