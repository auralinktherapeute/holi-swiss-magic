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
      accounting_exports: {
        Row: {
          created_at: string
          created_by: string | null
          export_type: string
          file_names: Json
          id: string
          invoice_count: number
          payment_count: number
          period_end: string
          period_start: string
          therapist_id: string
          total_size_bytes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          export_type: string
          file_names?: Json
          id?: string
          invoice_count?: number
          payment_count?: number
          period_end: string
          period_start: string
          therapist_id: string
          total_size_bytes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          export_type?: string
          file_names?: Json
          id?: string
          invoice_count?: number
          payment_count?: number
          period_end?: string
          period_start?: string
          therapist_id?: string
          total_size_bytes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_exports_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_exports_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_pulse: {
        Row: {
          created_at: string
          event: string
          id: number
          node_id: string
          source_table: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: never
          node_id: string
          source_table: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: never
          node_id?: string
          source_table?: string
        }
        Relationships: []
      }
      admin_section_reads: {
        Row: {
          created_at: string
          last_seen_at: string
          section: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string
          section: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string
          section?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      appointment_status_history: {
        Row: {
          appointment_id: string
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string
          previous_status: string | null
          reason: string | null
          therapist_id: string
        }
        Insert: {
          appointment_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: string
          previous_status?: string | null
          reason?: string | null
          therapist_id: string
        }
        Update: {
          appointment_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string | null
          appointment_time: string | null
          billing_excluded_at: string | null
          billing_exclusion_reason: string | null
          cancellation_reason: string | null
          client_id: string | null
          created_at: string
          duration_minutes: number
          end_time: string | null
          expected_price: number | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          notes: string | null
          patient_email: string | null
          patient_name: string
          patient_phone: string | null
          service_name: string | null
          source: string
          start_time: string | null
          status: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_time?: string | null
          billing_excluded_at?: string | null
          billing_exclusion_reason?: string | null
          cancellation_reason?: string | null
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          expected_price?: number | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          notes?: string | null
          patient_email?: string | null
          patient_name: string
          patient_phone?: string | null
          service_name?: string | null
          source?: string
          start_time?: string | null
          status?: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string | null
          appointment_time?: string | null
          billing_excluded_at?: string | null
          billing_exclusion_reason?: string | null
          cancellation_reason?: string | null
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          expected_price?: number | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          notes?: string | null
          patient_email?: string | null
          patient_name?: string
          patient_phone?: string | null
          service_name?: string | null
          source?: string
          start_time?: string | null
          status?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
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
      article_categories: {
        Row: {
          created_at: string
          id: string
          name_de: string
          name_en: string
          name_fr: string
          name_it: string
          parent_category: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_de?: string
          name_en?: string
          name_fr: string
          name_it?: string
          parent_category?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_de?: string
          name_en?: string
          name_fr?: string
          name_it?: string
          parent_category?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      article_suggestions: {
        Row: {
          categorie: string | null
          created_at: string
          id: string
          notes: string | null
          priorite: number
          requete_geo: string | null
          source: string
          status: string
          sujet: string
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          priorite?: number
          requete_geo?: string | null
          source?: string
          status?: string
          sujet: string
        }
        Update: {
          categorie?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          priorite?: number
          requete_geo?: string | null
          source?: string
          status?: string
          sujet?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          author_id: string | null
          body_de: string | null
          body_en: string | null
          body_fr: string
          body_it: string | null
          category: string | null
          cover_image_url: string | null
          created_at: string
          excerpt_de: string | null
          excerpt_en: string | null
          excerpt_fr: string | null
          excerpt_it: string | null
          id: string
          image_alt_text: string | null
          lang: string
          meta_description_de: string | null
          meta_description_en: string | null
          meta_description_fr: string | null
          meta_description_it: string | null
          meta_title_de: string | null
          meta_title_en: string | null
          meta_title_fr: string | null
          meta_title_it: string | null
          published_at: string | null
          secondary_tags: string[]
          slug: string
          slug_de: string | null
          status: string
          title_de: string | null
          title_en: string | null
          title_fr: string
          title_it: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_de?: string | null
          body_en?: string | null
          body_fr: string
          body_it?: string | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt_de?: string | null
          excerpt_en?: string | null
          excerpt_fr?: string | null
          excerpt_it?: string | null
          id?: string
          image_alt_text?: string | null
          lang?: string
          meta_description_de?: string | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          meta_description_it?: string | null
          meta_title_de?: string | null
          meta_title_en?: string | null
          meta_title_fr?: string | null
          meta_title_it?: string | null
          published_at?: string | null
          secondary_tags?: string[]
          slug: string
          slug_de?: string | null
          status?: string
          title_de?: string | null
          title_en?: string | null
          title_fr: string
          title_it?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_de?: string | null
          body_en?: string | null
          body_fr?: string
          body_it?: string | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt_de?: string | null
          excerpt_en?: string | null
          excerpt_fr?: string | null
          excerpt_it?: string | null
          id?: string
          image_alt_text?: string | null
          lang?: string
          meta_description_de?: string | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          meta_description_it?: string | null
          meta_title_de?: string | null
          meta_title_en?: string | null
          meta_title_fr?: string | null
          meta_title_it?: string | null
          published_at?: string | null
          secondary_tags?: string[]
          slug?: string
          slug_de?: string | null
          status?: string
          title_de?: string | null
          title_en?: string | null
          title_fr?: string
          title_it?: string | null
          updated_at?: string
        }
        Relationships: []
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
      billing_services: {
        Row: {
          category: string | null
          created_at: string
          currency: string
          description: string | null
          duration_min: number
          id: string
          internal_code: string | null
          is_active: boolean
          name: string
          position: number
          price: number
          tariff_position_id: string | null
          therapist_id: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          id?: string
          internal_code?: string | null
          is_active?: boolean
          name: string
          position?: number
          price?: number
          tariff_position_id?: string | null
          therapist_id: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          id?: string
          internal_code?: string | null
          is_active?: boolean
          name?: string
          position?: number
          price?: number
          tariff_position_id?: string | null
          therapist_id?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_services_tariff_position_id_fkey"
            columns: ["tariff_position_id"]
            isOneToOne: false
            referencedRelation: "tariff_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_services_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_services_therapist_id_fkey"
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
      charter_acceptances: {
        Row: {
          accepted_at: string
          charter_version: string
          family_id: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          charter_version?: string
          family_id: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          charter_version?: string
          family_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charter_acceptances_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "therapist_families"
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
          slug: string | null
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
          slug?: string | null
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
          slug?: string | null
        }
        Relationships: []
      }
      client_package_sessions: {
        Row: {
          appointment_id: string | null
          client_package_id: string
          commentaire: string | null
          created_at: string
          date_decompte: string
          id: string
          therapist_id: string
          type_seance_reelle: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_package_id: string
          commentaire?: string | null
          created_at?: string
          date_decompte?: string
          id?: string
          therapist_id: string
          type_seance_reelle?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_package_id?: string
          commentaire?: string | null
          created_at?: string
          date_decompte?: string
          id?: string
          therapist_id?: string
          type_seance_reelle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_package_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_sessions_client_package_id_fkey"
            columns: ["client_package_id"]
            isOneToOne: false
            referencedRelation: "client_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packages: {
        Row: {
          client_id: string
          created_at: string
          date_achat: string
          date_expiration: string | null
          id: string
          nombre_seances_utilisees: number
          notes: string | null
          package_id: string
          statut: string
          statut_paiement: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date_achat?: string
          date_expiration?: string | null
          id?: string
          nombre_seances_utilisees?: number
          notes?: string | null
          package_id: string
          statut?: string
          statut_paiement?: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date_achat?: string
          date_expiration?: string | null
          id?: string
          nombre_seances_utilisees?: number
          notes?: string | null
          package_id?: string
          statut?: string
          statut_paiement?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_questionnaire_responses: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          date_soumission: string
          id: string
          patient_email: string | null
          patient_name: string | null
          questionnaire_id: string
          reponses: Json
          statut: string
          therapist_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          date_soumission?: string
          id?: string
          patient_email?: string | null
          patient_name?: string | null
          questionnaire_id: string
          reponses?: Json
          statut?: string
          therapist_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          date_soumission?: string
          id?: string
          patient_email?: string | null
          patient_name?: string | null
          questionnaire_id?: string
          reponses?: Json
          statut?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_questionnaire_responses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_questionnaire_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_questionnaire_responses_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_questionnaire_responses_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_questionnaire_responses_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          family_id: string
          flagged_reason: string | null
          id: string
          is_flagged: boolean
          moderated_at: string | null
          moderation_severity: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          family_id: string
          flagged_reason?: string | null
          id?: string
          is_flagged?: boolean
          moderated_at?: string | null
          moderation_severity?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          family_id?: string
          flagged_reason?: string | null
          id?: string
          is_flagged?: boolean
          moderated_at?: string | null
          moderation_severity?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "therapist_families"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_access_log: {
        Row: {
          action: string
          actor_user_id: string
          context: string | null
          entity_id: string | null
          entity_type: string
          id: string
          occurred_at: string
          therapist_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          context?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          occurred_at?: string
          therapist_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          context?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          occurred_at?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_access_log_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_access_log_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
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
          address_line1: string | null
          address_line2: string | null
          canton: string | null
          city: string | null
          consent_at: string | null
          consent_source: string | null
          country: string
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_booking_at: string | null
          last_name: string
          legal_basis: string
          next_booking_at: string | null
          payment_link: string | null
          phone: string | null
          postal_code: string | null
          preferred_document_language: string
          private_notes: string | null
          relation_status: string
          retention_until: string | null
          session_type: string | null
          tags: string[]
          therapist_id: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          canton?: string | null
          city?: string | null
          consent_at?: string | null
          consent_source?: string | null
          country?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_booking_at?: string | null
          last_name: string
          legal_basis?: string
          next_booking_at?: string | null
          payment_link?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_document_language?: string
          private_notes?: string | null
          relation_status?: string
          retention_until?: string | null
          session_type?: string | null
          tags?: string[]
          therapist_id: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          canton?: string | null
          city?: string | null
          consent_at?: string | null
          consent_source?: string | null
          country?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_booking_at?: string | null
          last_name?: string
          legal_basis?: string
          next_booking_at?: string | null
          payment_link?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_document_language?: string
          private_notes?: string | null
          relation_status?: string
          retention_until?: string | null
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
      crm_field_history: {
        Row: {
          changed_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          origin: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          origin?: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          origin?: string
        }
        Relationships: []
      }
      crm_intake_submissions: {
        Row: {
          allergies: string | null
          birth_date: string | null
          consent_at: string | null
          consent_rgpd: boolean
          consent_signature: string | null
          consultation_reason: string | null
          converted_contact_id: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          medical_history: string | null
          medications: string | null
          phone: string | null
          status: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          birth_date?: string | null
          consent_at?: string | null
          consent_rgpd?: boolean
          consent_signature?: string | null
          consultation_reason?: string | null
          converted_contact_id?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          medical_history?: string | null
          medications?: string | null
          phone?: string | null
          status?: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          birth_date?: string | null
          consent_at?: string | null
          consent_rgpd?: boolean
          consent_signature?: string | null
          consultation_reason?: string | null
          converted_contact_id?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          medical_history?: string | null
          medications?: string | null
          phone?: string | null
          status?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_intake_submissions_converted_contact_id_fkey"
            columns: ["converted_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_intake_submissions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_intake_submissions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          canton: string | null
          converted_therapist_id: string | null
          created_at: string
          dedup_status: string
          email: string | null
          email_norm: string | null
          first_name: string
          id: string
          last_contact_at: string | null
          last_name: string
          merged_at: string | null
          merged_into_id: string | null
          name_norm: string | null
          notes: string | null
          phone: string | null
          phone_norm: string | null
          priority: string
          source: string
          specialty: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          canton?: string | null
          converted_therapist_id?: string | null
          created_at?: string
          dedup_status?: string
          email?: string | null
          email_norm?: string | null
          first_name: string
          id?: string
          last_contact_at?: string | null
          last_name: string
          merged_at?: string | null
          merged_into_id?: string | null
          name_norm?: string | null
          notes?: string | null
          phone?: string | null
          phone_norm?: string | null
          priority?: string
          source?: string
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          canton?: string | null
          converted_therapist_id?: string | null
          created_at?: string
          dedup_status?: string
          email?: string | null
          email_norm?: string | null
          first_name?: string
          id?: string
          last_contact_at?: string | null
          last_name?: string
          merged_at?: string | null
          merged_into_id?: string | null
          name_norm?: string | null
          notes?: string | null
          phone?: string | null
          phone_norm?: string | null
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
          {
            foreignKeyName: "crm_leads_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_merge_log: {
        Row: {
          created_at: string
          id: string
          merged_lead_ids: string[]
          performed_by: string | null
          primary_lead_id: string
          reassigned: Json
          reverted_at: string | null
          reverted_by: string | null
          snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          merged_lead_ids: string[]
          performed_by?: string | null
          primary_lead_id: string
          reassigned?: Json
          reverted_at?: string | null
          reverted_by?: string | null
          snapshot: Json
        }
        Update: {
          created_at?: string
          id?: string
          merged_lead_ids?: string[]
          performed_by?: string | null
          primary_lead_id?: string
          reassigned?: Json
          reverted_at?: string | null
          reverted_by?: string | null
          snapshot?: Json
        }
        Relationships: []
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
      crm_session_notes: {
        Row: {
          contact_id: string
          content: string | null
          created_at: string
          id: string
          session_date: string
          soap_assessment: string | null
          soap_objective: string | null
          soap_plan: string | null
          soap_subjective: string | null
          template: string
          therapist_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          contact_id: string
          content?: string | null
          created_at?: string
          id?: string
          session_date?: string
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          template?: string
          therapist_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          content?: string | null
          created_at?: string
          id?: string
          session_date?: string
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          template?: string
          therapist_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_session_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_session_notes_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_session_notes_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
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
          contact_id: string | null
          created_at: string
          description: string | null
          done: boolean
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
          contact_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
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
          contact_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
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
            foreignKeyName: "crm_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
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
      diploma_verification_history: {
        Row: {
          action_type: string
          diploma_id: string
          id: string
          new_status: string
          note: string | null
          performed_at: string
          performed_by: string | null
          previous_status: string | null
          reason: string | null
          therapist_id: string | null
        }
        Insert: {
          action_type: string
          diploma_id: string
          id?: string
          new_status: string
          note?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_status?: string | null
          reason?: string | null
          therapist_id?: string | null
        }
        Update: {
          action_type?: string
          diploma_id?: string
          id?: string
          new_status?: string
          note?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_status?: string | null
          reason?: string | null
          therapist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diploma_verification_history_diploma_id_fkey"
            columns: ["diploma_id"]
            isOneToOne: false
            referencedRelation: "therapist_certifications"
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
      email_logs: {
        Row: {
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string
          sent_by: string | null
          status: string
          subject: string | null
          template_id: string
          waitlist_id: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string | null
          template_id: string
          waitlist_id?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string | null
          template_id?: string
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waiting_list"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_history: {
        Row: {
          accounting_export_id: string | null
          attachment_names: Json
          bounced_at: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          email_type: string
          error_message: string | null
          from_email: string | null
          from_name: string | null
          id: string
          invoice_id: string | null
          language: string | null
          reply_to: string | null
          resend_email_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          therapist_id: string | null
          to_email: string
          updated_at: string
        }
        Insert: {
          accounting_export_id?: string | null
          attachment_names?: Json
          bounced_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          email_type: string
          error_message?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          invoice_id?: string | null
          language?: string | null
          reply_to?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          therapist_id?: string | null
          to_email: string
          updated_at?: string
        }
        Update: {
          accounting_export_id?: string | null
          attachment_names?: Json
          bounced_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          email_type?: string
          error_message?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          invoice_id?: string | null
          language?: string | null
          reply_to?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          therapist_id?: string | null
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_history_accounting_export_id_fkey"
            columns: ["accounting_export_id"]
            isOneToOne: false
            referencedRelation: "accounting_exports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_history_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_history_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
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
      featured_therapist: {
        Row: {
          id: number
          therapist_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          therapist_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          therapist_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_therapist_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_therapist_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_seat_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          note: string | null
          seat_number: number | null
          source: string | null
          therapist_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          note?: string | null
          seat_number?: number | null
          source?: string | null
          therapist_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          note?: string | null
          seat_number?: number | null
          source?: string | null
          therapist_id?: string
        }
        Relationships: []
      }
      founder_seats: {
        Row: {
          granted_at: string
          granted_by: string | null
          note: string | null
          revoked_at: string | null
          seat_number: number
          source: string
          status: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          revoked_at?: string | null
          seat_number: number
          source?: string
          status?: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          revoked_at?: string | null
          seat_number?: number
          source?: string
          status?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_seats_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_seats_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_access_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          invoice_id: string
          last_viewed_at: string | null
          revoked_at: string | null
          therapist_id: string
          token_hash: string
          updated_at: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          invoice_id: string
          last_viewed_at?: string | null
          revoked_at?: string | null
          therapist_id: string
          token_hash: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          invoice_id?: string
          last_viewed_at?: string | null
          revoked_at?: string | null
          therapist_id?: string
          token_hash?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_access_tokens_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_access_tokens_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_access_tokens_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          total: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          total?: number | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          total?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          id: string
          invoice_id: string
          new_status: string
          note: string | null
          previous_status: string | null
          reason: string | null
          therapist_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          new_status: string
          note?: string | null
          previous_status?: string | null
          reason?: string | null
          therapist_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          new_status?: string
          note?: string | null
          previous_status?: string | null
          reason?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_status_history_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_status_history_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_address: string | null
          client_name: string
          contact_id: string | null
          created_at: string
          currency: string
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          notes: string | null
          payment_link: string | null
          payment_method_ids: string[]
          status: string
          therapist_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_address?: string | null
          client_name: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          notes?: string | null
          payment_link?: string | null
          payment_method_ids?: string[]
          status?: string
          therapist_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          client_address?: string | null
          client_name?: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          notes?: string | null
          payment_link?: string | null
          payment_method_ids?: string[]
          status?: string
          therapist_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_agent_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          skills_used: string[] | null
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          skills_used?: string[] | null
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          skills_used?: string[] | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_agent_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "marketing_agent_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_agent_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_proposals: {
        Row: {
          angle: string | null
          caption: string
          caption_de: string | null
          caption_en: string | null
          caption_it: string | null
          carousel_generation_version: number
          carousel_page_count: number | null
          carousel_presentation: string | null
          correction_note: string | null
          created_at: string
          external_ref: string | null
          format: string | null
          hashtags: string | null
          hashtags_de: string | null
          hashtags_en: string | null
          hashtags_it: string | null
          id: string
          lang: string
          network: string
          pillar: string | null
          proposal_date: string
          published_at: string | null
          score: number | null
          source: string
          status: string
          suggested_time: string | null
          topic_id: string | null
          updated_at: string
          validated_at: string | null
          visual_brief: string | null
          visual_prompt: string | null
        }
        Insert: {
          angle?: string | null
          caption: string
          caption_de?: string | null
          caption_en?: string | null
          caption_it?: string | null
          carousel_generation_version?: number
          carousel_page_count?: number | null
          carousel_presentation?: string | null
          correction_note?: string | null
          created_at?: string
          external_ref?: string | null
          format?: string | null
          hashtags?: string | null
          hashtags_de?: string | null
          hashtags_en?: string | null
          hashtags_it?: string | null
          id?: string
          lang?: string
          network: string
          pillar?: string | null
          proposal_date?: string
          published_at?: string | null
          score?: number | null
          source?: string
          status?: string
          suggested_time?: string | null
          topic_id?: string | null
          updated_at?: string
          validated_at?: string | null
          visual_brief?: string | null
          visual_prompt?: string | null
        }
        Update: {
          angle?: string | null
          caption?: string
          caption_de?: string | null
          caption_en?: string | null
          caption_it?: string | null
          carousel_generation_version?: number
          carousel_page_count?: number | null
          carousel_presentation?: string | null
          correction_note?: string | null
          created_at?: string
          external_ref?: string | null
          format?: string | null
          hashtags?: string | null
          hashtags_de?: string | null
          hashtags_en?: string | null
          hashtags_it?: string | null
          id?: string
          lang?: string
          network?: string
          pillar?: string | null
          proposal_date?: string
          published_at?: string | null
          score?: number | null
          source?: string
          status?: string
          suggested_time?: string | null
          topic_id?: string | null
          updated_at?: string
          validated_at?: string | null
          visual_brief?: string | null
          visual_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_proposals_topic_fk"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "marketing_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_topics: {
        Row: {
          created_at: string
          format: string | null
          id: string
          network: string | null
          note: string | null
          processed_at: string | null
          reject_reason: string | null
          status: string
          subject: string
          submitted_by: string
          target_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          format?: string | null
          id?: string
          network?: string | null
          note?: string | null
          processed_at?: string | null
          reject_reason?: string | null
          status?: string
          subject: string
          submitted_by?: string
          target_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          format?: string | null
          id?: string
          network?: string | null
          note?: string | null
          processed_at?: string | null
          reject_reason?: string | null
          status?: string
          subject?: string
          submitted_by?: string
          target_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      moderation_reports: {
        Row: {
          created_at: string
          excerpt: string | null
          family_id: string | null
          id: string
          message_id: string | null
          report_md: string | null
          rule: string | null
          severity: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          excerpt?: string | null
          family_id?: string | null
          id?: string
          message_id?: string | null
          report_md?: string | null
          rule?: string | null
          severity?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          excerpt?: string | null
          family_id?: string | null
          id?: string
          message_id?: string | null
          report_md?: string | null
          rule?: string | null
          severity?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_reports_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "therapist_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "community_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_issues: {
        Row: {
          action_difficulty: string | null
          action_label: string | null
          action_minutes: number | null
          audience: string | null
          canonical_url: string | null
          connection_notes: string | null
          connection_priority: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          cta: string | null
          email_body: string | null
          email_button_label: string | null
          email_button_url: string | null
          email_footer: string | null
          email_intro: string | null
          email_preheader: string | null
          email_subject: string | null
          feature_highlight: string | null
          feature_key: string | null
          id: string
          internal_notes: string | null
          lang: string
          linked_article_id: string | null
          linked_article_kind: string | null
          linked_resource_slug: string | null
          meta_description: string | null
          objective: string | null
          pillar: string | null
          problem: string | null
          published_at: string | null
          qc_checklist: Json
          resource_body: string | null
          resource_checklist: string | null
          resource_cta: string | null
          resource_example: string | null
          resource_intro: string | null
          resource_sections: string | null
          resource_takeaway: string | null
          resource_title: string | null
          segment_key: string | null
          seo_title: string | null
          share_image_url: string | null
          slug: string | null
          status: string
          target_date: string | null
          target_route: string | null
          title: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          action_difficulty?: string | null
          action_label?: string | null
          action_minutes?: number | null
          audience?: string | null
          canonical_url?: string | null
          connection_notes?: string | null
          connection_priority?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          cta?: string | null
          email_body?: string | null
          email_button_label?: string | null
          email_button_url?: string | null
          email_footer?: string | null
          email_intro?: string | null
          email_preheader?: string | null
          email_subject?: string | null
          feature_highlight?: string | null
          feature_key?: string | null
          id?: string
          internal_notes?: string | null
          lang?: string
          linked_article_id?: string | null
          linked_article_kind?: string | null
          linked_resource_slug?: string | null
          meta_description?: string | null
          objective?: string | null
          pillar?: string | null
          problem?: string | null
          published_at?: string | null
          qc_checklist?: Json
          resource_body?: string | null
          resource_checklist?: string | null
          resource_cta?: string | null
          resource_example?: string | null
          resource_intro?: string | null
          resource_sections?: string | null
          resource_takeaway?: string | null
          resource_title?: string | null
          segment_key?: string | null
          seo_title?: string | null
          share_image_url?: string | null
          slug?: string | null
          status?: string
          target_date?: string | null
          target_route?: string | null
          title: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          action_difficulty?: string | null
          action_label?: string | null
          action_minutes?: number | null
          audience?: string | null
          canonical_url?: string | null
          connection_notes?: string | null
          connection_priority?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          cta?: string | null
          email_body?: string | null
          email_button_label?: string | null
          email_button_url?: string | null
          email_footer?: string | null
          email_intro?: string | null
          email_preheader?: string | null
          email_subject?: string | null
          feature_highlight?: string | null
          feature_key?: string | null
          id?: string
          internal_notes?: string | null
          lang?: string
          linked_article_id?: string | null
          linked_article_kind?: string | null
          linked_resource_slug?: string | null
          meta_description?: string | null
          objective?: string | null
          pillar?: string | null
          problem?: string | null
          published_at?: string | null
          qc_checklist?: Json
          resource_body?: string | null
          resource_checklist?: string | null
          resource_cta?: string | null
          resource_example?: string | null
          resource_intro?: string | null
          resource_sections?: string | null
          resource_takeaway?: string | null
          resource_title?: string | null
          segment_key?: string | null
          seo_title?: string | null
          share_image_url?: string | null
          slug?: string | null
          status?: string
          target_date?: string | null
          target_route?: string | null
          title?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_revisions: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          comment: string | null
          created_at: string
          id: string
          issue_id: string
          status: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          issue_id: string
          status?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          issue_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_revisions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "newsletter_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_send_events: {
        Row: {
          created_at: string
          detail: string | null
          event_type: string
          id: string
          occurred_at: string
          provider_event_id: string
          provider_message_id: string | null
          recipient_id: string | null
          send_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          provider_event_id: string
          provider_message_id?: string | null
          recipient_id?: string | null
          send_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          provider_event_id?: string
          provider_message_id?: string | null
          recipient_id?: string | null
          send_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_send_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "newsletter_send_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_send_events_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "newsletter_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_send_recipients: {
        Row: {
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          email: string
          error_message: string | null
          id: string
          last_event_at: string | null
          last_event_type: string | null
          opened_at: string | null
          provider_message_id: string | null
          send_id: string
          status: string
          therapist_id: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          last_event_at?: string | null
          last_event_type?: string | null
          opened_at?: string | null
          provider_message_id?: string | null
          send_id: string
          status?: string
          therapist_id?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          last_event_at?: string | null
          last_event_type?: string | null
          opened_at?: string | null
          provider_message_id?: string | null
          send_id?: string
          status?: string
          therapist_id?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_send_recipients_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "newsletter_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_sends: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          bounced_count: number
          clicked_count: number
          complained_count: number
          delivered_count: number
          details_purged_at: string | null
          error_message: string | null
          failed_count: number
          finished_at: string | null
          from_address: string | null
          id: string
          is_test: boolean
          issue_id: string
          last_event_at: string | null
          opened_count: number
          queued_at: string | null
          recipient_count: number
          resource_url: string | null
          segment: string
          sent_count: number
          started_at: string
          status: string
          subject: string | null
          unsubscribed_count: number
          version_label: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          bounced_count?: number
          clicked_count?: number
          complained_count?: number
          delivered_count?: number
          details_purged_at?: string | null
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          from_address?: string | null
          id?: string
          is_test?: boolean
          issue_id: string
          last_event_at?: string | null
          opened_count?: number
          queued_at?: string | null
          recipient_count?: number
          resource_url?: string | null
          segment: string
          sent_count?: number
          started_at?: string
          status?: string
          subject?: string | null
          unsubscribed_count?: number
          version_label?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          bounced_count?: number
          clicked_count?: number
          complained_count?: number
          delivered_count?: number
          details_purged_at?: string | null
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          from_address?: string | null
          id?: string
          is_test?: boolean
          issue_id?: string
          last_event_at?: string | null
          opened_count?: number
          queued_at?: string | null
          recipient_count?: number
          resource_url?: string | null
          segment?: string
          sent_count?: number
          started_at?: string
          status?: string
          subject?: string | null
          unsubscribed_count?: number
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "newsletter_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          consent_version: string | null
          created_at: string
          email: string
          id: string
          locale: string
          opt_in: boolean
          opt_in_at: string
          source: string
          therapist_id: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          consent_version?: string | null
          created_at?: string
          email: string
          id?: string
          locale?: string
          opt_in?: boolean
          opt_in_at?: string
          source?: string
          therapist_id?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          consent_version?: string | null
          created_at?: string
          email?: string
          id?: string
          locale?: string
          opt_in?: boolean
          opt_in_at?: string
          source?: string
          therapist_id?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_subscribers_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_suggestions: {
        Row: {
          audience: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          feature_key: string | null
          id: string
          issue_id: string | null
          objective: string | null
          pillar: string | null
          priority: string
          rationale: string | null
          source: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          audience?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          feature_key?: string | null
          id?: string
          issue_id?: string | null
          objective?: string | null
          pillar?: string | null
          priority?: string
          rationale?: string | null
          source?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          audience?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          feature_key?: string | null
          id?: string
          issue_id?: string | null
          objective?: string | null
          pillar?: string | null
          priority?: string
          rationale?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_suggestions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "newsletter_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error_message: string | null
          id: string
          notification_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          target: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          target: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          dispatch_request_id: number | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          kind: string
          link: string | null
          read_at: string | null
          subject: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          dispatch_request_id?: number | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          kind: string
          link?: string | null
          read_at?: string | null
          subject: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          dispatch_request_id?: number | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          link?: string | null
          read_at?: string | null
          subject?: string
          summary?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          session_id: string | null
          user_id: string | null
          user_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          session_id?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_assignments: {
        Row: {
          created_at: string
          id: string
          package_id: string | null
          questionnaire_id: string
          service_type_id: string | null
          therapist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id?: string | null
          questionnaire_id: string
          service_type_id?: string | null
          therapist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string | null
          questionnaire_id?: string
          service_type_id?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_assignments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_assignments_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_assignments_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_assignments_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_questions: {
        Row: {
          created_at: string
          id: string
          obligatoire: boolean
          options: Json | null
          ordre: number
          question: string
          questionnaire_id: string
          type_reponse: string
        }
        Insert: {
          created_at?: string
          id?: string
          obligatoire?: boolean
          options?: Json | null
          ordre?: number
          question: string
          questionnaire_id: string
          type_reponse: string
        }
        Update: {
          created_at?: string
          id?: string
          obligatoire?: boolean
          options?: Json | null
          ordre?: number
          question?: string
          questionnaire_id?: string
          type_reponse?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_questions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaires: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          therapist_id: string
          titre: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          therapist_id: string
          titre: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          therapist_id?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaires_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaires_therapist_id_fkey"
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
          therapist_reply: string | null
          therapist_reply_at: string | null
          therapist_reply_reviewed_at: string | null
          therapist_reply_reviewed_by: string | null
          therapist_reply_status: string | null
          therapist_reply_submitted_at: string | null
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
          therapist_reply?: string | null
          therapist_reply_at?: string | null
          therapist_reply_reviewed_at?: string | null
          therapist_reply_reviewed_by?: string | null
          therapist_reply_status?: string | null
          therapist_reply_submitted_at?: string | null
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
          therapist_reply?: string | null
          therapist_reply_at?: string | null
          therapist_reply_reviewed_at?: string | null
          therapist_reply_reviewed_by?: string | null
          therapist_reply_status?: string | null
          therapist_reply_submitted_at?: string | null
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
      service_packages: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          nom: string
          nombre_seances_incluses: number
          prix_total: number
          therapist_id: string
          updated_at: string
          validite_jours: number | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          nombre_seances_incluses: number
          prix_total: number
          therapist_id: string
          updated_at?: string
          validite_jours?: number | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          nombre_seances_incluses?: number
          prix_total?: number
          therapist_id?: string
          updated_at?: string
          validite_jours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_packages_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          aliases: string[]
          created_at: string
          description_de: string | null
          description_en: string | null
          description_fr: string | null
          description_it: string | null
          family_id: string
          id: string
          is_active: boolean
          is_featured: boolean
          name_de: string | null
          name_en: string | null
          name_fr: string
          name_it: string | null
          slug: string
          slug_de: string | null
          slug_en: string | null
          slug_it: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          description_de?: string | null
          description_en?: string | null
          description_fr?: string | null
          description_it?: string | null
          family_id: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name_de?: string | null
          name_en?: string | null
          name_fr: string
          name_it?: string | null
          slug: string
          slug_de?: string | null
          slug_en?: string | null
          slug_it?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          description_de?: string | null
          description_en?: string | null
          description_fr?: string | null
          description_it?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name_de?: string | null
          name_en?: string | null
          name_fr?: string
          name_it?: string | null
          slug?: string
          slug_de?: string | null
          slug_en?: string | null
          slug_it?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialties_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "specialty_families"
            referencedColumns: ["id"]
          },
        ]
      }
      specialty_families: {
        Row: {
          created_at: string
          description_de: string | null
          description_en: string | null
          description_fr: string | null
          description_it: string | null
          icon: string | null
          id: string
          is_featured: boolean
          name_de: string | null
          name_en: string | null
          name_fr: string
          name_it: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_de?: string | null
          description_en?: string | null
          description_fr?: string | null
          description_it?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean
          name_de?: string | null
          name_en?: string | null
          name_fr: string
          name_it?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_de?: string | null
          description_en?: string | null
          description_fr?: string | null
          description_it?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean
          name_de?: string | null
          name_en?: string | null
          name_fr?: string
          name_it?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      specialty_import_pending: {
        Row: {
          created_at: string
          id: string
          raw_label: string
          therapist_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          raw_label: string
          therapist_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          raw_label?: string
          therapist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specialty_import_pending_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialty_import_pending_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount_subtotal: number | null
          amount_tax: number | null
          amount_total: number
          billing_address: string | null
          billing_reason: string | null
          company_name: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_date: string
          invoice_number: string
          invoice_pdf_url: string | null
          metadata: Json
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          plan_name: string | null
          status: string
          stripe_invoice_id: string | null
          therapist_id: string
          updated_at: string
        }
        Insert: {
          amount_subtotal?: number | null
          amount_tax?: number | null
          amount_total?: number
          billing_address?: string | null
          billing_reason?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_pdf_url?: string | null
          metadata?: Json
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_name?: string | null
          status?: string
          stripe_invoice_id?: string | null
          therapist_id: string
          updated_at?: string
        }
        Update: {
          amount_subtotal?: number | null
          amount_tax?: number | null
          amount_total?: number
          billing_address?: string | null
          billing_reason?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_pdf_url?: string | null
          metadata?: Json
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_name?: string | null
          status?: string
          stripe_invoice_id?: string | null
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_catalogs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          source: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          source?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          source?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: string
        }
        Relationships: []
      }
      tariff_positions: {
        Row: {
          catalog_id: string
          code: string
          created_at: string
          description: string | null
          designation: string
          id: string
          is_active: boolean
          unit: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          catalog_id: string
          code: string
          created_at?: string
          description?: string | null
          designation: string
          id?: string
          is_active?: boolean
          unit?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          catalog_id?: string
          code?: string
          created_at?: string
          description?: string | null
          designation?: string
          id?: string
          is_active?: boolean
          unit?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tariff_positions_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "tariff_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_advanced_scoring_access: {
        Row: {
          enabled: boolean
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          note: string | null
          source: string
          starts_at: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          source?: string
          starts_at?: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          source?: string
          starts_at?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_advanced_scoring_access_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_advanced_scoring_access_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_articles: {
        Row: {
          contenu: string
          created_at: string
          date_publication: string | null
          date_soumission: string | null
          extrait: string | null
          id: string
          image_couverture: string | null
          motif_refus: string | null
          slug: string
          statut: string
          therapist_id: string
          titre: string
          updated_at: string
        }
        Insert: {
          contenu: string
          created_at?: string
          date_publication?: string | null
          date_soumission?: string | null
          extrait?: string | null
          id?: string
          image_couverture?: string | null
          motif_refus?: string | null
          slug: string
          statut?: string
          therapist_id: string
          titre: string
          updated_at?: string
        }
        Update: {
          contenu?: string
          created_at?: string
          date_publication?: string | null
          date_soumission?: string | null
          extrait?: string | null
          id?: string
          image_couverture?: string | null
          motif_refus?: string | null
          slug?: string
          statut?: string
          therapist_id?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_articles_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_articles_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_booking_clicks: {
        Row: {
          created_at: string
          id: string
          session_id: string | null
          therapist_id: string
          viewer_type: string | null
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          session_id?: string | null
          therapist_id: string
          viewer_type?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string | null
          therapist_id?: string
          viewer_type?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_booking_clicks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_booking_clicks_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_booking_clicks_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_calendar_sync: {
        Row: {
          created_at: string
          export_enabled: boolean
          export_token: string | null
          export_token_created_at: string | null
          import_enabled: boolean
          import_last_count: number
          import_last_error: string | null
          import_last_ignored: number
          import_last_seen: number
          import_last_status: string | null
          import_last_sync_at: string | null
          import_skipped_recurring: number
          import_url: string | null
          therapist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          export_enabled?: boolean
          export_token?: string | null
          export_token_created_at?: string | null
          import_enabled?: boolean
          import_last_count?: number
          import_last_error?: string | null
          import_last_ignored?: number
          import_last_seen?: number
          import_last_status?: string | null
          import_last_sync_at?: string | null
          import_skipped_recurring?: number
          import_url?: string | null
          therapist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          export_enabled?: boolean
          export_token?: string | null
          export_token_created_at?: string | null
          import_enabled?: boolean
          import_last_count?: number
          import_last_error?: string | null
          import_last_ignored?: number
          import_last_seen?: number
          import_last_status?: string | null
          import_last_sync_at?: string | null
          import_skipped_recurring?: number
          import_url?: string | null
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_calendar_sync_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_calendar_sync_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_certifications: {
        Row: {
          created_at: string
          expires_at: string | null
          file_url: string | null
          id: string
          issuer: string | null
          name: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          source_label: string | null
          therapist_id: string
          updated_at: string
          verification_note: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          issuer?: string | null
          name: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          source_label?: string | null
          therapist_id: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          issuer?: string | null
          name?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          source_label?: string | null
          therapist_id?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_certifications_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_certifications_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_documents: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          doc_type: string
          file_name: string
          file_url: string
          id: string
          is_health_data: boolean
          is_public: boolean
          label: string | null
          therapist_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_name: string
          file_url: string
          id?: string
          is_health_data?: boolean
          is_public?: boolean
          label?: string | null
          therapist_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_name?: string
          file_url?: string
          id?: string
          is_health_data?: boolean
          is_public?: boolean
          label?: string | null
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
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
      therapist_external_busy: {
        Row: {
          ends_at: string
          id: string
          starts_at: string
          synced_at: string
          therapist_id: string
          uid: string | null
        }
        Insert: {
          ends_at: string
          id?: string
          starts_at: string
          synced_at?: string
          therapist_id: string
          uid?: string | null
        }
        Update: {
          ends_at?: string
          id?: string
          starts_at?: string
          synced_at?: string
          therapist_id?: string
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_external_busy_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_external_busy_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_families: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      therapist_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          position: number
          question: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          question: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          question?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_faqs_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_faqs_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_health_recommendations: {
        Row: {
          category: string | null
          code: string
          id: string
          impact_points: number
          label: string
          severity: string
          status: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          id?: string
          impact_points?: number
          label: string
          severity?: string
          status?: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          id?: string
          impact_points?: number
          label?: string
          severity?: string
          status?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_health_recommendations_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_health_recommendations_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_health_score_history: {
        Row: {
          breakdown: Json | null
          computed_at: string
          id: string
          score_total: number
          therapist_id: string
        }
        Insert: {
          breakdown?: Json | null
          computed_at?: string
          id?: string
          score_total: number
          therapist_id: string
        }
        Update: {
          breakdown?: Json | null
          computed_at?: string
          id?: string
          score_total?: number
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_health_score_history_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_health_score_history_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_health_scores: {
        Row: {
          ai_citability: number | null
          ai_citability_at: string | null
          ai_citability_detail: Json | null
          article_idea: string | null
          article_idea_source: string
          computed_at: string
          gaps: Json
          grade: string
          last_recap_sent_at: string | null
          score_activite: number
          score_completude: number
          score_contenu: number
          score_previous: number | null
          score_reactivite: number | null
          score_total: number
          score_visibilite: number
          strengths: Json
          therapist_id: string
        }
        Insert: {
          ai_citability?: number | null
          ai_citability_at?: string | null
          ai_citability_detail?: Json | null
          article_idea?: string | null
          article_idea_source?: string
          computed_at?: string
          gaps?: Json
          grade?: string
          last_recap_sent_at?: string | null
          score_activite?: number
          score_completude?: number
          score_contenu?: number
          score_previous?: number | null
          score_reactivite?: number | null
          score_total?: number
          score_visibilite?: number
          strengths?: Json
          therapist_id: string
        }
        Update: {
          ai_citability?: number | null
          ai_citability_at?: string | null
          ai_citability_detail?: Json | null
          article_idea?: string | null
          article_idea_source?: string
          computed_at?: string
          gaps?: Json
          grade?: string
          last_recap_sent_at?: string | null
          score_activite?: number
          score_completude?: number
          score_contenu?: number
          score_previous?: number | null
          score_reactivite?: number | null
          score_total?: number
          score_visibilite?: number
          strengths?: Json
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_health_scores_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_health_scores_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_invoice_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          invoice_id: string | null
          note: string | null
          therapist_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          therapist_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_invoice_audit_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoice_audit_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoice_audit_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_invoice_lines: {
        Row: {
          appointment_id: string | null
          commentaire: string | null
          created_at: string
          date_prestation: string | null
          description: string
          duree_min: number | null
          id: string
          invoice_id: string
          montant_ht: number
          montant_ttc: number
          position: number
          prix_unitaire: number
          quantite: number
          remise_pct: number
          tariff_code: string | null
          tariff_label: string | null
          tariff_system: string | null
          tariff_version: string | null
          therapist_id: string
          tva_montant: number
          tva_taux: number
          unite: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          commentaire?: string | null
          created_at?: string
          date_prestation?: string | null
          description: string
          duree_min?: number | null
          id?: string
          invoice_id: string
          montant_ht?: number
          montant_ttc?: number
          position?: number
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number
          tariff_code?: string | null
          tariff_label?: string | null
          tariff_system?: string | null
          tariff_version?: string | null
          therapist_id: string
          tva_montant?: number
          tva_taux?: number
          unite?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          commentaire?: string | null
          created_at?: string
          date_prestation?: string | null
          description?: string
          duree_min?: number | null
          id?: string
          invoice_id?: string
          montant_ht?: number
          montant_ttc?: number
          position?: number
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number
          tariff_code?: string | null
          tariff_label?: string | null
          tariff_system?: string | null
          tariff_version?: string | null
          therapist_id?: string
          tva_montant?: number
          tva_taux?: number
          unite?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_invoice_lines_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoice_lines_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoice_lines_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_invoice_payments: {
        Row: {
          created_at: string
          created_by: string | null
          date_paiement: string
          id: string
          invoice_id: string
          is_refund: boolean
          mode_paiement: string
          montant: number
          notes: string | null
          reference_bancaire: string | null
          therapist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_paiement?: string
          id?: string
          invoice_id: string
          is_refund?: boolean
          mode_paiement?: string
          montant: number
          notes?: string | null
          reference_bancaire?: string | null
          therapist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_paiement?: string
          id?: string
          invoice_id?: string
          is_refund?: boolean
          mode_paiement?: string
          montant?: number
          notes?: string | null
          reference_bancaire?: string | null
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoice_payments_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoice_payments_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_invoice_settings: {
        Row: {
          adresse_npa: string
          adresse_pays: string
          adresse_rue: string
          adresse_ville: string
          assujetti_tva: boolean
          autoriser_taux_personnalise: boolean
          comptable_email: string | null
          comptable_nom: string | null
          conditions_paiement: string | null
          created_at: string
          delai_paiement_jours: number
          devise_defaut: string
          email_pro: string | null
          iban_ou_qr_iban: string
          id: string
          invoice_number_year: number | null
          langue_facture: string
          logo_url: string | null
          mention_tva: string | null
          mode_tva: string
          next_invoice_number: number
          numero_ide: string | null
          numero_tva: string | null
          pied_de_page: string | null
          qr_iban: string | null
          raison_sociale: string | null
          remise_a_zero_annuelle: boolean
          taux_tva: number | null
          taux_tva_autorises: number[]
          telephone: string | null
          therapist_id: string
          titulaire_adresse: string | null
          titulaire_nom: string | null
          titulaire_npa: string | null
          titulaire_pays: string
          titulaire_ville: string | null
          updated_at: string
          use_tarif_590: boolean
        }
        Insert: {
          adresse_npa: string
          adresse_pays?: string
          adresse_rue: string
          adresse_ville: string
          assujetti_tva?: boolean
          autoriser_taux_personnalise?: boolean
          comptable_email?: string | null
          comptable_nom?: string | null
          conditions_paiement?: string | null
          created_at?: string
          delai_paiement_jours?: number
          devise_defaut?: string
          email_pro?: string | null
          iban_ou_qr_iban: string
          id?: string
          invoice_number_year?: number | null
          langue_facture?: string
          logo_url?: string | null
          mention_tva?: string | null
          mode_tva?: string
          next_invoice_number?: number
          numero_ide?: string | null
          numero_tva?: string | null
          pied_de_page?: string | null
          qr_iban?: string | null
          raison_sociale?: string | null
          remise_a_zero_annuelle?: boolean
          taux_tva?: number | null
          taux_tva_autorises?: number[]
          telephone?: string | null
          therapist_id: string
          titulaire_adresse?: string | null
          titulaire_nom?: string | null
          titulaire_npa?: string | null
          titulaire_pays?: string
          titulaire_ville?: string | null
          updated_at?: string
          use_tarif_590?: boolean
        }
        Update: {
          adresse_npa?: string
          adresse_pays?: string
          adresse_rue?: string
          adresse_ville?: string
          assujetti_tva?: boolean
          autoriser_taux_personnalise?: boolean
          comptable_email?: string | null
          comptable_nom?: string | null
          conditions_paiement?: string | null
          created_at?: string
          delai_paiement_jours?: number
          devise_defaut?: string
          email_pro?: string | null
          iban_ou_qr_iban?: string
          id?: string
          invoice_number_year?: number | null
          langue_facture?: string
          logo_url?: string | null
          mention_tva?: string | null
          mode_tva?: string
          next_invoice_number?: number
          numero_ide?: string | null
          numero_tva?: string | null
          pied_de_page?: string | null
          qr_iban?: string | null
          raison_sociale?: string | null
          remise_a_zero_annuelle?: boolean
          taux_tva?: number | null
          taux_tva_autorises?: number[]
          telephone?: string | null
          therapist_id?: string
          titulaire_adresse?: string | null
          titulaire_nom?: string | null
          titulaire_npa?: string | null
          titulaire_pays?: string
          titulaire_ville?: string | null
          updated_at?: string
          use_tarif_590?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "therapist_invoice_settings_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoice_settings_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_invoices: {
        Row: {
          annee_facturation: number
          appointment_id: string | null
          billing_snapshot_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          client_adresse: string | null
          client_adresse2: string | null
          client_canton: string | null
          client_email: string | null
          client_id: string | null
          client_nom: string | null
          client_npa: string | null
          client_package_id: string | null
          client_pays: string
          client_ville: string | null
          communication: string | null
          conditions_paiement: string | null
          corrects_invoice_id: string | null
          created_at: string
          credit_note_of_id: string | null
          currency: string
          date_echeance: string | null
          date_emission: string
          date_paiement: string | null
          date_prestation: string | null
          id: string
          langue: string
          locked_at: string | null
          metadata: Json
          montant_ht: number
          montant_paye: number
          montant_remise: number
          montant_total: number
          notes: string | null
          numero_facture: string
          pdf_url: string | null
          qr_reference: string | null
          reference_type: string
          sent_at: string | null
          statut: string
          statut_paiement: string
          therapist_id: string
          tva_montant: number | null
          tva_taux: number | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          annee_facturation: number
          appointment_id?: string | null
          billing_snapshot_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_adresse?: string | null
          client_adresse2?: string | null
          client_canton?: string | null
          client_email?: string | null
          client_id?: string | null
          client_nom?: string | null
          client_npa?: string | null
          client_package_id?: string | null
          client_pays?: string
          client_ville?: string | null
          communication?: string | null
          conditions_paiement?: string | null
          corrects_invoice_id?: string | null
          created_at?: string
          credit_note_of_id?: string | null
          currency?: string
          date_echeance?: string | null
          date_emission?: string
          date_paiement?: string | null
          date_prestation?: string | null
          id?: string
          langue?: string
          locked_at?: string | null
          metadata?: Json
          montant_ht: number
          montant_paye?: number
          montant_remise?: number
          montant_total: number
          notes?: string | null
          numero_facture: string
          pdf_url?: string | null
          qr_reference?: string | null
          reference_type?: string
          sent_at?: string | null
          statut?: string
          statut_paiement?: string
          therapist_id: string
          tva_montant?: number | null
          tva_taux?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          annee_facturation?: number
          appointment_id?: string | null
          billing_snapshot_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_adresse?: string | null
          client_adresse2?: string | null
          client_canton?: string | null
          client_email?: string | null
          client_id?: string | null
          client_nom?: string | null
          client_npa?: string | null
          client_package_id?: string | null
          client_pays?: string
          client_ville?: string | null
          communication?: string | null
          conditions_paiement?: string | null
          corrects_invoice_id?: string | null
          created_at?: string
          credit_note_of_id?: string | null
          currency?: string
          date_echeance?: string | null
          date_emission?: string
          date_paiement?: string | null
          date_prestation?: string | null
          id?: string
          langue?: string
          locked_at?: string | null
          metadata?: Json
          montant_ht?: number
          montant_paye?: number
          montant_remise?: number
          montant_total?: number
          notes?: string | null
          numero_facture?: string
          pdf_url?: string | null
          qr_reference?: string | null
          reference_type?: string
          sent_at?: string | null
          statut?: string
          statut_paiement?: string
          therapist_id?: string
          tva_montant?: number | null
          tva_taux?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoices_client_package_id_fkey"
            columns: ["client_package_id"]
            isOneToOne: false
            referencedRelation: "client_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoices_corrects_invoice_id_fkey"
            columns: ["corrects_invoice_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoices_credit_note_of_id_fkey"
            columns: ["credit_note_of_id"]
            isOneToOne: false
            referencedRelation: "therapist_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoices_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_invoices_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_media: {
        Row: {
          created_at: string
          id: string
          kind: string
          therapist_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          therapist_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          therapist_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_media_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_media_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_payment_methods: {
        Row: {
          bank_name: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          method_type: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          method_type: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          method_type?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
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
      therapist_profile_views: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          session_id: string | null
          therapist_id: string
          viewer_type: string | null
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          session_id?: string | null
          therapist_id: string
          viewer_type?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          session_id?: string | null
          therapist_id?: string
          viewer_type?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_views_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_views_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_views_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_scoring_access_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          source: string | null
          starts_at: string | null
          therapist_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          source?: string | null
          starts_at?: string | null
          therapist_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          source?: string | null
          starts_at?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_scoring_access_events_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_scoring_access_events_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_showcase_snapshots: {
        Row: {
          checks: Json | null
          completed: number | null
          created_at: string
          id: string
          score: number
          score_conversion: number | null
          score_visibilite: number | null
          therapist_id: string
          total: number | null
        }
        Insert: {
          checks?: Json | null
          completed?: number | null
          created_at?: string
          id?: string
          score: number
          score_conversion?: number | null
          score_visibilite?: number | null
          therapist_id: string
          total?: number | null
        }
        Update: {
          checks?: Json | null
          completed?: number | null
          created_at?: string
          id?: string
          score?: number
          score_conversion?: number | null
          score_visibilite?: number | null
          therapist_id?: string
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_showcase_snapshots_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_showcase_snapshots_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists_public"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_specialties: {
        Row: {
          created_at: string
          specialty_id: string
          therapist_id: string
        }
        Insert: {
          created_at?: string
          specialty_id: string
          therapist_id: string
        }
        Update: {
          created_at?: string
          specialty_id?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_specialties_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_specialties_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
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
          faq_enabled: boolean
          first_name: string
          gallery_urls: Json
          geom: unknown
          google_reviews_url: string | null
          id: string
          ide_verified: boolean
          insurance_accepted: boolean | null
          invoice_counter: number
          is_trainer: boolean
          languages: string[] | null
          last_name: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
          newsletter_consent_email: string | null
          newsletter_consent_source: string | null
          newsletter_consent_version: string | null
          newsletter_opt_in: boolean
          newsletter_opt_in_at: string | null
          newsletter_unsubscribe_token: string
          newsletter_unsubscribed_at: string | null
          onboarding_complete: boolean
          onboarding_completed_at: string | null
          payment_link: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          price_max: number | null
          price_min: number | null
          search_tokens: unknown
          services: Json
          short_bio: string | null
          siret_verified: boolean
          slug: string
          social_links: Json
          specialties: string[] | null
          status: string
          subscription_plan: string
          title: string | null
          trainer_institution: string | null
          trainer_since: number | null
          trainer_subjects: string | null
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
          faq_enabled?: boolean
          first_name: string
          gallery_urls?: Json
          geom?: unknown
          google_reviews_url?: string | null
          id?: string
          ide_verified?: boolean
          insurance_accepted?: boolean | null
          invoice_counter?: number
          is_trainer?: boolean
          languages?: string[] | null
          last_name: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          newsletter_consent_email?: string | null
          newsletter_consent_source?: string | null
          newsletter_consent_version?: string | null
          newsletter_opt_in?: boolean
          newsletter_opt_in_at?: string | null
          newsletter_unsubscribe_token?: string
          newsletter_unsubscribed_at?: string | null
          onboarding_complete?: boolean
          onboarding_completed_at?: string | null
          payment_link?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          price_max?: number | null
          price_min?: number | null
          search_tokens?: unknown
          services?: Json
          short_bio?: string | null
          siret_verified?: boolean
          slug: string
          social_links?: Json
          specialties?: string[] | null
          status?: string
          subscription_plan?: string
          title?: string | null
          trainer_institution?: string | null
          trainer_since?: number | null
          trainer_subjects?: string | null
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
          faq_enabled?: boolean
          first_name?: string
          gallery_urls?: Json
          geom?: unknown
          google_reviews_url?: string | null
          id?: string
          ide_verified?: boolean
          insurance_accepted?: boolean | null
          invoice_counter?: number
          is_trainer?: boolean
          languages?: string[] | null
          last_name?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          newsletter_consent_email?: string | null
          newsletter_consent_source?: string | null
          newsletter_consent_version?: string | null
          newsletter_opt_in?: boolean
          newsletter_opt_in_at?: string | null
          newsletter_unsubscribe_token?: string
          newsletter_unsubscribed_at?: string | null
          onboarding_complete?: boolean
          onboarding_completed_at?: string | null
          payment_link?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          price_max?: number | null
          price_min?: number | null
          search_tokens?: unknown
          services?: Json
          short_bio?: string | null
          siret_verified?: boolean
          slug?: string
          social_links?: Json
          specialties?: string[] | null
          status?: string
          subscription_plan?: string
          title?: string | null
          trainer_institution?: string | null
          trainer_since?: number | null
          trainer_subjects?: string | null
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
      user_sanctions: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          family_id: string | null
          id: string
          kind: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          family_id?: string | null
          id?: string
          kind: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          family_id?: string | null
          id?: string
          kind?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sanctions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "therapist_families"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          ip_country: string | null
          last_seen_at: string
          started_at: string
          user_agent: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip_country?: string | null
          last_seen_at?: string
          started_at?: string
          user_agent?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip_country?: string | null
          last_seen_at?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      vat_rates: {
        Row: {
          code: string
          country: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          note: string | null
          rate: number
          updated_at: string
        }
        Insert: {
          code: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          note?: string | null
          rate: number
          updated_at?: string
        }
        Update: {
          code?: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          note?: string | null
          rate?: number
          updated_at?: string
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
          invitation_status: string
          invitation_token: string | null
          invited_at: string | null
          last_name: string | null
          message: string | null
          phone: string | null
          source: string
          specialty: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_terms?: boolean | null
          canton?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          invitation_status?: string
          invitation_token?: string | null
          invited_at?: string | null
          last_name?: string | null
          message?: string | null
          phone?: string | null
          source?: string
          specialty?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_terms?: boolean | null
          canton?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          invitation_status?: string
          invitation_token?: string | null
          invited_at?: string | null
          last_name?: string | null
          message?: string | null
          phone?: string | null
          source?: string
          specialty?: string | null
          status?: string
          token_expires_at?: string | null
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
      admin_specialty_coherence_report: {
        Args: never
        Returns: {
          normalized: string
          raw_label: string
          therapist_id: string
          therapist_name: string
        }[]
      }
      admin_therapist_client_stats: {
        Args: never
        Returns: {
          active_contacts: number
          last_booking_at: string
          recent_contacts: number
          therapist_id: string
          total_contacts: number
        }[]
      }
      admin_unread_count: { Args: never; Returns: number }
      advanced_scoring_eligibility: {
        Args: { _therapist_id: string }
        Returns: Json
      }
      agent_notify_secret_ok: { Args: { _secret: string }; Returns: boolean }
      anonymize_user_analytics: { Args: { _uid: string }; Returns: undefined }
      certification_verification_unchanged: {
        Args: {
          _id: string
          _verification_status: string
          _verified_at: string
          _verified_by: string
        }
        Returns: boolean
      }
      city_slug: { Args: { _input: string }; Returns: string }
      claim_founder_seat: {
        Args: {
          _actor?: string
          _note?: string
          _source?: string
          _therapist_id: string
        }
        Returns: number
      }
      close_marketing_topic: {
        Args: { _id: string; _reject_reason?: string; _secret: string }
        Returns: boolean
      }
      close_stale_sessions: { Args: never; Returns: undefined }
      community_is_muted: { Args: { _uid: string }; Returns: boolean }
      compute_therapist_health: { Args: never; Returns: number }
      compute_therapist_health_one: { Args: { _id: string }; Returns: boolean }
      create_admin_notification: {
        Args: {
          _data?: Json
          _entity_id?: string
          _entity_type?: string
          _kind: string
          _link?: string
          _subject: string
          _summary: string
        }
        Returns: string
      }
      crm_daily_maintenance: { Args: never; Returns: Json }
      crm_find_existing_lead: {
        Args: { _email: string; _phone: string; _therapist_id: string }
        Returns: string
      }
      crm_norm_email: { Args: { _v: string }; Returns: string }
      crm_norm_phone: { Args: { _v: string }; Returns: string }
      get_my_therapist_contact: {
        Args: never
        Returns: {
          email: string
          id: string
          phone: string
        }[]
      }
      get_pending_marketing_topics: {
        Args: { _secret: string }
        Returns: {
          created_at: string
          format: string
          id: string
          network: string
          note: string
          subject: string
          target_date: string
        }[]
      }
      get_therapist_intake_header: {
        Args: { _slug: string }
        Returns: {
          city: string
          first_name: string
          id: string
          last_name: string
          photo_url: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_elite_pro: { Args: { _user_id: string }; Returns: boolean }
      is_family_member: { Args: { _family_id: string }; Returns: boolean }
      is_therapist_owner: { Args: { _therapist_id: string }; Returns: boolean }
      is_verified_therapist: { Args: { _uid: string }; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: { Args: { _id: string }; Returns: undefined }
      marketing_agent_secret_ok: { Args: { _secret: string }; Returns: boolean }
      normalize_city_text: { Args: { _input: string }; Returns: string }
      normalize_search: { Args: { _input: string }; Returns: string }
      notify_admin_event: {
        Args: {
          _kind: string
          _link?: string
          _subject: string
          _summary: string
        }
        Returns: undefined
      }
      purge_newsletter_send_details: {
        Args: { _months?: number }
        Returns: number
      }
      purge_user_analytics: { Args: { _uid: string }; Returns: undefined }
      request_admin_notification: {
        Args: {
          _kind: string
          _link?: string
          _secret: string
          _subject: string
          _summary: string
        }
        Returns: string
      }
      reserve_next_invoice_number: {
        Args: { _therapist_id: string }
        Returns: {
          annee: number
          numero_facture: string
          seq: number
        }[]
      }
      resolve_admin_notifications: { Args: never; Returns: number }
      resolve_city: {
        Args: { _input: string }
        Returns: {
          canonical_name: string
          display_name: string
          lat: number
          lng: number
        }[]
      }
      reviews_reply_only_unchanged: {
        Args: {
          _author_name: string
          _comment: string
          _created_at: string
          _id: string
          _rating: number
          _status: string
          _therapist_id: string
          _user_id: string
        }
        Returns: boolean
      }
      revoke_founder_seat: {
        Args: { _actor?: string; _note?: string; _therapist_id: string }
        Returns: boolean
      }
      search_specialties:
        | {
            Args: { _limit?: number; _q: string }
            Returns: {
              family_name_fr: string
              family_slug: string
              id: string
              name_fr: string
              rank: number
              slug: string
            }[]
          }
        | {
            Args: { _lang?: string; _limit?: number; _q: string }
            Returns: {
              family_name_de: string
              family_name_en: string
              family_name_fr: string
              family_name_it: string
              family_slug: string
              id: string
              name_de: string
              name_en: string
              name_fr: string
              name_it: string
              rank: number
              slug: string
            }[]
          }
      search_therapists: {
        Args: {
          _family_slug?: string
          _limit?: number
          _q?: string
          _spec_slug?: string
        }
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
          matched_city: string
          matched_specialty: string
          photo_url: string
          price_max: number
          price_min: number
          score: number
          short_bio: string
          slug: string
          specialties: string[]
          subscription_plan: string
          title: string
          verified: boolean
        }[]
      }
      specialty_slug: { Args: { _input: string }; Returns: string }
      suggest_article_idea: { Args: { _specs: string[] }; Returns: string }
      therapist_health_signals: {
        Args: { _id?: string }
        Returns: {
          appts_90d: number
          avg_rating: number
          bio_len: number
          has_geo: boolean
          has_meta: boolean
          has_photo: boolean
          has_price: boolean
          has_web: boolean
          is_premium: boolean
          last_content_at: string
          last_login: string
          n_articles: number
          n_avail: number
          n_certifications: number
          n_events: number
          n_languages: number
          n_media: number
          n_modes: number
          n_reply: number
          n_reviews: number
          n_specialties: number
          profile_updated: string
          slug: string
          specialties: string[]
          therapist_id: string
          verified: boolean
        }[]
      }
      therapist_review_stats: { Args: { _therapist_id: string }; Returns: Json }
      therapists_admin_fields_unchanged: {
        Args: {
          _id: string
          _ide_verified: boolean
          _siret_verified: boolean
          _status: string
          _subscription_plan: string
          _verified: boolean
        }
        Returns: boolean
      }
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
