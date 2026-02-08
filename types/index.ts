// Membership tiers — matches CiviCRM's 7 membership types
export type MembershipTier =
  | 'student_military'
  | 'individual'
  | 'premium'
  | 'sustaining'
  | 'patron'
  | 'benefactor'
  | 'roundtable';

// Membership statuses — matches CiviCRM's status rules
// Prisma uses "new_member" because "new" is a SQL reserved word.
// The PostgreSQL enum value is "new_member" — all layers must use this value.
export type MembershipStatus =
  | 'new_member'
  | 'current'
  | 'grace'
  | 'expired'
  | 'pending'
  | 'cancelled'
  | 'deceased'
  | 'expiring';

export type ContributionType = 'membership' | 'donation' | 'event_registration' | 'merchandise';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export type ChapterLevel =
  | 'national'
  | 'multi_state_region'
  | 'state'
  | 'intra_state_region'
  | 'county';

export type ChapterStatus = 'active' | 'inactive' | 'forming';

export type HouseholdRole = 'primary' | 'spouse' | 'child';

export type UserRole =
  | 'member'
  | 'chapter_officer'
  | 'chapter_admin'
  | 'state_chair'
  | 'regional_coordinator'
  | 'national_board'
  | 'super_admin';

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
  membership_join_date: string | null;
  primary_chapter_id: string | null;
  highlevel_contact_id: string | null;
  civicrm_contact_id: number | null;
  stripe_customer_id: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  do_not_phone: boolean;
  household_id: string | null;
  household_role: HouseholdRole | null;
  primary_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  name: string;
  slug: string;
  chapter_level: ChapterLevel;
  parent_chapter_id: string | null;
  state_code: string | null;
  region_name: string | null;
  status: ChapterStatus;
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
  payment_status: PaymentStatus;
  payment_method: string | null;
  chapter_id: string | null;
  campaign_id: string | null;
  is_recurring: boolean;
  recurring_interval: string | null;
  civicrm_contribution_id: number | null;
  transaction_id: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
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
