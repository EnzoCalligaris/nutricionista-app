export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_notes: {
        Row: {
          appointment_id: string | null
          author_id: string
          content: string
          created_at: string
          id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          author_id: string
          content: string
          created_at?: string
          id?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "appointment_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "appointment_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          amount_cents: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          modality: Database["public"]["Enums"]["appointment_modality"]
          nutritionist_id: string
          patient_id: string
          rescheduled_to_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          modality: Database["public"]["Enums"]["appointment_modality"]
          nutritionist_id: string
          patient_id: string
          rescheduled_to_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          modality?: Database["public"]["Enums"]["appointment_modality"]
          nutritionist_id?: string
          patient_id?: string
          rescheduled_to_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_financial_summary"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "appointments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "patient_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["current_contract_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_to_id_fkey"
            columns: ["rescheduled_to_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_measurements: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          measurement_type_id: string
          updated_at: string
          value: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          measurement_type_id: string
          updated_at?: string
          value: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          measurement_type_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_measurements_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_measurements_measurement_type_id_fkey"
            columns: ["measurement_type_id"]
            isOneToOne: false
            referencedRelation: "measurement_types"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          assessed_at: string
          assessment_date: string
          created_at: string
          created_by: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          patient_id: string
          published_at: string | null
          report_mime: string | null
          report_name: string | null
          report_path: string | null
          report_size_bytes: number | null
          report_uploaded_at: string | null
          updated_at: string
          updated_by: string | null
          visible_to_patient: boolean
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          assessed_at?: string
          assessment_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          patient_id: string
          published_at?: string | null
          report_mime?: string | null
          report_name?: string | null
          report_path?: string | null
          report_size_bytes?: number | null
          report_uploaded_at?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_to_patient?: boolean
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          assessed_at?: string
          assessment_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          patient_id?: string
          published_at?: string | null
          report_mime?: string | null
          report_name?: string | null
          report_path?: string | null
          report_size_bytes?: number | null
          report_uploaded_at?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_to_patient?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "assessments_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          modality: Database["public"]["Enums"]["appointment_modality"] | null
          nutritionist_id: string
          start_time: string
          timezone: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          modality?: Database["public"]["Enums"]["appointment_modality"] | null
          nutritionist_id: string
          start_time: string
          timezone?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          modality?: Database["public"]["Enums"]["appointment_modality"] | null
          nutritionist_id?: string
          start_time?: string
          timezone?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      before_after_results: {
        Row: {
          after_path: string
          before_path: string
          created_at: string
          description: string | null
          id: string
          media_consent_id: string | null
          patient_id: string | null
          period: string | null
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          after_path: string
          before_path: string
          created_at?: string
          description?: string | null
          id?: string
          media_consent_id?: string | null
          patient_id?: string | null
          period?: string | null
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          after_path?: string
          before_path?: string
          created_at?: string
          description?: string | null
          id?: string
          media_consent_id?: string | null
          patient_id?: string | null
          period?: string | null
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "before_after_results_media_consent_id_fkey"
            columns: ["media_consent_id"]
            isOneToOne: false
            referencedRelation: "media_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "before_after_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "before_after_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "before_after_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          all_day: boolean
          created_at: string
          ends_at: string
          id: string
          nutritionist_id: string
          reason: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          ends_at: string
          id?: string
          nutritionist_id: string
          reason?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          nutritionist_id?: string
          reason?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: Json
          cover_image_path: string | null
          created_at: string
          excerpt: string | null
          id: string
          meta_description: string | null
          og_image_path: string | null
          published_at: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content?: Json
          cover_image_path?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          og_image_path?: string | null
          published_at?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: Json
          cover_image_path?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          og_image_path?: string | null
          published_at?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_installments: {
        Row: {
          amount_cents: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          number: number
          paid_at: string | null
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          number: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          number?: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_financial_summary"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "patient_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["current_contract_id"]
          },
        ]
      }
      feedback_messages: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          author_id: string
          content: string
          created_at: string
          id: string
          patient_id: string
          published_at: string | null
          read_at: string | null
          reference_date: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          author_id: string
          content: string
          created_at?: string
          id?: string
          patient_id: string
          published_at?: string | null
          read_at?: string | null
          reference_date?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          patient_id?: string
          published_at?: string | null
          read_at?: string | null
          reference_date?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_messages_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "feedback_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "feedback_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_messages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["financial_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["financial_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["financial_type"]
          updated_at?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_on: string | null
          id: string
          notes: string | null
          nutritionist_id: string | null
          occurred_on: string
          origin: Database["public"]["Enums"]["financial_origin"]
          origin_payment_id: string | null
          paid_at: string | null
          patient_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          status: Database["public"]["Enums"]["financial_transaction_status"]
          type: Database["public"]["Enums"]["financial_type"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_on?: string | null
          id?: string
          notes?: string | null
          nutritionist_id?: string | null
          occurred_on?: string
          origin?: Database["public"]["Enums"]["financial_origin"]
          origin_payment_id?: string | null
          paid_at?: string | null
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["financial_transaction_status"]
          type: Database["public"]["Enums"]["financial_type"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_on?: string | null
          id?: string
          notes?: string | null
          nutritionist_id?: string | null
          occurred_on?: string
          origin?: Database["public"]["Enums"]["financial_origin"]
          origin_payment_id?: string | null
          paid_at?: string | null
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["financial_transaction_status"]
          type?: Database["public"]["Enums"]["financial_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_origin_payment_id_fkey"
            columns: ["origin_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "financial_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "financial_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      food_photo_analyses: {
        Row: {
          analyzed_at: string | null
          confidence: number | null
          corrected_result: Json | null
          created_at: string
          id: string
          model: string | null
          patient_id: string
          provider: string | null
          raw_result: Json | null
          status: Database["public"]["Enums"]["food_photo_analysis_status"]
          storage_path: string
          structured_result: Json | null
          updated_at: string
        }
        Insert: {
          analyzed_at?: string | null
          confidence?: number | null
          corrected_result?: Json | null
          created_at?: string
          id?: string
          model?: string | null
          patient_id: string
          provider?: string | null
          raw_result?: Json | null
          status?: Database["public"]["Enums"]["food_photo_analysis_status"]
          storage_path: string
          structured_result?: Json | null
          updated_at?: string
        }
        Update: {
          analyzed_at?: string | null
          confidence?: number | null
          corrected_result?: Json | null
          created_at?: string
          id?: string
          model?: string | null
          patient_id?: string
          provider?: string | null
          raw_result?: Json | null
          status?: Database["public"]["Enums"]["food_photo_analysis_status"]
          storage_path?: string
          structured_result?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_photo_analyses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "food_photo_analyses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "food_photo_analyses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      material_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          material_id: string
          patient_id: string
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          material_id: string
          patient_id: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          material_id?: string
          patient_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_assignments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "patient_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "material_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "material_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_assignments_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          fiber_g: number | null
          food_name: string
          id: string
          instructions: string | null
          meal_id: string
          notes: string | null
          protein_g: number | null
          quantity: number
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          food_name: string
          id?: string
          instructions?: string | null
          meal_id: string
          notes?: string | null
          protein_g?: number | null
          quantity: number
          sort_order?: number
          unit: string
          updated_at?: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          food_name?: string
          id?: string
          instructions?: string | null
          meal_id?: string
          notes?: string | null
          protein_g?: number | null
          quantity?: number
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_days: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          version_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          version_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          version_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_days_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          meal_plan_id: string
          notes: string | null
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["meal_plan_version_status"]
          updated_at: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meal_plan_id: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["meal_plan_version_status"]
          updated_at?: string
          version_number: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meal_plan_id?: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["meal_plan_version_status"]
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_versions_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          notes: string | null
          nutritionist_id: string
          patient_id: string
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          nutritionist_id: string
          patient_id: string
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          nutritionist_id?: string
          patient_id?: string
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "meal_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "meal_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_substitutions: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          id: string
          meal_item_id: string
          notes: string | null
          protein_g: number | null
          quantity: number | null
          sort_order: number
          substitute_food_name: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          meal_item_id: string
          notes?: string | null
          protein_g?: number | null
          quantity?: number | null
          sort_order?: number
          substitute_food_name: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          meal_item_id?: string
          notes?: string | null
          protein_g?: number | null
          quantity?: number | null
          sort_order?: number
          substitute_food_name?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_substitutions_meal_item_id_fkey"
            columns: ["meal_item_id"]
            isOneToOne: false
            referencedRelation: "meal_items"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          day_id: string
          id: string
          name: string
          notes: string | null
          sort_order: number
          time_of_day: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_id: string
          id?: string
          name: string
          notes?: string | null
          sort_order?: number
          time_of_day?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_id?: string
          id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          time_of_day?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          unit: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_consents: {
        Row: {
          consent_type: string
          created_at: string
          evidence_reference: string | null
          granted_at: string
          id: string
          patient_id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          evidence_reference?: string | null
          granted_at?: string
          id?: string
          patient_id: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          evidence_reference?: string | null
          granted_at?: string
          id?: string
          patient_id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "media_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "media_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          event_id: string
          failed_at: string | null
          id: string
          idempotency_key: string
          provider_message_id: string | null
          recipient: string
          recipient_profile_id: string | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          event_id: string
          failed_at?: string | null
          id?: string
          idempotency_key: string
          provider_message_id?: string | null
          recipient: string
          recipient_profile_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          event_id?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          provider_message_id?: string | null
          recipient?: string
          recipient_profile_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_contracts: {
        Row: {
          cancelled_at: string | null
          contracted_amount_cents: number
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          patient_id: string
          plan_id: string
          plan_price_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          contracted_amount_cents: number
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          plan_id: string
          plan_price_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          contracted_amount_cents?: number
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          plan_id?: string
          plan_price_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_contracts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_contracts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_contracts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_contracts_plan_price_id_fkey"
            columns: ["plan_price_id"]
            isOneToOne: false
            referencedRelation: "plan_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_materials: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          description: string | null
          external_url: string | null
          file_name: string | null
          file_size_bytes: number | null
          id: string
          kind: string
          mime_type: string | null
          nutritionist_id: string
          storage_path: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          nutritionist_id: string
          storage_path?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          nutritionist_id?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_materials_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_materials_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_materials_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          archived_at: string | null
          birth_date: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          nutritionist_id: string
          phone: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["patient_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          nutritionist_id: string
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          nutritionist_id?: string
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          contract_id: string | null
          created_at: string
          external_id: string | null
          id: string
          idempotency_key: string | null
          installment_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string | null
          patient_id: string
          provider: string
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contract_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          idempotency_key?: string | null
          installment_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          patient_id: string
          provider?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contract_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          idempotency_key?: string | null
          installment_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          patient_id?: string
          provider?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_financial_summary"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "patient_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["current_contract_id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "contract_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installment_payment_summary"
            referencedColumns: ["installment_id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_benefits: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          plan_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          plan_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          plan_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_benefits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          id: string
          installments: number
          is_primary: boolean
          label: string
          payment_type: Database["public"]["Enums"]["plan_price_payment_type"]
          plan_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          id?: string
          installments?: number
          is_primary?: boolean
          label: string
          payment_type: Database["public"]["Enums"]["plan_price_payment_type"]
          plan_id: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          id?: string
          installments?: number
          is_primary?: boolean
          label?: string
          payment_type?: Database["public"]["Enums"]["plan_price_payment_type"]
          plan_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          available_for_sale: boolean
          code: string
          created_at: string
          duration_months: number | null
          id: string
          name: string
          publicly_visible: boolean
          sessions_in_person: number | null
          sessions_online: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_for_sale?: boolean
          code: string
          created_at?: string
          duration_months?: number | null
          id?: string
          name: string
          publicly_visible?: boolean
          sessions_in_person?: number | null
          sessions_online?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_for_sale?: boolean
          code?: string
          created_at?: string
          duration_months?: number | null
          id?: string
          name?: string
          publicly_visible?: boolean
          sessions_in_person?: number | null
          sessions_online?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["profile_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Relationships: []
      }
      scheduling_settings: {
        Row: {
          created_at: string
          default_duration_minutes: number
          max_booking_horizon_days: number | null
          min_booking_notice_hours: number | null
          min_cancellation_notice_hours: number | null
          nutritionist_id: string
          patient_can_book: boolean
          patient_can_choose_modality: boolean
          slot_granularity_minutes: number
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_duration_minutes?: number
          max_booking_horizon_days?: number | null
          min_booking_notice_hours?: number | null
          min_cancellation_notice_hours?: number | null
          nutritionist_id: string
          patient_can_book?: boolean
          patient_can_choose_modality?: boolean
          slot_granularity_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_duration_minutes?: number
          max_booking_horizon_days?: number | null
          min_booking_notice_hours?: number | null
          min_cancellation_notice_hours?: number | null
          nutritionist_id?: string
          patient_can_book?: boolean
          patient_can_choose_modality?: boolean
          slot_granularity_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_settings_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      supplement_recommendations: {
        Row: {
          active: boolean
          archived_at: string | null
          archived_by: string | null
          brand: string | null
          created_at: string
          created_by: string | null
          dose_text: string | null
          ends_on: string | null
          id: string
          image_path: string | null
          instructions: string | null
          name: string
          notes: string | null
          patient_id: string
          purchase_url: string | null
          schedule_text: string | null
          starts_on: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          archived_by?: string | null
          brand?: string | null
          created_at?: string
          created_by?: string | null
          dose_text?: string | null
          ends_on?: string | null
          id?: string
          image_path?: string | null
          instructions?: string | null
          name: string
          notes?: string | null
          patient_id: string
          purchase_url?: string | null
          schedule_text?: string | null
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          archived_by?: string | null
          brand?: string | null
          created_at?: string
          created_by?: string | null
          dose_text?: string | null
          ends_on?: string | null
          id?: string
          image_path?: string | null
          instructions?: string | null
          name?: string
          notes?: string | null
          patient_id?: string
          purchase_url?: string | null
          schedule_text?: string | null
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplement_recommendations_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplement_recommendations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplement_recommendations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "supplement_recommendations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "supplement_recommendations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplement_recommendations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      contract_financial_summary: {
        Row: {
          contract_id: string | null
          contract_status: Database["public"]["Enums"]["contract_status"] | null
          contracted_amount_cents: number | null
          forecast_cents: number | null
          patient_id: string | null
          pending_cents: number | null
          plan_id: string | null
          received_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_contracts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_active_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_contracts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_contracts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_payment_summary: {
        Row: {
          amount_cents: number | null
          contract_id: string | null
          installment_id: string | null
          received_cents: number | null
          remaining_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_financial_summary"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "patient_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "patient_overview"
            referencedColumns: ["current_contract_id"]
          },
        ]
      }
      patient_active_status: {
        Row: {
          has_active_contract: boolean | null
          is_effectively_active: boolean | null
          nutritionist_id: string | null
          patient_id: string | null
          patient_status: Database["public"]["Enums"]["patient_status"] | null
        }
        Insert: {
          has_active_contract?: never
          is_effectively_active?: never
          nutritionist_id?: string | null
          patient_id?: string | null
          patient_status?: Database["public"]["Enums"]["patient_status"] | null
        }
        Update: {
          has_active_contract?: never
          is_effectively_active?: never
          nutritionist_id?: string | null
          patient_id?: string | null
          patient_status?: Database["public"]["Enums"]["patient_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_overview: {
        Row: {
          archived_at: string | null
          birth_date: string | null
          created_at: string | null
          current_contract_id: string | null
          current_contracted_amount_cents: number | null
          current_end_date: string | null
          current_plan_code: string | null
          current_plan_id: string | null
          current_plan_name: string | null
          current_start_date: string | null
          email: string | null
          full_name: string | null
          has_active_contract: boolean | null
          is_effectively_active: boolean | null
          next_appointment_at: string | null
          next_appointment_modality:
            | Database["public"]["Enums"]["appointment_modality"]
            | null
          nutritionist_id: string | null
          patient_id: string | null
          patient_status: Database["public"]["Enums"]["patient_status"] | null
          phone: string | null
          profile_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_contracts_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_meal_plan: { Args: { p_plan_id: string }; Returns: undefined }
      assessment_visible_to_patient: {
        Args: { p_assessment_id: string }
        Returns: boolean
      }
      book_appointment: {
        Args: {
          p_allow_outside_availability?: boolean
          p_amount_cents?: number
          p_contract_id?: string
          p_ends_at: string
          p_modality: Database["public"]["Enums"]["appointment_modality"]
          p_patient_id: string
          p_starts_at: string
          p_status?: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: string
      }
      busy_intervals: {
        Args: { p_from: string; p_nutritionist_id: string; p_to: string }
        Returns: {
          ends_at: string
          kind: string
          starts_at: string
        }[]
      }
      cancel_contract: { Args: { p_contract_id: string }; Returns: undefined }
      cancel_payment: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: undefined
      }
      complete_contract: { Args: { p_contract_id: string }; Returns: undefined }
      copy_day_meals: {
        Args: { p_source_day_id: string; p_target_day_id: string }
        Returns: undefined
      }
      copy_meal_into_day: {
        Args: {
          p_meal_id: string
          p_sort_order: number
          p_target_day_id: string
        }
        Returns: string
      }
      create_contract_with_installments: {
        Args: {
          p_contracted_amount_cents: number
          p_end_date?: string
          p_installments: Json
          p_notes?: string
          p_patient_id: string
          p_plan_id: string
          p_plan_price_id?: string
          p_start_date: string
        }
        Returns: string
      }
      create_meal_plan: {
        Args: {
          p_notes?: string
          p_patient_id: string
          p_source_version_id?: string
          p_start_date?: string
          p_title: string
        }
        Returns: string
      }
      create_meal_plan_version: {
        Args: { p_plan_id: string; p_source_version_id?: string }
        Returns: string
      }
      current_profile_role: {
        Args: never
        Returns: Database["public"]["Enums"]["profile_role"]
      }
      discard_meal_plan_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      duplicate_meal: {
        Args: { p_meal_id: string; p_target_day_id?: string }
        Returns: string
      }
      duplicate_meal_plan_day: {
        Args: {
          p_day_id: string
          p_replace?: boolean
          p_target_weekday: number
        }
        Returns: string
      }
      financial_period_summary: {
        Args: { p_from: string; p_timezone?: string; p_to: string }
        Returns: {
          balance_cents: number
          expense_cents: number
          forecast_cents: number
          income_cents: number
          overdue_cents: number
          pending_cents: number
          received_cents: number
        }[]
      }
      has_valid_media_consent: {
        Args: { target_consent_id: string }
        Returns: boolean
      }
      is_nutritionist_of_patient: {
        Args: { target_patient_id: string }
        Returns: boolean
      }
      is_patient_self: { Args: { target_patient_id: string }; Returns: boolean }
      material_visible_to_patient: {
        Args: { p_material_id: string }
        Returns: boolean
      }
      meal_plan_version_status_of_day: {
        Args: { p_day_id: string }
        Returns: Database["public"]["Enums"]["meal_plan_version_status"]
      }
      monthly_financial_series: {
        Args: {
          p_months?: number
          p_months_ahead?: number
          p_timezone?: string
        }
        Returns: {
          due_cents: number
          expense_cents: number
          forecast_cents: number
          income_cents: number
          month_start: string
          received_cents: number
        }[]
      }
      publish_meal_plan_version: {
        Args: { p_version_id: string }
        Returns: string
      }
      record_manual_payment: {
        Args: {
          p_amount_cents: number
          p_appointment_id?: string
          p_category_id?: string
          p_contract_id?: string
          p_idempotency_key: string
          p_installment_id?: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_paid_at: string
          p_patient_id: string
          p_timezone?: string
        }
        Returns: string
      }
      reschedule_appointment: {
        Args: {
          p_allow_outside_availability?: boolean
          p_appointment_id: string
          p_ends_at: string
          p_modality?: Database["public"]["Enums"]["appointment_modality"]
          p_starts_at: string
        }
        Returns: string
      }
      safe_uuid: { Args: { value: string }; Returns: string }
      set_assessment_measurements: {
        Args: { p_assessment_id: string; p_values: Json }
        Returns: undefined
      }
      validate_booking_window: {
        Args: {
          p_as_patient: boolean
          p_ends_at: string
          p_modality: Database["public"]["Enums"]["appointment_modality"]
          p_nutritionist_id: string
          p_starts_at: string
        }
        Returns: undefined
      }
    }
    Enums: {
      appointment_modality: "IN_PERSON" | "ONLINE"
      appointment_status:
        | "SCHEDULED"
        | "CONFIRMED"
        | "COMPLETED"
        | "NO_SHOW"
        | "CANCELLED"
        | "RESCHEDULED"
      blog_post_status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
      contract_status: "ACTIVE" | "COMPLETED" | "CANCELLED"
      financial_origin: "MANUAL" | "APPOINTMENT" | "PAYMENT"
      financial_transaction_status: "PENDING" | "CONFIRMED" | "CANCELLED"
      financial_type: "INCOME" | "EXPENSE"
      food_photo_analysis_status:
        | "PENDING"
        | "ANALYZED"
        | "CONFIRMED"
        | "FAILED"
      installment_status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED"
      meal_plan_version_status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
      notification_channel: "IN_APP" | "EMAIL" | "WHATSAPP"
      notification_delivery_status: "PENDING" | "SENT" | "FAILED"
      patient_status: "ACTIVE" | "INACTIVE"
      payment_method: "PIX" | "CARD" | "CASH" | "BANK_TRANSFER" | "OTHER"
      payment_status: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED"
      plan_price_payment_type: "AVISTA" | "PARCELADO" | "REFERENCIA"
      profile_role: "NUTRITIONIST" | "PATIENT" | "ADMIN"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_modality: ["IN_PERSON", "ONLINE"],
      appointment_status: [
        "SCHEDULED",
        "CONFIRMED",
        "COMPLETED",
        "NO_SHOW",
        "CANCELLED",
        "RESCHEDULED",
      ],
      blog_post_status: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      contract_status: ["ACTIVE", "COMPLETED", "CANCELLED"],
      financial_origin: ["MANUAL", "APPOINTMENT", "PAYMENT"],
      financial_transaction_status: ["PENDING", "CONFIRMED", "CANCELLED"],
      financial_type: ["INCOME", "EXPENSE"],
      food_photo_analysis_status: [
        "PENDING",
        "ANALYZED",
        "CONFIRMED",
        "FAILED",
      ],
      installment_status: ["PENDING", "PAID", "OVERDUE", "CANCELLED"],
      meal_plan_version_status: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      notification_channel: ["IN_APP", "EMAIL", "WHATSAPP"],
      notification_delivery_status: ["PENDING", "SENT", "FAILED"],
      patient_status: ["ACTIVE", "INACTIVE"],
      payment_method: ["PIX", "CARD", "CASH", "BANK_TRANSFER", "OTHER"],
      payment_status: ["PENDING", "CONFIRMED", "FAILED", "REFUNDED"],
      plan_price_payment_type: ["AVISTA", "PARCELADO", "REFERENCIA"],
      profile_role: ["NUTRITIONIST", "PATIENT", "ADMIN"],
    },
  },
} as const

