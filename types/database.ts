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
      leads: {
        Row: {
          closed_at: string | null;
          created_at: string;
          deal_probability: number;
          id: string;
          last_contact_date: string | null;
          full_name: string;
          next_action_date: string | null;
          next_action_type: string | null;
          notes: string | null;
          phone: string;
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
          id?: string;
          last_contact_date?: string | null;
          full_name: string;
          next_action_date?: string | null;
          next_action_type?: string | null;
          notes?: string | null;
          phone: string;
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
          id?: string;
          last_contact_date?: string | null;
          full_name?: string;
          next_action_date?: string | null;
          next_action_type?: string | null;
          notes?: string | null;
          phone?: string;
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
