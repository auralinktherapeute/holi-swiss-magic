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
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_booking_at: string | null
          last_name: string
          next_booking_at: string | null
          payment_link: string | null
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
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_booking_at?: string | null
          last_name: string
          next_booking_at?: string | null
          payment_link?: string | null
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
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_booking_at?: string | null
          last_name?: string
          next_booking_at?: string | null
          payment_link?: string | null
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
          description_fr: string | null
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
          description_fr?: string | null
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
          description_fr?: string | null
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
      therapist_invoice_settings: {
        Row: {
          adresse_npa: string
          adresse_pays: string
          adresse_rue: string
          adresse_ville: string
          assujetti_tva: boolean
          created_at: string
          iban_ou_qr_iban: string
          id: string
          invoice_number_year: number | null
          next_invoice_number: number
          numero_tva: string | null
          remise_a_zero_annuelle: boolean
          taux_tva: number | null
          therapist_id: string
          updated_at: string
        }
        Insert: {
          adresse_npa: string
          adresse_pays?: string
          adresse_rue: string
          adresse_ville: string
          assujetti_tva?: boolean
          created_at?: string
          iban_ou_qr_iban: string
          id?: string
          invoice_number_year?: number | null
          next_invoice_number?: number
          numero_tva?: string | null
          remise_a_zero_annuelle?: boolean
          taux_tva?: number | null
          therapist_id: string
          updated_at?: string
        }
        Update: {
          adresse_npa?: string
          adresse_pays?: string
          adresse_rue?: string
          adresse_ville?: string
          assujetti_tva?: boolean
          created_at?: string
          iban_ou_qr_iban?: string
          id?: string
          invoice_number_year?: number | null
          next_invoice_number?: number
          numero_tva?: string | null
          remise_a_zero_annuelle?: boolean
          taux_tva?: number | null
          therapist_id?: string
          updated_at?: string
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
          client_id: string | null
          client_package_id: string | null
          created_at: string
          currency: string
          date_emission: string
          date_paiement: string | null
          id: string
          metadata: Json
          montant_ht: number
          montant_total: number
          numero_facture: string
          pdf_url: string | null
          qr_reference: string | null
          statut_paiement: string
          therapist_id: string
          tva_montant: number | null
          tva_taux: number | null
          updated_at: string
        }
        Insert: {
          annee_facturation: number
          appointment_id?: string | null
          client_id?: string | null
          client_package_id?: string | null
          created_at?: string
          currency?: string
          date_emission?: string
          date_paiement?: string | null
          id?: string
          metadata?: Json
          montant_ht: number
          montant_total: number
          numero_facture: string
          pdf_url?: string | null
          qr_reference?: string | null
          statut_paiement?: string
          therapist_id: string
          tva_montant?: number | null
          tva_taux?: number | null
          updated_at?: string
        }
        Update: {
          annee_facturation?: number
          appointment_id?: string | null
          client_id?: string | null
          client_package_id?: string | null
          created_at?: string
          currency?: string
          date_emission?: string
          date_paiement?: string | null
          id?: string
          metadata?: Json
          montant_ht?: number
          montant_total?: number
          numero_facture?: string
          pdf_url?: string | null
          qr_reference?: string | null
          statut_paiement?: string
          therapist_id?: string
          tva_montant?: number | null
          tva_taux?: number | null
          updated_at?: string
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
          first_name: string
          gallery_urls: Json
          geom: unknown
          google_reviews_url: string | null
          id: string
          ide_verified: boolean
          insurance_accepted: boolean | null
          invoice_counter: number
          languages: string[] | null
          last_name: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
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
          invoice_counter?: number
          languages?: string[] | null
          last_name: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
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
          invoice_counter?: number
          languages?: string[] | null
          last_name?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
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
      get_my_therapist_contact: {
        Args: never
        Returns: {
          email: string
          id: string
          phone: string
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
      is_elite_pro: { Args: { _user_id: string }; Returns: boolean }
      is_therapist_owner: { Args: { _therapist_id: string }; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: { Args: { _id: string }; Returns: undefined }
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
      reserve_next_invoice_number: {
        Args: { _therapist_id: string }
        Returns: {
          annee: number
          numero_facture: string
          seq: number
        }[]
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
