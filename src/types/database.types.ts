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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      account_deletion_legal_audit: {
        Row: {
          consent_snapshot: Json
          created_at: string
          deleted_at: string
          deletion_id: string | null
          email_hash: string | null
          id: string
          last_sign_in_at: string | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          signed_up_at: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          user_id: string
        }
        Insert: {
          consent_snapshot?: Json
          created_at?: string
          deleted_at: string
          deletion_id?: string | null
          email_hash?: string | null
          id?: string
          last_sign_in_at?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          signed_up_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          user_id: string
        }
        Update: {
          consent_snapshot?: Json
          created_at?: string
          deleted_at?: string
          deletion_id?: string | null
          email_hash?: string | null
          id?: string
          last_sign_in_at?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          signed_up_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_legal_audit_deletion_id_fkey"
            columns: ["deletion_id"]
            isOneToOne: false
            referencedRelation: "account_deletions"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletions: {
        Row: {
          active_plan_id: string | null
          active_plan_name: string | null
          active_subscription_status: string | null
          deleted_at: string
          email_hash: string | null
          files_deleted: number
          files_failed: number
          id: string
          last_sign_in_at: string | null
          legal_audit_snapshot: Json
          metadata: Json
          privacy_accepted_at: string | null
          privacy_version: string | null
          reason: string | null
          signed_up_at: string | null
          storage_cleanup_completed_at: string | null
          stripe_customer_id: string | null
          stripe_sub_id: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          user_id: string
        }
        Insert: {
          active_plan_id?: string | null
          active_plan_name?: string | null
          active_subscription_status?: string | null
          deleted_at?: string
          email_hash?: string | null
          files_deleted?: number
          files_failed?: number
          id?: string
          last_sign_in_at?: string | null
          legal_audit_snapshot?: Json
          metadata?: Json
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          reason?: string | null
          signed_up_at?: string | null
          storage_cleanup_completed_at?: string | null
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          user_id: string
        }
        Update: {
          active_plan_id?: string | null
          active_plan_name?: string | null
          active_subscription_status?: string | null
          deleted_at?: string
          email_hash?: string | null
          files_deleted?: number
          files_failed?: number
          id?: string
          last_sign_in_at?: string | null
          legal_audit_snapshot?: Json
          metadata?: Json
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          reason?: string | null
          signed_up_at?: string | null
          storage_cleanup_completed_at?: string | null
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_nugget_grants: {
        Row: {
          admin_id: string
          amount: number
          created_at: string
          id: string
          reason: string
          target_user_id: string
        }
        Insert: {
          admin_id: string
          amount: number
          created_at?: string
          id?: string
          reason?: string
          target_user_id: string
        }
        Update: {
          admin_id?: string
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_nugget_grants_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_nugget_grants_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_plan_grants: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string | null
          granted_plan_id: string
          id: string
          previous_plan_id: string | null
          reason: string
          target_user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at?: string | null
          granted_plan_id: string
          id?: string
          previous_plan_id?: string | null
          reason?: string
          target_user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string | null
          granted_plan_id?: string
          id?: string
          previous_plan_id?: string | null
          reason?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_plan_grants_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_plan_grants_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
          value_nuggets: number
          value_usd_cents: number
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
          value_nuggets?: number
          value_usd_cents?: number
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
          value_nuggets?: number
          value_usd_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      card_spotlights: {
        Row: {
          card_id: string
          card_kind: string
          created_at: string
          expires_at: string
          id: string
          metadata: Json
          nuggets_spent: number
          owner_id: string
          scope: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          card_kind: string
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          nuggets_spent?: number
          owner_id: string
          scope?: string | null
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          card_kind?: string
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          nuggets_spent?: number
          owner_id?: string
          scope?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_spotlights_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_spotlights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          contact_owner_id: string | null
          created_at: string
          id: string
          message_code: string | null
          message_params: Json
          message_type: string
          metadata: Json
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          contact_owner_id?: string | null
          created_at?: string
          id?: string
          message_code?: string | null
          message_params?: Json
          message_type?: string
          metadata?: Json
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          contact_owner_id?: string | null
          created_at?: string
          id?: string
          message_code?: string | null
          message_params?: Json
          message_type?: string
          metadata?: Json
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_contact_owner_id_fkey"
            columns: ["contact_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          accepted_at: string
          anonymous_id: string | null
          consent_type: string
          id: string
          ip_hint: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string | null
          version: string
        }
        Insert: {
          accepted_at?: string
          anonymous_id?: string | null
          consent_type?: string
          id?: string
          ip_hint?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          version?: string
        }
        Update: {
          accepted_at?: string
          anonymous_id?: string | null
          consent_type?: string
          id?: string
          ip_hint?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_workflow_items: {
        Row: {
          code: string
          completed_at: string | null
          created_at: string
          id: string
          metadata: Json
          property_id: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          property_id: string
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          property_id?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_workflow_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_workflow_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_records_audit: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          id: number
          owner_ref: string | null
          record_id: string | null
          row_data: Json
          table_name: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          id?: number
          owner_ref?: string | null
          record_id?: string | null
          row_data: Json
          table_name: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          id?: number
          owner_ref?: string | null
          record_id?: string | null
          row_data?: Json
          table_name?: string
        }
        Relationships: []
      }
      edge_rate_limits: {
        Row: {
          expires_at: string
          operation: string
          request_count: number
          subject_id: string
          window_started_at: string
        }
        Insert: {
          expires_at: string
          operation: string
          request_count?: number
          subject_id: string
          window_started_at: string
        }
        Update: {
          expires_at?: string
          operation?: string
          request_count?: number
          subject_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      geocode_cache: {
        Row: {
          address_hash: string
          confidence: number | null
          created_at: string
          error: string | null
          lat: number | null
          lng: number | null
          normalized_address: string
          provider_used: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_hash: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          lat?: number | null
          lng?: number | null
          normalized_address: string
          provider_used?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_hash?: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          lat?: number | null
          lng?: number | null
          normalized_address?: string
          provider_used?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maxxis_pending_actions: {
        Row: {
          action_type: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          payload: Json
          status: string
          user_id: string
        }
        Insert: {
          action_type: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          status?: string
          user_id: string
        }
        Update: {
          action_type?: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maxxis_pending_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nugget_purchases: {
        Row: {
          bonus: number
          created_at: string
          id: string
          pack_id: string
          price_cents: number
          qty: number
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_id: string | null
          user_id: string
        }
        Insert: {
          bonus?: number
          created_at?: string
          id?: string
          pack_id: string
          price_cents: number
          qty: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_id?: string | null
          user_id: string
        }
        Update: {
          bonus?: number
          created_at?: string
          id?: string
          pack_id?: string
          price_cents?: number
          qty?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nugget_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_usage_counters: {
        Row: {
          action: string
          count: number
          period_scope: string
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          count?: number
          period_scope: string
          period_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          count?: number
          period_scope?: string
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_usage_counters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_profiles: {
        Row: {
          category: string | null
          category_b: string | null
          created_at: string
          id: string
          markets: string[]
          photo_b_url: string | null
          pitch: string | null
          primary_category: string | null
          primary_category_b: string | null
          profile_payload: Json
          profile_version: number
          services: string[]
          skills: string[]
          subcategory: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          category_b?: string | null
          created_at?: string
          id?: string
          markets?: string[]
          photo_b_url?: string | null
          pitch?: string | null
          primary_category?: string | null
          primary_category_b?: string | null
          profile_payload?: Json
          profile_version?: number
          services?: string[]
          skills?: string[]
          subcategory?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          category_b?: string | null
          created_at?: string
          id?: string
          markets?: string[]
          photo_b_url?: string | null
          pitch?: string | null
          primary_category?: string | null
          primary_category_b?: string | null
          profile_payload?: Json
          profile_version?: number
          services?: string[]
          skills?: string[]
          subcategory?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          baths: number
          beds: number
          cap_rate: number | null
          city: string | null
          created_at: string
          deal_closed: boolean
          deal_tag: string | null
          description: string | null
          geocode_confidence: number | null
          geocode_input: string | null
          geocode_source: string | null
          geocode_status: string
          geocoded_at: string | null
          hide_street_address_on_card: boolean
          id: string
          improvement: string | null
          include_in_preview: boolean
          is_active: boolean
          lat: number | null
          lng: number | null
          lot: string | null
          markets: string[]
          objective: string | null
          owner_account_type: string | null
          owner_id: string
          pending_deal: boolean
          pending_deal_expires_at: string | null
          pending_deal_started_at: string | null
          price: number
          primary_profile: string
          publish_to_showcase: boolean
          rehab: number
          source: string | null
          sqft: string | null
          state: string | null
          type: string
          updated_at: string
          video: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          baths?: number
          beds?: number
          cap_rate?: number | null
          city?: string | null
          created_at?: string
          deal_closed?: boolean
          deal_tag?: string | null
          description?: string | null
          geocode_confidence?: number | null
          geocode_input?: string | null
          geocode_source?: string | null
          geocode_status?: string
          geocoded_at?: string | null
          hide_street_address_on_card?: boolean
          id?: string
          improvement?: string | null
          include_in_preview?: boolean
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          lot?: string | null
          markets?: string[]
          objective?: string | null
          owner_account_type?: string | null
          owner_id: string
          pending_deal?: boolean
          pending_deal_expires_at?: string | null
          pending_deal_started_at?: string | null
          price?: number
          primary_profile?: string
          publish_to_showcase?: boolean
          rehab?: number
          source?: string | null
          sqft?: string | null
          state?: string | null
          type: string
          updated_at?: string
          video?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          baths?: number
          beds?: number
          cap_rate?: number | null
          city?: string | null
          created_at?: string
          deal_closed?: boolean
          deal_tag?: string | null
          description?: string | null
          geocode_confidence?: number | null
          geocode_input?: string | null
          geocode_source?: string | null
          geocode_status?: string
          geocoded_at?: string | null
          hide_street_address_on_card?: boolean
          id?: string
          improvement?: string | null
          include_in_preview?: boolean
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          lot?: string | null
          markets?: string[]
          objective?: string | null
          owner_account_type?: string | null
          owner_id?: string
          pending_deal?: boolean
          pending_deal_expires_at?: string | null
          pending_deal_started_at?: string | null
          price?: number
          primary_profile?: string
          publish_to_showcase?: boolean
          rehab?: number
          source?: string | null
          sqft?: string | null
          state?: string | null
          type?: string
          updated_at?: string
          video?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          property_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          property_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          property_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_unlocks: {
        Row: {
          base_cost: number
          buyer_id: string
          created_at: string
          exclusivity_cost: number
          expires_at: string | null
          id: string
          metadata: Json
          mode: string
          normal_unlock_count_at_purchase: number
          owner_id: string
          profile_scope: string
          property_id: string
          status: string
          total_cost: number
        }
        Insert: {
          base_cost?: number
          buyer_id: string
          created_at?: string
          exclusivity_cost?: number
          expires_at?: string | null
          id?: string
          metadata?: Json
          mode?: string
          normal_unlock_count_at_purchase?: number
          owner_id: string
          profile_scope?: string
          property_id: string
          status?: string
          total_cost?: number
        }
        Update: {
          base_cost?: number
          buyer_id?: string
          created_at?: string
          exclusivity_cost?: number
          expires_at?: string | null
          id?: string
          metadata?: Json
          mode?: string
          normal_unlock_count_at_purchase?: number
          owner_id?: string
          profile_scope?: string
          property_id?: string
          status?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_unlocks_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_unlocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_unlocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      service_health_events: {
        Row: {
          created_at: string
          id: string
          message: string | null
          metadata: Json
          service: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          service: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          service?: string
          status?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          markets: string[]
          media_images: string[]
          owner_id: string
          price: number | null
          primary_profile: string
          publish_to_connections: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          markets?: string[]
          media_images?: string[]
          owner_id: string
          price?: number | null
          primary_profile?: string
          publish_to_connections?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          markets?: string[]
          media_images?: string[]
          owner_id?: string
          price?: number | null
          primary_profile?: string
          publish_to_connections?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_event_reprocess_queue: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          event_type: string
          last_error: string | null
          raw_event: Json
          scheduled_for: string
          status: string
          stripe_event_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at: string
          created_at?: string
          event_type: string
          last_error?: string | null
          raw_event: Json
          scheduled_for?: string
          status?: string
          stripe_event_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_type?: string
          last_error?: string | null
          raw_event?: Json
          scheduled_for?: string
          status?: string
          stripe_event_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_events_log: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: number
          processed: boolean
          received_at: string
          skip_reason: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: number
          processed?: boolean
          received_at?: string
          skip_reason?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: number
          processed?: boolean
          received_at?: string
          skip_reason?: string | null
        }
        Relationships: []
      }
      stripe_events_processed: {
        Row: {
          event_type: string
          first_received_at: string
          processed_at: string | null
          skip_reason: string | null
          status: string
          stripe_event_id: string
          updated_at: string
        }
        Insert: {
          event_type: string
          first_received_at?: string
          processed_at?: string | null
          skip_reason?: string | null
          status?: string
          stripe_event_id: string
          updated_at?: string
        }
        Update: {
          event_type?: string
          first_received_at?: string
          processed_at?: string | null
          skip_reason?: string | null
          status?: string
          stripe_event_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          attempts: number
          event_id: string
          event_type: string
          last_error: string | null
          processed_at: string | null
          received_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          event_id: string
          event_type: string
          last_error?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          event_id?: string
          event_type?: string
          last_error?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          plan_name: string
          price_cents: number
          status: string
          stripe_customer_id: string | null
          stripe_sub_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          plan_name?: string
          price_cents?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          plan_name?: string
          price_cents?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          delivery_channel: string
          email_delivery_status: string
          id: string
          metadata: Json
          sender_role: string
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          delivery_channel?: string
          email_delivery_status?: string
          id?: string
          metadata?: Json
          sender_role: string
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          delivery_channel?: string
          email_delivery_status?: string
          id?: string
          metadata?: Json
          sender_role?: string
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          channel: string
          closed_at: string | null
          contact_id: string
          created_at: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          ticket_number: number
          unread_for_admin: number
          unread_for_user: number
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          ticket_number?: number
          unread_for_admin?: number
          unread_for_user?: number
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          ticket_number?: number
          unread_for_admin?: number
          unread_for_user?: number
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      unlock_intents: {
        Row: {
          base_cost: number
          buyer_id: string
          consumed_at: string | null
          created_at: string
          exclusivity_cost: number
          expires_at: string
          id: string
          metadata: Json
          mode: string
          normal_unlock_count: number
          profile_scope: string
          property_id: string | null
          scope: string
          seller_id: string
          status: string
          total_cost: number
        }
        Insert: {
          base_cost: number
          buyer_id: string
          consumed_at?: string | null
          created_at?: string
          exclusivity_cost?: number
          expires_at?: string
          id?: string
          metadata?: Json
          mode?: string
          normal_unlock_count?: number
          profile_scope?: string
          property_id?: string | null
          scope?: string
          seller_id: string
          status?: string
          total_cost: number
        }
        Update: {
          base_cost?: number
          buyer_id?: string
          consumed_at?: string | null
          created_at?: string
          exclusivity_cost?: number
          expires_at?: string
          id?: string
          metadata?: Json
          mode?: string
          normal_unlock_count?: number
          profile_scope?: string
          property_id?: string | null
          scope?: string
          seller_id?: string
          status?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "unlock_intents_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_intents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_intents_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      unlocks: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          nuggets_spent: number
          profile_scope: string
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          nuggets_spent?: number
          profile_scope?: string
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          nuggets_spent?: number
          profile_scope?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlocks_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlocks_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_app_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          last_page: string | null
          last_seen_at: string
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          last_page?: string | null
          last_seen_at?: string
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          last_page?: string | null
          last_seen_at?: string
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_heartbeats: {
        Row: {
          last_seen_at: string
          page: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          page?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          page?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_heartbeats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feed_actions: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          photo_url: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          photo_url?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          photo_url?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_type: string
          created_at: string
          deleted_at: string | null
          deletion_id: string | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          nuggets: number
          phone: string | null
          plan_id: string
          plan_override_expires_at: string | null
          plan_override_reason: string | null
          plan_override_source: string | null
          plan_override_updated_at: string | null
          settings_payload: Json
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          deleted_at?: string | null
          deletion_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean
          nuggets?: number
          phone?: string | null
          plan_id?: string
          plan_override_expires_at?: string | null
          plan_override_reason?: string | null
          plan_override_source?: string | null
          plan_override_updated_at?: string | null
          settings_payload?: Json
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          deleted_at?: string | null
          deletion_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          nuggets?: number
          phone?: string | null
          plan_id?: string
          plan_override_expires_at?: string | null
          plan_override_reason?: string | null
          plan_override_source?: string | null
          plan_override_updated_at?: string | null
          settings_payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_find_users: {
        Args: { p_limit?: number; p_search: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          nuggets: number
          plan_id: string
        }[]
      }
      admin_get_dashboard_snapshot: { Args: never; Returns: Json }
      admin_get_dashboard_snapshot_base_20260616: { Args: never; Returns: Json }
      admin_get_dashboard_snapshot_base_20260619_checkout_fix: {
        Args: never
        Returns: Json
      }
      admin_get_dashboard_snapshot_base_20260701_stripe_ordering: {
        Args: never
        Returns: Json
      }
      admin_get_dashboard_snapshot_base_20260701_stripe_reprocess_que: {
        Args: never
        Returns: Json
      }
      admin_get_dashboard_snapshot_base_20260708_entitlement_alerts: {
        Args: never
        Returns: Json
      }
      admin_get_support_thread: { Args: { p_ticket_id: string }; Returns: Json }
      admin_get_support_tickets: {
        Args: { p_limit?: number; p_status?: string }
        Returns: Json
      }
      admin_grant_nuggets: {
        Args: { p_amount: number; p_reason?: string; p_target_user_id: string }
        Returns: {
          email: string
          granted_amount: number
          new_balance: number
          user_id: string
        }[]
      }
      admin_reply_support_ticket: {
        Args: { p_body: string; p_close?: boolean; p_ticket_id: string }
        Returns: Json
      }
      admin_set_user_plan_override: {
        Args: {
          p_expires_at?: string
          p_plan_id: string
          p_reason?: string
          p_target_user_id: string
        }
        Returns: {
          email: string
          plan_id: string
          plan_override_expires_at: string
          plan_override_source: string
          previous_plan_id: string
          user_id: string
        }[]
      }
      claim_stripe_reprocess_queue: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          event_type: string
          raw_event: Json
          scheduled_for: string
          stripe_event_id: string
        }[]
      }
      credit_nuggets: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      delete_user_account:
        | { Args: { target_user_id: string }; Returns: undefined }
        | { Args: { p_reason?: string; target_user_id: string }; Returns: Json }
      ds_cancel_maxxis_profile_action: {
        Args: { p_action_id: string }
        Returns: Json
      }
      ds_cancel_maxxis_provider_message: {
        Args: { p_action_id: string }
        Returns: Json
      }
      ds_cancel_unlock_intent: {
        Args: { p_intent_token: string }
        Returns: Json
      }
      ds_check_is_unlocked: {
        Args: { p_contact_id: string; p_user_id?: string }
        Returns: {
          created_at: string
          is_unlocked: boolean
          nuggets_spent: number
          seller_id: string
          unlock_id: string
        }[]
      }
      ds_confirm_maxxis_profile_action: {
        Args: { p_action_id: string }
        Returns: Json
      }
      ds_confirm_maxxis_provider_message: {
        Args: { p_action_id: string }
        Returns: Json
      }
      ds_consume_edge_rate_limit: {
        Args: {
          p_max_requests: number
          p_operation: string
          p_subject_id: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
          retry_after: number
        }[]
      }
      ds_consume_plan_actions: { Args: { p_actions: string[] }; Returns: Json }
      ds_contact_methods_include_chat: {
        Args: { p_methods: Json }
        Returns: boolean
      }
      ds_create_unlock_intent: {
        Args: {
          p_metadata?: Json
          p_mode?: string
          p_profile_scope?: string
          p_property_id?: string
          p_seller_id?: string
        }
        Returns: {
          base_cost: number
          blocked: boolean
          exclusivity_cost: number
          expires_at: string
          intent_token: string
          mode: string
          normal_unlock_count: number
          profile_scope: string
          property_id: string
          scope: string
          seller_id: string
          total_cost: number
        }[]
      }
      ds_data_integrity_audit: {
        Args: never
        Returns: {
          check_code: string
          issue_count: number
          severity: string
        }[]
      }
      ds_deduct_nuggets: {
        Args: { p_amount: number; p_reason?: string }
        Returns: Json
      }
      ds_delete_user_feed_action: {
        Args: { p_action: string; p_entity_id: string; p_entity_type: string }
        Returns: undefined
      }
      ds_get_active_exclusivities: {
        Args: { p_user_id?: string }
        Returns: {
          base_cost: number
          buyer_id: string
          created_at: string
          exclusivity_cost: number
          expires_at: string
          id: string
          mode: string
          owner_id: string
          property_id: string
          status: string
          total_cost: number
        }[]
      }
      ds_get_chat_contact_status: {
        Args: { p_contact_owner_id: string; p_primary_profile?: string }
        Returns: Json
      }
      ds_get_global_feed_inventory: { Args: never; Returns: Json }
      ds_get_my_support_thread: { Args: never; Returns: Json }
      ds_get_plan_usage_snapshot: {
        Args: never
        Returns: {
          active_matches: number
          is_admin: boolean
          likes_today: number
          plan_id: string
          swipes_today: number
          unlocks_this_month: number
        }[]
      }
      ds_get_property_engagement_metrics: {
        Args: { p_property_ids: string[] }
        Returns: {
          exclusive_cost: number
          exclusivity_kind: string
          exclusivity_mode: string
          expires_at: string
          favorite_count: number
          favorite_pct: number
          hot_score: number
          match_count: number
          match_pct: number
          normal_unlock_count: number
          property_id: string
          total_count: number
          unlock_count: number
          unlock_pct: number
        }[]
      }
      ds_get_property_exclusivity_status: {
        Args: { p_property_id: string }
        Returns: Json
      }
      ds_get_property_unlock_quote: {
        Args: { p_property_id: string }
        Returns: {
          base_cost: number
          blocked: boolean
          exclusivity_cost: number
          exclusivity_kind: string
          expires_at: string
          normal_unlock_count: number
          owner_id: string
          property_id: string
        }[]
      }
      ds_get_provider_contact_access: {
        Args: { p_service_ids: string[] }
        Returns: {
          cost: number
          currency: string
          profile_scope: string
          reason: string
          service_id: string
          status: string
        }[]
      }
      ds_get_public_property_details: {
        Args: { p_property_id: string }
        Returns: {
          baths: number
          beds: number
          cap_rate: number
          city: string
          deal_closed: boolean
          deal_tag: string
          description: string
          id: string
          images: string[]
          improvement: string
          is_active: boolean
          lot: string
          markets: string[]
          objective: string
          price: number
          publish_to_showcase: boolean
          rehab: number
          sqft: string
          state: string
          type: string
          zip: string
        }[]
      }
      ds_get_unlocked_contact_cards: {
        Args: { p_user_id: string }
        Returns: Json
      }
      ds_get_unlocked_contact_snapshots: {
        Args: never
        Returns: {
          contact: Json
          nuggets_spent: number
          seller_id: string
          unlocked_at: string
        }[]
      }
      ds_get_user_unlock_state: { Args: { p_user_id?: string }; Returns: Json }
      ds_has_active_owner_exclusivity: {
        Args: { p_buyer_id?: string; p_owner_id: string }
        Returns: boolean
      }
      ds_has_active_profile_exclusivity: {
        Args: {
          p_buyer_id?: string
          p_owner_id: string
          p_profile_scope: string
        }
        Returns: boolean
      }
      ds_is_current_user_admin: { Args: never; Returns: boolean }
      ds_jsonb_strip_personal_fields: {
        Args: { p_payload: Json }
        Returns: Json
      }
      ds_keepalive: { Args: never; Returns: Json }
      ds_maxxis_state_code: { Args: { p_value: string }; Returns: string }
      ds_merge_professional_profile_payload: {
        Args: { p_current: Json; p_incoming: Json }
        Returns: Json
      }
      ds_normalize_maxxis_provider_message: {
        Args: { p_message: string }
        Returns: string
      }
      ds_normalize_profile_scope: { Args: { p_scope: string }; Returns: string }
      ds_plan_allows_chat: {
        Args: { p_is_admin?: boolean; p_plan_id: string }
        Returns: boolean
      }
      ds_plan_limit_for_action: {
        Args: { p_action: string; p_is_admin: boolean; p_plan_id: string }
        Returns: number
      }
      ds_prepare_maxxis_profile_actions: {
        Args: { p_suggestions: Json }
        Returns: {
          action_id: string
          expires_at: string
          operation: string
          suggested_value: string
        }[]
      }
      ds_prepare_maxxis_provider_message: {
        Args: {
          p_idempotency_key?: string
          p_message: string
          p_property_id: string
          p_service_id: string
        }
        Returns: Json
      }
      ds_profile_contact_methods: {
        Args: { p_owner_id: string; p_primary_profile?: string }
        Returns: Json
      }
      ds_profile_portfolio_cost: {
        Args: { p_owner_id: string; p_profile_scope: string }
        Returns: number
      }
      ds_prune_property_unlocks: { Args: never; Returns: number }
      ds_purchase_card_spotlights: {
        Args: { p_items: Json }
        Returns: {
          card_id: string
          card_kind: string
          expires_at: string
          remaining_nuggets: number
          spotlight_id: string
          total_cost: number
        }[]
      }
      ds_purchase_contact_unlock: {
        Args: {
          p_intent_token: string
          p_profile_scope?: string
          p_seller_id: string
        }
        Returns: {
          profile_scope: string
          remaining_nuggets: number
          seller_id: string
          total_cost: number
          unlock_id: string
        }[]
      }
      ds_purchase_exclusivity_unlock: {
        Args: {
          p_intent_token: string
          p_metadata?: Json
          p_property_id: string
          p_seller_id: string
        }
        Returns: {
          base_cost: number
          buyer_id: string
          exclusivity_cost: number
          expires_at: string
          mode: string
          owner_id: string
          property_id: string
          remaining_nuggets: number
          total_cost: number
          unlock_id: string
        }[]
      }
      ds_purchase_property_unlock: {
        Args: {
          p_intent_token?: string
          p_metadata?: Json
          p_mode?: string
          p_property_id: string
        }
        Returns: {
          base_cost: number
          buyer_id: string
          exclusivity_cost: number
          expires_at: string
          mode: string
          normal_unlock_count: number
          owner_id: string
          property_id: string
          remaining_nuggets: number
          total_cost: number
          unlock_id: string
        }[]
      }
      ds_redact_inline_media_jsonb: { Args: { value: Json }; Returns: Json }
      ds_register_app_session: {
        Args: {
          p_device_label?: string
          p_page?: string
          p_session_token: string
        }
        Returns: Json
      }
      ds_require_plan_action: { Args: { p_action: string }; Returns: undefined }
      ds_sanitize_public_feed_jsonb: { Args: { p_value: Json }; Returns: Json }
      ds_sanitize_public_property_text: {
        Args: { p_value: string }
        Returns: string
      }
      ds_sanitize_user_feed_action_payload: {
        Args: { p_payload: Json }
        Returns: Json
      }
      ds_save_professional_profile: {
        Args: {
          p_category: string
          p_category_b: string
          p_expected_version: number
          p_markets: string[]
          p_photo_b_url: string
          p_pitch: string
          p_primary_category: string
          p_primary_category_b: string
          p_profile_payload: Json
          p_services: string[]
          p_skills: string[]
          p_subcategory: string
          p_update_photo_b_url: boolean
        }
        Returns: Json
      }
      ds_search_public_properties: {
        Args: {
          p_bathrooms?: number
          p_bedrooms?: number
          p_city?: string
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_objective?: string
          p_property_ids?: string[]
          p_property_type?: string
          p_state?: string[]
          p_zip_code?: string
        }
        Returns: {
          baths: number
          beds: number
          city: string
          created_at: string
          id: string
          image: string
          objective: string
          price: number
          sqft: string
          state: string
          type: string
          zip: string
        }[]
      }
      ds_search_public_services: {
        Args: {
          p_categories?: string[]
          p_city?: string
          p_keyword?: string
          p_limit_per_category?: number
          p_max_price?: number
          p_min_price?: number
          p_state?: string
        }
        Returns: {
          category: string
          created_at: string
          description: string
          id: string
          markets: string[]
          matched_category: string
          media_images: string[]
          price: number
          title: string
        }[]
      }
      ds_send_support_message: {
        Args: { p_body: string; p_channel?: string; p_subject?: string }
        Returns: Json
      }
      ds_set_manual_deal_workflow_item: {
        Args: { p_code: string; p_property_id: string; p_status: string }
        Returns: Json
      }
      ds_support_message_json: {
        Args: {
          p_message: Database["public"]["Tables"]["support_messages"]["Row"]
        }
        Returns: Json
      }
      ds_support_ticket_json: {
        Args: {
          p_ticket: Database["public"]["Tables"]["support_tickets"]["Row"]
        }
        Returns: Json
      }
      ds_text_array_is_db_safe: {
        Args: { max_bytes?: number; value: string[] }
        Returns: boolean
      }
      ds_text_is_db_safe: {
        Args: { max_bytes?: number; value: string }
        Returns: boolean
      }
      ds_touch_app_session: {
        Args: { p_page?: string; p_session_token: string }
        Returns: Json
      }
      ds_upsert_user_feed_actions: {
        Args: { p_actions: Json }
        Returns: number
      }
      ds_us_state_name: { Args: { p_code: string }; Returns: string }
      ds_validate_maxxis_profile_suggestion: {
        Args: {
          p_dimension: string
          p_operation: string
          p_suggested_value: string
        }
        Returns: Json
      }
      export_user_data: { Args: { target_user_id: string }; Returns: Json }
      increment_stripe_webhook_attempts: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      replace_property_images: {
        Args: { p_image_urls: string[]; p_property_id: string }
        Returns: undefined
      }
      track_app_event: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_event_type: string
          p_metadata?: Json
          p_value_nuggets?: number
          p_value_usd_cents?: number
        }
        Returns: undefined
      }
      track_user_heartbeat: { Args: { p_page?: string }; Returns: undefined }
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
