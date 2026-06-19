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
      appointments: {
        Row: {
          appointment_date: string | null
          appointment_time: string | null
          created_at: string
          duration_minutes: number
          end_time: string | null
          id: string
          notes: string | null
          patient_email: string | null
          patient_name: string
          patient_phone: string | null
          service_name: string | null
          source: string
          start_time: string | null
          status: string
          therapist_id: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_time?: string | null
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          id?: string
          notes?: string | null
          patient_email?: string | null
          patient_name: string
          patient_phone?: string | null
          service_name?: string | null
          source?: string
          start_time?: string | null
          status?: string
          therapist_id: string
        }
        Update: {
          appointment_date?: string | null
          appointment_time?: string | null
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          id?: string
          notes?: string | null
          patient_email?: string | null
          patient_name?: string
          patient_phone?: string | null
          service_name?: string | null
          source?: string
          start_time?: string | null
          status?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      availabilities: {
        Row: {
          created_at: string
          day_of_week: number | null
          end_time: string
          id: string
          is_active: boolean
          specific_date: string | null
          start_time: string
          therapist_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          end_time: string
          id?: string
          is_active?: boolean
          specific_date?: string | null
          start_time: string
          therapist_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_active?: boolean
          specific_date?: string | null
          start_time?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availabilities_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availabilities_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_periods: {
        Row: {
          created_at: string
          end_date: string
          end_time: string | null
          id: string
          is_all_day: boolean
          reason: string | null
          start_date: string
          start_time: string | null
          therapist_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          end_time?: string | null
          id?: string
          is_all_day?: boolean
          reason?: string | null
          start_date: string
          start_time?: string | null
          therapist_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          end_time?: string | null
          id?: string
          is_all_day?: boolean
          reason?: string | null
          start_date?: string
          start_time?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_periods_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_periods_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          aliases: string[]
          canonical_name: string
          country: string
          created_at: string
          display_name: string
          id: string
          lat: number
          lng: number
        }
        Insert: {
          aliases?: string[]
          canonical_name: string
          country?: string
          created_at?: string
          display_name: string
          id?: string
          lat: number
          lng: number
        }
        Update: {
          aliases?: string[]
          canonical_name?: string
          country?: string
          created_at?: string
          display_name?: string
          id?: string
          lat?: number
          lng?: number
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          owner_id: string | null
          therapist_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          owner_id?: string | null
          therapist_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          owner_id?: string | null
          therapist_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_booking_at: string | null
          last_name: string
          next_booking_at: string | null
          phone: string | null
          private_notes: string | null
          relation_status: string
          session_type: string | null
          tags: string[]
          therapist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_booking_at?: string | null
          last_name: string
          next_booking_at?: string | null
          phone?: string | null
          private_notes?: string | null
          relation_status?: string
          session_type?: string | null
          tags?: string[]
          therapist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_booking_at?: string | null
          last_name?: string
          next_booking_at?: string | null
          phone?: string | null
          private_notes?: string | null
          relation_status?: string
          session_type?: string | null
          tags?: string[]
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_contacts_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_contacts_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          canton: string | null
          converted_therapist_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_contact_at: string | null
          last_name: string
          notes: string | null
          phone: string | null
          priority: string
          source: string
          specialty: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          canton?: string | null
          converted_therapist_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_contact_at?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          priority?: string
          source?: string
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          canton?: string | null
          converted_therapist_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_contact_at?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          priority?: string
          source?: string
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_converted_therapist_id_fkey"
            columns: ["converted_therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_converted_therapist_id_fkey"
            columns: ["converted_therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          owner_id?: string | null
          scope: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string | null
          scope: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          scope: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          scope?: string
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          created_at: string
          description: string | null
          done_at: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          owner_id: string | null
          priority: string
          therapist_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          therapist_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          therapist_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          created_at: string
          data: Json
          form_type: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          form_type: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          form_type?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          category: Database["public"]["Enums"]["event_category"]
          created_at: string
          enable_waitlist: boolean
          end_time: string | null
          event_date: string | null
          format: Database["public"]["Enums"]["event_format"]
          id: string
          image_url: string | null
          is_paid: boolean
          location: string | null
          long_description: string | null
          online_link: string | null
          price: number | null
          price_description: string | null
          reduced_price: number | null
          reduced_price_description: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seats: number | null
          short_description: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["event_status"]
          therapist_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["event_category"]
          created_at?: string
          enable_waitlist?: boolean
          end_time?: string | null
          event_date?: string | null
          format?: Database["public"]["Enums"]["event_format"]
          id?: string
          image_url?: string | null
          is_paid?: boolean
          location?: string | null
          long_description?: string | null
          online_link?: string | null
          price?: number | null
          price_description?: string | null
          reduced_price?: number | null
          reduced_price_description?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seats?: number | null
          short_description?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          therapist_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["event_category"]
          created_at?: string
          enable_waitlist?: boolean
          end_time?: string | null
          event_date?: string | null
          format?: Database["public"]["Enums"]["event_format"]
          id?: string
          image_url?: string | null
          is_paid?: boolean
          location?: string | null
          long_description?: string | null
          online_link?: string | null
          price?: number | null
          price_description?: string | null
          reduced_price?: number | null
          reduced_price_description?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seats?: number | null
          short_description?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          therapist_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          therapist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          therapist_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          therapist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          comment: string
          created_at: string
          id: string
          rating: number
          status: string
          therapist_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          comment: string
          created_at?: string
          id?: string
          rating: number
          status?: string
          therapist_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          comment?: string
          created_at?: string
          id?: string
          rating?: number
          status?: string
          therapist_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audit_history: {
        Row: {
          audit_date: string
          created_at: string
          critical_count: number
          geo_score: number
          global_score: number
          id: string
          resolved_count: number
          seo_score: number
          summary: Json | null
        }
        Insert: {
          audit_date: string
          created_at?: string
          critical_count?: number
          geo_score: number
          global_score: number
          id?: string
          resolved_count?: number
          seo_score: number
          summary?: Json | null
        }
        Update: {
          audit_date?: string
          created_at?: string
          critical_count?: number
          geo_score?: number
          global_score?: number
          id?: string
          resolved_count?: number
          seo_score?: number
          summary?: Json | null
        }
        Relationships: []
      }
      seo_findings: {
        Row: {
          action: string
          category: string
          code: string
          created_at: string
          description: string
          id: string
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action: string
          category: string
          code: string
          created_at?: string
          description: string
          id?: string
          priority: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action?: string
          category?: string
          code?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      therapist_documents: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          is_public: boolean
          label: string | null
          therapist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          is_public?: boolean
          label?: string | null
          therapist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          is_public?: boolean
          label?: string | null
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_documents_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_documents_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_private_identifiers: {
        Row: {
          created_at: string
          id: string
          ide: string | null
          siret: string | null
          therapist_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ide?: string | null
          siret?: string | null
          therapist_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ide?: string | null
          siret?: string | null
          therapist_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_private_identifiers_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_identifiers_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapists: {
        Row: {
          accreditations: Json
          address: string | null
          approaches: string[] | null
          bio: string | null
          booking_note: string | null
          canton: string | null
          city: string | null
          consultation_modes: string[] | null
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          first_name: string
          gallery_urls: Json
          geom: unknown
          google_reviews_url: string | null
          id: string
          ide_verified: boolean
          insurance_accepted: boolean | null
          languages: string[] | null
          last_name: string
          latitude: number | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          price_max: number | null
          price_min: number | null
          services: Json
          short_bio: string | null
          siret_verified: boolean
          slug: string
          specialties: string[] | null
          status: string
          subscription_plan: string
          title: string | null
          updated_at: string
          user_id: string
          verified: boolean
          website: string | null
          years_experience: number | null
        }
        Insert: {
          accreditations?: Json
          address?: string | null
          approaches?: string[] | null
          bio?: string | null
          booking_note?: string | null
          canton?: string | null
          city?: string | null
          consultation_modes?: string[] | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          first_name: string
          gallery_urls?: Json
          geom?: unknown
          google_reviews_url?: string | null
          id?: string
          ide_verified?: boolean
          insurance_accepted?: boolean | null
          languages?: string[] | null
          last_name: string
          latitude?: number | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          price_max?: number | null
          price_min?: number | null
          services?: Json
          short_bio?: string | null
          siret_verified?: boolean
          slug: string
          specialties?: string[] | null
          status?: string
          subscription_plan?: string
          title?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          website?: string | null
          years_experience?: number | null
        }
        Update: {
          accreditations?: Json
          address?: string | null
          approaches?: string[] | null
          bio?: string | null
          booking_note?: string | null
          canton?: string | null
          city?: string | null
          consultation_modes?: string[] | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          first_name?: string
          gallery_urls?: Json
          geom?: unknown
          google_reviews_url?: string | null
          id?: string
          ide_verified?: boolean
          insurance_accepted?: boolean | null
          languages?: string[] | null
          last_name?: string
          latitude?: number | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          price_max?: number | null
          price_min?: number | null
          services?: Json
          short_bio?: string | null
          siret_verified?: boolean
          slug?: string
          specialties?: string[] | null
          status?: string
          subscription_plan?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          website?: string | null
          years_experience?: number | null
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
      waiting_list: {
        Row: {
          accepted_terms: boolean | null
          canton: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          message: string | null
          phone: string | null
          source: string
          specialty: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_terms?: boolean | null
          canton?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          message?: string | null
          phone?: string | null
          source?: string
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_terms?: boolean | null
          canton?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          message?: string | null
          phone?: string | null
          source?: string
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_blocked_periods: {
        Row: {
          end_date: string | null
          end_time: string | null
          is_all_day: boolean | null
          start_date: string | null
          start_time: string | null
          therapist_id: string | null
        }
        Insert: {
          end_date?: string | null
          end_time?: string | null
          is_all_day?: boolean | null
          start_date?: string | null
          start_time?: string | null
          therapist_id?: string | null
        }
        Update: {
          end_date?: string | null
          end_time?: string | null
          is_all_day?: boolean | null
          start_date?: string | null
          start_time?: string | null
          therapist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_periods_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_periods_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapists_public: {
        Row: {
          accreditations: Json | null
          address: string | null
          approaches: string[] | null
          bio: string | null
          canton: string | null
          city: string | null
          consultation_modes: string[] | null
          country: string | null
          created_at: string | null
          currency: string | null
          first_name: string | null
          google_reviews_url: string | null
          id: string | null
          ide_verified: boolean | null
          insurance_accepted: boolean | null
          languages: string[] | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
          photo_url: string | null
          postal_code: string | null
          price_max: number | null
          price_min: number | null
          services: Json | null
          short_bio: string | null
          siret_verified: boolean | null
          slug: string | null
          specialties: string[] | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
          website: string | null
          years_experience: number | null
        }
        Insert: {
          accreditations?: Json | null
          address?: string | null
          approaches?: string[] | null
          bio?: string | null
          canton?: string | null
          city?: string | null
          consultation_modes?: string[] | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          first_name?: string | null
          google_reviews_url?: string | null
          id?: string | null
          ide_verified?: boolean | null
          insurance_accepted?: boolean | null
          languages?: string[] | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          photo_url?: string | null
          postal_code?: string | null
          price_max?: number | null
          price_min?: number | null
          services?: Json | null
          short_bio?: string | null
          siret_verified?: boolean | null
          slug?: string | null
          specialties?: string[] | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
          years_experience?: number | null
        }
        Update: {
          accreditations?: Json | null
          address?: string | null
          approaches?: string[] | null
          bio?: string | null
          canton?: string | null
          city?: string | null
          consultation_modes?: string[] | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          first_name?: string | null
          google_reviews_url?: string | null
          id?: string | null
          ide_verified?: boolean | null
          insurance_accepted?: boolean | null
          languages?: string[] | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          photo_url?: string | null
          postal_code?: string | null
          price_max?: number | null
          price_min?: number | null
          services?: Json | null
          short_bio?: string | null
          siret_verified?: boolean | null
          slug?: string | null
          specialties?: string[] | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_badge_counts: { Args: never; Returns: Json }
      crm_daily_maintenance: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_elite_pro: { Args: { _user_id: string }; Returns: boolean }
      normalize_city_text: { Args: { _input: string }; Returns: string }
      notify_admin_event: {
        Args: {
          _kind: string
          _link?: string
          _subject: string
          _summary: string
        }
        Returns: undefined
      }
      resolve_city: {
        Args: { _input: string }
        Returns: {
          canonical_name: string
          display_name: string
          lat: number
          lng: number
        }[]
      }
      therapist_review_stats: { Args: { _therapist_id: string }; Returns: Json }
      therapists_within_radius: {
        Args: { _lat: number; _lng: number; _radius_m?: number }
        Returns: {
          canton: string
          city: string
          currency: string
          distance_m: number
          first_name: string
          id: string
          last_name: string
          latitude: number
          longitude: number
          photo_url: string
          price_max: number
          price_min: number
          short_bio: string
          slug: string
          specialties: string[]
          title: string
          verified: boolean
        }[]
      }
      waiting_list_count: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "therapist" | "user"
      event_category:
        | "atelier"
        | "conference"
        | "retraite"
        | "cercle"
        | "meditation"
        | "autre"
      event_format: "in_person" | "online" | "hybrid"
      event_status: "draft" | "pending_review" | "published" | "rejected"
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
      app_role: ["admin", "moderator", "therapist", "user"],
      event_category: [
        "atelier",
        "conference",
        "retraite",
        "cercle",
        "meditation",
        "autre",
      ],
      event_format: ["in_person", "online", "hybrid"],
      event_status: ["draft", "pending_review", "published", "rejected"],
    },
  },
} as const
