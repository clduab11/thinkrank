// Generated Supabase types for ThinkRank database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      analytics_events: {
        Row: {
          app_version: string | null
          created_at: string
          event_data: Json
          event_name: string
          event_type: string
          id: string
          ip_address: string | null
          platform: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          event_data: Json
          event_name: string
          event_type: string
          id?: string
          ip_address?: string | null
          platform?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          event_data?: Json
          event_name?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          platform?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_research_problems: {
        Row: {
          active: boolean
          created_at: string
          difficulty_level: number | null
          expected_solution_format: Json
          id: string
          institution_id: string | null
          institution_name: string | null
          metadata: Json
          problem_data: Json
          problem_id: string
          problem_type: Database["public"]["Enums"]["problem_type"]
          quality_threshold: number
          tags: string[]
          title: string
          total_contributions: number
          updated_at: string
          validation_criteria: Json
          description: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          difficulty_level?: number | null
          expected_solution_format?: Json
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          metadata?: Json
          problem_data: Json
          problem_id: string
          problem_type: Database["public"]["Enums"]["problem_type"]
          quality_threshold?: number
          tags?: string[]
          title: string
          total_contributions?: number
          updated_at?: string
          validation_criteria: Json
          description?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          difficulty_level?: number | null
          expected_solution_format?: Json
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          metadata?: Json
          problem_data?: Json
          problem_id?: string
          problem_type?: Database["public"]["Enums"]["problem_type"]
          quality_threshold?: number
          tags?: string[]
          title?: string
          total_contributions?: number
          updated_at?: string
          validation_criteria?: Json
          description?: string | null
        }
        Relationships: []
      }
      game_progress: {
        Row: {
          achievements: Json
          best_streak: number
          completed_challenges: Json
          created_at: string
          current_streak: number
          experience_points: number
          id: string
          last_activity: string
          level: number
          skill_assessments: Json
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements?: Json
          best_streak?: number
          completed_challenges?: Json
          created_at?: string
          current_streak?: number
          experience_points?: number
          id?: string
          last_activity?: string
          level?: number
          skill_assessments?: Json
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements?: Json
          best_streak?: number
          completed_challenges?: Json
          created_at?: string
          current_streak?: number
          experience_points?: number
          id?: string
          last_activity?: string
          level?: number
          skill_assessments?: Json
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_progress_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      game_sessions: {
        Row: {
          app_version: string | null
          average_response_time: number | null
          created_at: string
          device_info: Json
          duration_seconds: number | null
          end_time: string | null
          id: string
          platform: string | null
          problems_attempted: number
          problems_completed: number
          session_data: Json
          session_token: string
          start_time: string
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          average_response_time?: number | null
          created_at?: string
          device_info?: Json
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          platform?: string | null
          problems_attempted?: number
          problems_completed?: number
          session_data?: Json
          session_token: string
          start_time?: string
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          average_response_time?: number | null
          created_at?: string
          device_info?: Json
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          platform?: string | null
          problems_attempted?: number
          problems_completed?: number
          session_data?: Json
          session_token?: string
          start_time?: string
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      research_contributions: {
        Row: {
          confidence_score: number | null
          contribution_id: string
          created_at: string
          feedback_received: Json
          id: string
          peer_reviews: Json
          points_awarded: number
          problem_id: string
          quality_score: number | null
          research_impact: Json
          solution_data: Json
          submission_method: string
          submitted_at: string
          time_spent_seconds: number | null
          updated_at: string
          user_id: string
          validated_at: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          confidence_score?: number | null
          contribution_id: string
          created_at?: string
          feedback_received?: Json
          id?: string
          peer_reviews?: Json
          points_awarded?: number
          problem_id: string
          quality_score?: number | null
          research_impact?: Json
          solution_data: Json
          submission_method?: string
          submitted_at?: string
          time_spent_seconds?: number | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          confidence_score?: number | null
          contribution_id?: string
          created_at?: string
          feedback_received?: Json
          id?: string
          peer_reviews?: Json
          points_awarded?: number
          problem_id?: string
          quality_score?: number | null
          research_impact?: Json
          solution_data?: Json
          submission_method?: string
          submitted_at?: string
          time_spent_seconds?: number | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "research_contributions_problem_id_fkey"
            columns: ["problem_id"]
            referencedRelation: "ai_research_problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_contributions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      social_interactions: {
        Row: {
          content: string | null
          created_at: string
          id: string
          interaction_type: Database["public"]["Enums"]["social_interaction_type"]
          metadata: Json
          target_id: string | null
          target_type: string | null
          target_user_id: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          interaction_type: Database["public"]["Enums"]["social_interaction_type"]
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          target_user_id: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          interaction_type?: Database["public"]["Enums"]["social_interaction_type"]
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_interactions_target_user_id_fkey"
            columns: ["target_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_interactions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      subscriptions: {
        Row: {
          auto_renewal: boolean
          created_at: string
          end_date: string | null
          id: string
          metadata: Json
          start_date: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier_type: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renewal?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          metadata?: Json
          start_date: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_type: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renewal?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          metadata?: Json
          start_date?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_type?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean
          id: string
          is_active: boolean
          last_login_at: string | null
          password_hash: string
          preferences: Json
          profile_data: Json
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash: string
          preferences?: Json
          profile_data?: Json
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash?: string
          preferences?: Json
          profile_data?: Json
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          username?: string
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
      problem_type: "bias_detection" | "alignment" | "context_evaluation"
      social_interaction_type: "like" | "comment" | "share" | "follow"
      subscription_tier: "free" | "premium" | "pro"
      validation_status: "pending" | "validated" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
