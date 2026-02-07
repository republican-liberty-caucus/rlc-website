// Member types
export type MembershipTier = 'supporter' | 'member' | 'sustaining' | 'lifetime' | 'leadership';
export type MembershipStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended';
export type ContributionType = 'membership' | 'donation' | 'event_registration' | 'merchandise';
export type UserRole = 'member' | 'chapter_admin' | 'state_chair' | 'national_board' | 'super_admin';

export interface Member {
  id: string;
  clerkUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  membershipTier: MembershipTier;
  membershipStatus: MembershipStatus;
  membershipStartDate: Date | null;
  membershipExpiryDate: Date | null;
  primaryChapterId: string | null;
  highlevelContactId: string | null;
  stripeCustomerId: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chapter {
  id: string;
  name: string;
  slug: string;
  stateCode: string | null;
  region: string | null;
  status: string;
  websiteUrl: string | null;
  contactEmail: string | null;
  leadership: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contribution {
  id: string;
  memberId: string | null;
  contributionType: ContributionType;
  amount: number;
  currency: string;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  paymentStatus: string;
  chapterId: string | null;
  campaignId: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  createdAt: Date;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  eventType: string | null;
  startDate: Date;
  endDate: Date | null;
  timezone: string;
  isVirtual: boolean;
  locationName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  virtualUrl: string | null;
  registrationRequired: boolean;
  maxAttendees: number | null;
  registrationFee: number | null;
  registrationDeadline: Date | null;
  chapterId: string | null;
  organizerId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  memberId: string | null;
  guestEmail: string | null;
  guestName: string | null;
  registrationStatus: string;
  checkedInAt: Date | null;
  contributionId: string | null;
  createdAt: Date;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  featuredImageUrl: string | null;
  authorId: string | null;
  chapterId: string | null;
  status: string;
  publishedAt: Date | null;
  categories: string[];
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
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
