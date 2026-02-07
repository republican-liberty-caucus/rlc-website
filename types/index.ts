// Member types
export type MembershipTier = 'supporter' | 'member' | 'sustaining' | 'lifetime' | 'leadership';
export type MembershipStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended';
export type ContributionType = 'membership' | 'donation' | 'event_registration' | 'merchandise';
export type UserRole = 'member' | 'chapter_admin' | 'state_chair' | 'national_board' | 'super_admin';

// Database row types (snake_case to match Supabase)
export interface Member {
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
  membership_tier: MembershipTier;
  membership_status: MembershipStatus;
  membership_start_date: string | null;
  membership_expiry_date: string | null;
  primary_chapter_id: string | null;
  highlevel_contact_id: string | null;
  stripe_customer_id: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
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
}

export interface Contribution {
  id: string;
  member_id: string | null;
  contribution_type: ContributionType;
  amount: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  payment_status: string;
  chapter_id: string | null;
  campaign_id: string | null;
  is_recurring: boolean;
  recurring_interval: string | null;
  created_at: string;
}

export interface Event {
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
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  member_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  registration_status: string;
  checked_in_at: string | null;
  contribution_id: string | null;
  created_at: string;
}

export interface Post {
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
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
