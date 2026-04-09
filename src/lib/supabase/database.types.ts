// Auto-typed to match supabase/migrations/001_initial_schema.sql
// Do not edit by hand — regenerate with: npx supabase gen types typescript

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
      users: {
        Row: {
          id: string
          username: string
          display_name: string
          avatar_url: string | null
          bio: string | null
          neighborhood: string
          interests: string[]
          reputation_score: number
          trade_count: number
          notification_prefs: Json
          joined_at: string
        }
        Insert: {
          id: string
          username: string
          display_name: string
          avatar_url?: string | null
          bio?: string | null
          neighborhood?: string
          interests?: string[]
          reputation_score?: number
          trade_count?: number
          notification_prefs?: Json
          joined_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string
          avatar_url?: string | null
          bio?: string | null
          neighborhood?: string
          interests?: string[]
          reputation_score?: number
          trade_count?: number
          notification_prefs?: Json
          joined_at?: string
        }
      }
      listings: {
        Row: {
          id: string
          title: string
          description: string
          category: 'goods' | 'services' | 'skills' | 'outdoor'
          condition: 'new' | 'like_new' | 'good' | 'fair' | null
          seeking: string
          images: string[]
          user_id: string
          neighborhood: string
          lat: number | null
          lng: number | null
          distance_mi: number
          status: 'active' | 'pending' | 'completed' | 'withdrawn'
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          category: 'goods' | 'services' | 'skills' | 'outdoor'
          condition?: 'new' | 'like_new' | 'good' | 'fair' | null
          seeking: string
          images?: string[]
          user_id: string
          neighborhood: string
          lat?: number | null
          lng?: number | null
          distance_mi?: number
          status?: 'active' | 'pending' | 'completed' | 'withdrawn'
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          category?: 'goods' | 'services' | 'skills' | 'outdoor'
          condition?: 'new' | 'like_new' | 'good' | 'fair' | null
          seeking?: string
          images?: string[]
          user_id?: string
          neighborhood?: string
          lat?: number | null
          lng?: number | null
          distance_mi?: number
          status?: 'active' | 'pending' | 'completed' | 'withdrawn'
          created_at?: string
        }
      }
      offers: {
        Row: {
          id: string
          listing_id: string
          from_user_id: string
          to_user_id: string
          status: 'pending' | 'countered' | 'accepted' | 'declined' | 'withdrawn'
          round: number
          max_rounds: number
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          from_user_id: string
          to_user_id: string
          status?: 'pending' | 'countered' | 'accepted' | 'declined' | 'withdrawn'
          round?: number
          max_rounds?: number
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          from_user_id?: string
          to_user_id?: string
          status?: 'pending' | 'countered' | 'accepted' | 'declined' | 'withdrawn'
          round?: number
          max_rounds?: number
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      offer_messages: {
        Row: {
          id: string
          offer_id: string
          from_user_id: string
          type: 'offer' | 'counter' | 'accept' | 'decline' | 'message'
          content: string
          items: string[]
          created_at: string
        }
        Insert: {
          id?: string
          offer_id: string
          from_user_id: string
          type: 'offer' | 'counter' | 'accept' | 'decline' | 'message'
          content: string
          items?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          offer_id?: string
          from_user_id?: string
          type?: 'offer' | 'counter' | 'accept' | 'decline' | 'message'
          content?: string
          items?: string[]
          created_at?: string
        }
      }
      agreements: {
        Row: {
          id: string
          offer_id: string
          party_a_user_id: string
          party_a_item: string
          party_a_signed: boolean
          party_b_user_id: string
          party_b_item: string
          party_b_signed: boolean
          status: 'draft' | 'under_review' | 'pending_signatures' | 'active' | 'completed' | 'cancelled' | 'disputed'
          exchange_method: 'in_person' | 'dropoff' | 'service_at_location' | null
          exchange_date: string | null
          exchange_location: string | null
          special_instructions: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          offer_id: string
          party_a_user_id: string
          party_a_item?: string
          party_a_signed?: boolean
          party_b_user_id: string
          party_b_item?: string
          party_b_signed?: boolean
          status?: 'draft' | 'under_review' | 'pending_signatures' | 'active' | 'completed' | 'cancelled' | 'disputed'
          exchange_method?: 'in_person' | 'dropoff' | 'service_at_location' | null
          exchange_date?: string | null
          exchange_location?: string | null
          special_instructions?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          offer_id?: string
          party_a_user_id?: string
          party_a_item?: string
          party_a_signed?: boolean
          party_b_user_id?: string
          party_b_item?: string
          party_b_signed?: boolean
          status?: 'draft' | 'under_review' | 'pending_signatures' | 'active' | 'completed' | 'cancelled' | 'disputed'
          exchange_method?: 'in_person' | 'dropoff' | 'service_at_location' | null
          exchange_date?: string | null
          exchange_location?: string | null
          special_instructions?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      reviews: {
        Row: {
          id: string
          agreement_id: string
          reviewer_id: string
          reviewee_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agreement_id: string
          reviewer_id: string
          reviewee_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agreement_id?: string
          reviewer_id?: string
          reviewee_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type:
            | 'new_offer'
            | 'counter_offer'
            | 'offer_accepted'
            | 'offer_declined'
            | 'new_message'
            | 'agreement_ready'
            | 'trade_complete'
            | 'review_request'
            | 'match'
          title: string
          body: string
          data: Json
          read_at: string | null
          listing_id: string | null
          offer_id: string | null
          agreement_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type:
            | 'new_offer'
            | 'counter_offer'
            | 'offer_accepted'
            | 'offer_declined'
            | 'new_message'
            | 'agreement_ready'
            | 'trade_complete'
            | 'review_request'
            | 'match'
          title: string
          body: string
          data?: Json
          read_at?: string | null
          listing_id?: string | null
          offer_id?: string | null
          agreement_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?:
            | 'new_offer'
            | 'counter_offer'
            | 'offer_accepted'
            | 'offer_declined'
            | 'new_message'
            | 'agreement_ready'
            | 'trade_complete'
            | 'review_request'
            | 'match'
          title?: string
          body?: string
          data?: Json
          read_at?: string | null
          listing_id?: string | null
          offer_id?: string | null
          agreement_id?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row']
export type ListingRow = Database['public']['Tables']['listings']['Row']
export type OfferRow = Database['public']['Tables']['offers']['Row']
export type OfferMessageRow = Database['public']['Tables']['offer_messages']['Row']
export type AgreementRow = Database['public']['Tables']['agreements']['Row']
export type ReviewRow = Database['public']['Tables']['reviews']['Row']
export type NotificationRow = Database['public']['Tables']['notifications']['Row']
