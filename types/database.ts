export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          created_at: string;
          daily_target: number | null;
          first_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          daily_target?: number | null;
          first_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          daily_target?: number | null;
          first_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_subscriptions: {
        Row: {
          created_at: string;
          grow_direct_debit_id: string | null;
          grow_last_error_message: string | null;
          grow_last_payment_date: string | null;
          grow_last_payment_sum: number | null;
          grow_transaction_code: string | null;
          plan_name: string | null;
          status: "trial" | "active" | "expired" | "cancelled" | "payment_failed" | "past_due";
          trial_start_at: string | null;
          trial_end_at: string | null;
          upgraded_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          grow_direct_debit_id?: string | null;
          grow_last_error_message?: string | null;
          grow_last_payment_date?: string | null;
          grow_last_payment_sum?: number | null;
          grow_transaction_code?: string | null;
          plan_name?: string | null;
          status?: "trial" | "active" | "expired" | "cancelled" | "payment_failed" | "past_due";
          trial_start_at?: string | null;
          trial_end_at?: string | null;
          upgraded_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          grow_direct_debit_id?: string | null;
          grow_last_error_message?: string | null;
          grow_last_payment_date?: string | null;
          grow_last_payment_sum?: number | null;
          grow_transaction_code?: string | null;
          plan_name?: string | null;
          status?: "trial" | "active" | "expired" | "cancelled" | "payment_failed" | "past_due";
          trial_start_at?: string | null;
          trial_end_at?: string | null;
          upgraded_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      grow_webhook_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          transaction_code: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          payload: Json;
          processed_at?: string | null;
          transaction_code?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          transaction_code?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "grow_webhook_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          closed_at: string | null;
          created_at: string;
          deal_probability: number;
          email: string | null;
          id: string;
          last_contact_date: string | null;
          full_name: string;
          next_action_date: string | null;
          next_action_type: string | null;
          notes: string | null;
          phone: string | null;
          priority: string;
          reason_not_closed: string | null;
          source: string;
          status: string;
          updated_at: string;
          user_id: string;
          value: number;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          deal_probability?: number;
          email?: string | null;
          id?: string;
          last_contact_date?: string | null;
          full_name: string;
          next_action_date?: string | null;
          next_action_type?: string | null;
          notes?: string | null;
          phone?: string | null;
          priority?: string;
          reason_not_closed?: string | null;
          source: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          value?: number;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          deal_probability?: number;
          email?: string | null;
          id?: string;
          last_contact_date?: string | null;
          full_name?: string;
          next_action_date?: string | null;
          next_action_type?: string | null;
          notes?: string | null;
          phone?: string | null;
          priority?: string;
          reason_not_closed?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          position: number;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          position: number;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          position?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          assigned_to: string | null;
          completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          is_automated: boolean;
          linked_lead_id: string | null;
          priority: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          assigned_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_automated?: boolean;
          linked_lead_id?: string | null;
          priority?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assigned_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_automated?: boolean;
          linked_lead_id?: string | null;
          priority?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_linked_lead_id_fkey";
            columns: ["linked_lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_external_sources: {
        Row: {
          ad_id: string | null;
          ad_name: string | null;
          adset_id: string | null;
          adset_name: string | null;
          campaign_id: string | null;
          campaign_name: string | null;
          created_at: string;
          external_lead_id: string;
          form_id: string | null;
          form_name: string | null;
          id: string;
          lead_id: string;
          page_id: string | null;
          page_name: string | null;
          provider: string;
          received_at: string;
          submitted_at: string | null;
          user_id: string;
        };
        Insert: {
          ad_id?: string | null;
          ad_name?: string | null;
          adset_id?: string | null;
          adset_name?: string | null;
          campaign_id?: string | null;
          campaign_name?: string | null;
          created_at?: string;
          external_lead_id: string;
          form_id?: string | null;
          form_name?: string | null;
          id?: string;
          lead_id: string;
          page_id?: string | null;
          page_name?: string | null;
          provider: string;
          received_at?: string;
          submitted_at?: string | null;
          user_id: string;
        };
        Update: {
          ad_id?: string | null;
          ad_name?: string | null;
          adset_id?: string | null;
          adset_name?: string | null;
          campaign_id?: string | null;
          campaign_name?: string | null;
          created_at?: string;
          external_lead_id?: string;
          form_id?: string | null;
          form_name?: string | null;
          id?: string;
          lead_id?: string;
          page_id?: string | null;
          page_name?: string | null;
          provider?: string;
          received_at?: string;
          submitted_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_external_sources_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      roi_tools: {
        Row: {
          average_sale_value: number;
          category: string;
          created_at: string;
          id: string;
          leads_count: number;
          monthly_cost: number;
          name: string;
          notes: string;
          result_type: string;
          sales_count: number;
          user_id: string;
        };
        Insert: {
          average_sale_value?: number;
          category?: string;
          created_at?: string;
          id?: string;
          leads_count?: number;
          monthly_cost?: number;
          name: string;
          notes?: string;
          result_type?: string;
          sales_count?: number;
          user_id: string;
        };
        Update: {
          average_sale_value?: number;
          category?: string;
          created_at?: string;
          id?: string;
          leads_count?: number;
          monthly_cost?: number;
          name?: string;
          notes?: string;
          result_type?: string;
          sales_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      business_center_monthly_metrics: {
        Row: {
          actual_content_published: number;
          actual_leads: number;
          actual_new_customers: number;
          actual_revenue: number;
          actual_sales_calls: number;
          created_at: string;
          id: string;
          month_start: string;
          notes: string | null;
          target_content_published: number | null;
          target_leads: number | null;
          target_new_customers: number | null;
          target_revenue: number | null;
          target_sales_calls: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actual_content_published?: number;
          actual_leads?: number;
          actual_new_customers?: number;
          actual_revenue?: number;
          actual_sales_calls?: number;
          created_at?: string;
          id?: string;
          month_start: string;
          notes?: string | null;
          target_content_published?: number | null;
          target_leads?: number | null;
          target_new_customers?: number | null;
          target_revenue?: number | null;
          target_sales_calls?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          actual_content_published?: number;
          actual_leads?: number;
          actual_new_customers?: number;
          actual_revenue?: number;
          actual_sales_calls?: number;
          created_at?: string;
          id?: string;
          month_start?: string;
          notes?: string | null;
          target_content_published?: number | null;
          target_leads?: number | null;
          target_new_customers?: number | null;
          target_revenue?: number | null;
          target_sales_calls?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      business_center_content_items: {
        Row: {
          campaign_source: string | null;
          comments_count: number | null;
          content_type: "Reel" | "Post" | "Carousel" | "Story" | "Video" | "Live" | "Other";
          content_url: string | null;
          created_at: string;
          id: string;
          likes_count: number | null;
          metrics_updated_at: string | null;
          notes: string | null;
          platform: "Instagram" | "TikTok" | "YouTube" | "Facebook" | "LinkedIn" | "Other";
          profile_visits_count: number | null;
          promoted_product: string | null;
          published_on: string | null;
          saves_count: number | null;
          shares_count: number | null;
          status: "draft" | "published" | "archived";
          target_audience: string | null;
          title: string;
          topic: string | null;
          updated_at: string;
          user_id: string;
          views_count: number | null;
        };
        Insert: {
          campaign_source?: string | null;
          comments_count?: number | null;
          content_type: "Reel" | "Post" | "Carousel" | "Story" | "Video" | "Live" | "Other";
          content_url?: string | null;
          created_at?: string;
          id?: string;
          likes_count?: number | null;
          metrics_updated_at?: string | null;
          notes?: string | null;
          platform: "Instagram" | "TikTok" | "YouTube" | "Facebook" | "LinkedIn" | "Other";
          profile_visits_count?: number | null;
          promoted_product?: string | null;
          published_on?: string | null;
          saves_count?: number | null;
          shares_count?: number | null;
          status?: "draft" | "published" | "archived";
          target_audience?: string | null;
          title: string;
          topic?: string | null;
          updated_at?: string;
          user_id: string;
          views_count?: number | null;
        };
        Update: {
          campaign_source?: string | null;
          comments_count?: number | null;
          content_type?: "Reel" | "Post" | "Carousel" | "Story" | "Video" | "Live" | "Other";
          content_url?: string | null;
          created_at?: string;
          id?: string;
          likes_count?: number | null;
          metrics_updated_at?: string | null;
          notes?: string | null;
          platform?: "Instagram" | "TikTok" | "YouTube" | "Facebook" | "LinkedIn" | "Other";
          profile_visits_count?: number | null;
          promoted_product?: string | null;
          published_on?: string | null;
          saves_count?: number | null;
          shares_count?: number | null;
          status?: "draft" | "published" | "archived";
          target_audience?: string | null;
          title?: string;
          topic?: string | null;
          updated_at?: string;
          user_id?: string;
          views_count?: number | null;
        };
        Relationships: [];
      };
      business_center_lead_attributions: {
        Row: {
          attribution_notes: string | null;
          content_item_id: string;
          created_at: string;
          id: string;
          lead_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attribution_notes?: string | null;
          content_item_id: string;
          created_at?: string;
          id?: string;
          lead_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attribution_notes?: string | null;
          content_item_id?: string;
          created_at?: string;
          id?: string;
          lead_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_center_lead_attributions_content_item_id_fkey";
            columns: ["content_item_id"];
            isOneToOne: false;
            referencedRelation: "business_center_content_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_center_lead_attributions_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      business_center_social_profiles: {
        Row: {
          created_at: string;
          data_source: "manual";
          display_name: string;
          external_account_id: string | null;
          followers_goal: number | null;
          handle: string | null;
          id: string;
          is_active: boolean;
          last_synced_at: string | null;
          normalized_handle: string | null;
          normalized_profile_url: string | null;
          platform: "Instagram" | "TikTok" | "YouTube" | "Facebook" | "LinkedIn" | "Other";
          profile_url: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data_source?: "manual";
          display_name?: string;
          external_account_id?: string | null;
          followers_goal?: number | null;
          handle?: string | null;
          id?: string;
          is_active?: boolean;
          last_synced_at?: string | null;
          normalized_handle?: string | null;
          normalized_profile_url?: string | null;
          platform: "Instagram" | "TikTok" | "YouTube" | "Facebook" | "LinkedIn" | "Other";
          profile_url?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data_source?: "manual";
          display_name?: string;
          external_account_id?: string | null;
          followers_goal?: number | null;
          handle?: string | null;
          id?: string;
          is_active?: boolean;
          last_synced_at?: string | null;
          normalized_handle?: string | null;
          normalized_profile_url?: string | null;
          platform?: "Instagram" | "TikTok" | "YouTube" | "Facebook" | "LinkedIn" | "Other";
          profile_url?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      business_center_social_snapshots: {
        Row: {
          attributed_leads_count: number | null;
          created_at: string;
          data_source: "manual";
          followers_count: number;
          id: string;
          notes: string | null;
          profile_visits_count: number | null;
          snapshot_date: string;
          social_profile_id: string;
          updated_at: string;
          views_count: number | null;
        };
        Insert: {
          attributed_leads_count?: number | null;
          created_at?: string;
          data_source?: "manual";
          followers_count?: number;
          id?: string;
          notes?: string | null;
          profile_visits_count?: number | null;
          snapshot_date: string;
          social_profile_id: string;
          updated_at?: string;
          views_count?: number | null;
        };
        Update: {
          attributed_leads_count?: number | null;
          created_at?: string;
          data_source?: "manual";
          followers_count?: number;
          id?: string;
          notes?: string | null;
          profile_visits_count?: number | null;
          snapshot_date?: string;
          social_profile_id?: string;
          updated_at?: string;
          views_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_center_social_snapshots_social_profile_id_fkey";
            columns: ["social_profile_id"];
            isOneToOne: false;
            referencedRelation: "business_center_social_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_automations_log: {
        Row: {
          created_at: string;
          id: string;
          lead_id: string;
          rule_type: "new_lead" | "followup_24h";
        };
        Insert: {
          created_at?: string;
          id?: string;
          lead_id: string;
          rule_type: "new_lead" | "followup_24h";
        };
        Update: {
          created_at?: string;
          id?: string;
          lead_id?: string;
          rule_type?: "new_lead" | "followup_24h";
        };
        Relationships: [
          {
            foreignKeyName: "task_automations_log_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
