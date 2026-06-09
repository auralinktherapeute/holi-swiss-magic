export type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      therapists: {
        Row: {
          id: string;
          slug: string;
          display_name: string;
          bio: string | null;
          photo_url: string | null;
          canton_id: string | null;
          specialty_ids: string[] | null;
          price_per_session: number | null;
          languages: string[] | null;
          is_verified: boolean | null;
          plan: string | null;
          status: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["therapists"]["Row"]> & {
          slug: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["therapists"]["Row"]>;
        Relationships: [];
      };
      cantons: {
        Row: {
          id: string;
          code: string;
          name_fr: string;
          name_de: string;
          name_it: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cantons"]["Row"]> & {
          code: string;
          name_fr: string;
          name_de: string;
          name_it: string;
        };
        Update: Partial<Database["public"]["Tables"]["cantons"]["Row"]>;
        Relationships: [];
      };
      therapy_categories: {
        Row: {
          id: string;
          slug: string;
          name_fr: string;
          name_de: string;
          name_it: string;
          icon: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["therapy_categories"]["Row"]> & {
          slug: string;
          name_fr: string;
          name_de: string;
          name_it: string;
        };
        Update: Partial<Database["public"]["Tables"]["therapy_categories"]["Row"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          therapist_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reviews"]["Row"]> & {
          therapist_id: string;
          rating: number;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Row"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          therapist_id: string;
          patient_email: string;
          datetime: string;
          status: string;
        };
        Insert: Partial<Database["public"]["Tables"]["appointments"]["Row"]> & {
          therapist_id: string;
          patient_email: string;
          datetime: string;
          status: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];