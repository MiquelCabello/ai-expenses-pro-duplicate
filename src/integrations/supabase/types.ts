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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          can_add_custom_categories: boolean
          can_assign_department: boolean
          can_assign_region: boolean
          can_assign_roles: boolean
          created_at: string
          id: string
          monthly_expense_limit: number | null
          max_employees: number | null
          name: string
          owner_user_id: string
          plan: Database["public"]["Enums"]["account_plan"]
          updated_at: string
        }
        Insert: {
          can_add_custom_categories?: boolean
          can_assign_department?: boolean
          can_assign_region?: boolean
          can_assign_roles?: boolean
          created_at?: string
          id?: string
          monthly_expense_limit?: number | null
          max_employees?: number | null
          name: string
          owner_user_id: string
          plan?: Database["public"]["Enums"]["account_plan"]
          updated_at?: string
        }
        Update: {
          can_add_custom_categories?: boolean
          can_assign_department?: boolean
          can_assign_region?: boolean
          can_assign_roles?: boolean
          created_at?: string
          id?: string
          monthly_expense_limit?: number | null
          max_employees?: number | null
          name?: string
          owner_user_id?: string
          plan?: Database["public"]["Enums"]["account_plan"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          account_id: string
          action: string
          actor_user_id: string
          created_at: string
          entity: string
          entity_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
        }
        Insert: {
          account_id: string
          action: string
          actor_user_id: string
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Update: {
          account_id?: string
          action?: string
          actor_user_id?: string
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {
        Row: {
          account_id: string
          budget_monthly: number | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          budget_monthly?: number | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          budget_monthly?: number | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          account_id: string
          amount_gross: number
          amount_net: number
          approved_at: string | null
          approver_id: string | null
          category_id: string
          created_at: string
          currency: string
          employee_id: string
          expense_date: string
          hash_dedupe: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          project_code_id: string | null
          receipt_file_id: string | null
          rejection_reason: string | null
          source: Database["public"]["Enums"]["expense_source"]
          status: Database["public"]["Enums"]["expense_status"]
          tax_vat: number | null
          updated_at: string
          vendor: string
        }
        Insert: {
          account_id: string
          amount_gross: number
          amount_net: number
          approved_at?: string | null
          approver_id?: string | null
          category_id: string
          created_at?: string
          currency?: string
          employee_id: string
          expense_date: string
          hash_dedupe: string
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          project_code_id?: string | null
          receipt_file_id?: string | null
          rejection_reason?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
          status?: Database["public"]["Enums"]["expense_status"]
          tax_vat?: number | null
          updated_at?: string
          vendor: string
        }
        Update: {
          account_id?: string
          amount_gross?: number
          amount_net?: number
          approved_at?: string | null
          approver_id?: string | null
          category_id?: string
          created_at?: string
          currency?: string
          employee_id?: string
          expense_date?: string
          hash_dedupe?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          project_code_id?: string | null
          receipt_file_id?: string | null
          rejection_reason?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
          status?: Database["public"]["Enums"]["expense_status"]
          tax_vat?: number | null
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_code_id_fkey"
            columns: ["project_code_id"]
            isOneToOne: false
            referencedRelation: "project_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_receipt_file_id_fkey"
            columns: ["receipt_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          account_id: string
          checksum_sha256: string
          created_at: string
          id: string
          metadata: Json | null
          mime_type: string
          original_name: string
          size_bytes: number
          storage_key: string
          uploaded_by: string
        }
        Insert: {
          account_id: string
          checksum_sha256: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mime_type: string
          original_name: string
          size_bytes: number
          storage_key: string
          uploaded_by: string
        }
        Update: {
          account_id?: string
          checksum_sha256?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_key?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          account_id: string
          created_at: string
          department: string | null
          id: string
          name: string
          region: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          department?: string | null
          id?: string
          name: string
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      project_codes: {
        Row: {
          account_id: string
          code: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          code: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_codes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: { _uid: string }
        Returns: boolean
      }
      is_master_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      plan_settings: {
        Args: { _plan: Database["public"]["Enums"]["account_plan"] }
        Returns: {
          max_employees: number | null
          can_assign_roles: boolean
          can_assign_department: boolean
          can_assign_region: boolean
          can_add_custom_categories: boolean
          monthly_expense_limit: number | null
        }[]
      }
    }
    Enums: {
      account_plan: "FREE" | "PROFESSIONAL" | "ENTERPRISE"
      expense_source: "MANUAL" | "AI_EXTRACTED"
      expense_status: "PENDING" | "APPROVED" | "REJECTED"
      payment_method: "CARD" | "CASH" | "TRANSFER" | "OTHER"
      project_status: "ACTIVE" | "INACTIVE"
      user_role: "ADMIN" | "EMPLOYEE"
      user_status: "ACTIVE" | "INACTIVE"
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
      expense_source: ["MANUAL", "AI_EXTRACTED"],
      expense_status: ["PENDING", "APPROVED", "REJECTED"],
      payment_method: ["CARD", "CASH", "TRANSFER", "OTHER"],
      project_status: ["ACTIVE", "INACTIVE"],
      user_role: ["ADMIN", "EMPLOYEE"],
      user_status: ["ACTIVE", "INACTIVE"],
    },
  },
} as const
