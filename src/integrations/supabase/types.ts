export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      therapists: {
        Row: {
          id: string
          user_id: string | null
          slug: string
          display_name: string
          bio: string | null
          photo_url: string | null
          canton_id: string | null
          specialty_ids: string[] | null
          price_per_session: number | null
          languages: string[] | null
          is_verified: boolean | null
          plan: string | null
          status: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          slug: string
          display_name: string
          bio?: string | null
          photo_url?: string | null
          canton_id?: string | null
          specialty_ids?: string[] | null
          price_per_session?: number | null
          languages?: string[] | null
          is_verified?: boolean | null
          plan?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          slug?: string
          display_name?: string
          bio?: string | null
          photo_url?: string | null
          canton_id?: string | null
          specialty_ids?: string[] | null
          price_per_session?: number | null
          languages?: string[] | null
          is_verified?: boolean | null
          plan?: string | null
          status?: string | null
        }
        Relationships: []
      }
      cantons: {
        Row: {
          id: string
          code: string
          name_fr: string
          name_de: string
          name_it: string
        }
        Insert: {
          id?: string
          code: string
          name_fr: string
          name_de: string
          name_it: string
        }
        Update: {
          id?: string
          code?: string
          name_fr?: string
          name_de?: string
          name_it?: string
        }
        Relationships: []
      }
      therapy_categories: {
        Row: {
          id: string
          slug: string
          name_fr: string
          name_de: string
          name_it: string
          icon: string | null
        }
        Insert: {
          id?: string
          slug: string
          name_fr: string
          name_de: string
          name_it: string
          icon?: string | null
        }
        Update: {
          id?: string
          slug?: string
          name_fr?: string
          name_de?: string
          name_it?: string
          icon?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          therapist_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          therapist_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          therapist_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          therapist_id: string
          patient_email: string
          datetime: string
          status: string
        }
        Insert: {
          id?: string
          therapist_id: string
          patient_email: string
          datetime: string
          status: string
        }
        Update: {
          id?: string
          therapist_id?: string
          patient_email?: string
          datetime?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof Database["public"]["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof Database["public"]["CompositeTypes"]
    ? Database["public"]["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
