import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type exports for database
export type Database = {
  public: {
    Tables: {
      rlc_chapters: {
        Row: {
          id: string;
          name: string;
          slug: string;
          state_code: string | null;
          region: string | null;
          status: string;
          website_url: string | null;
          contact_email: string | null;
          leadership: Record<string, unknown>;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_chapters']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_chapters']['Insert']>;
      };
      rlc_members: {
        Row: {
          id: string;
          clerk_user_id: string | null;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string;
          membership_tier: 'supporter' | 'member' | 'sustaining' | 'lifetime' | 'leadership';
          membership_status: 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended';
          membership_start_date: string | null;
          membership_expiry_date: string | null;
          primary_chapter_id: string | null;
          highlevel_contact_id: string | null;
          civicrm_contact_id: number | null;
          stripe_customer_id: string | null;
          email_opt_in: boolean;
          sms_opt_in: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_members']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_members']['Insert']>;
      };
      rlc_events: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          event_type: string | null;
          start_date: string;
          end_date: string | null;
          timezone: string;
          is_virtual: boolean;
          location_name: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          virtual_url: string | null;
          registration_required: boolean;
          max_attendees: number | null;
          registration_fee: number | null;
          registration_deadline: string | null;
          chapter_id: string | null;
          organizer_id: string | null;
          status: string;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_events']['Insert']>;
      };
      rlc_posts: {
        Row: {
          id: string;
          title: string;
          slug: string;
          content: string | null;
          excerpt: string | null;
          featured_image_url: string | null;
          author_id: string | null;
          chapter_id: string | null;
          status: string;
          published_at: string | null;
          categories: string[];
          tags: string[];
          seo_title: string | null;
          seo_description: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_posts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_posts']['Insert']>;
      };
    };
  };
};
