export type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      therapists: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          first_name: string;
          last_name: string;
          title: string | null;
          short_bio: string | null;
          bio: string | null;
          photo_url: string | null;
          specialties: string[] | null;
          approaches: string[] | null;
          languages: string[] | null;
          address: string | null;
          postal_code: string | null;
          city: string | null;
          canton: string | null;
          country: string | null;
          latitude: number | null;
          longitude: number | null;
          consultation_modes: string[] | null;
          price_min: number | null;
          price_max: number | null;
          currency: string | null;
          insurance_accepted: boolean | null;
          email: string | null;
          phone: string | null;
          website: string | null;
          status: string;
          verified: boolean;
          meta_title: string | null;
          meta_description: string | null;
          booking_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["therapists"]["Row"]> & {
          user_id: string;
          slug: string;
          first_name: string;
          last_name: string;
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
          patient_name: string;
          patient_email: string | null;
          patient_phone: string | null;
          appointment_date: string | null;
          appointment_time: string | null;
          duration_minutes: number;
          status: string;
          notes: string | null;
          start_time: string | null;
          end_time: string | null;
          service_name: string | null;
          source: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["appointments"]["Row"]> & {
          therapist_id: string;
          patient_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
        Relationships: [];
      };
      availabilities: {
        Row: {
          id: string;
          therapist_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["availabilities"]["Row"]> & {
          therapist_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: Partial<Database["public"]["Tables"]["availabilities"]["Row"]>;
        Relationships: [];
      };
      blocked_periods: {
        Row: {
          id: string;
          therapist_id: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["blocked_periods"]["Row"]> & {
          therapist_id: string;
          start_date: string;
          end_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocked_periods"]["Row"]>;
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
