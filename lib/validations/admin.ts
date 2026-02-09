import { z } from 'zod';

export const VALID_MEMBERSHIP_STATUSES = [
  'new_member', 'current', 'grace', 'expired',
  'pending', 'cancelled', 'deceased', 'expiring',
] as const;

export const VALID_MEMBERSHIP_TIERS = [
  'student_military', 'individual', 'premium', 'sustaining',
  'patron', 'benefactor', 'roundtable',
] as const;

export const adminMemberUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  membershipTier: z.enum(VALID_MEMBERSHIP_TIERS).optional(),
  membershipStatus: z.enum(VALID_MEMBERSHIP_STATUSES).optional(),
  primaryCharterId: z.string().uuid().nullable().optional(),
  membershipExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').nullable().optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  doNotPhone: z.boolean().optional(),
});

export const charterUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().nullable().optional(),
  websiteUrl: z.string().url().refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    'URL must start with http:// or https://'
  ).nullable().optional(),
  status: z.enum(['active', 'inactive', 'forming']).optional(),
});

export const roleAssignmentSchema = z.object({
  role: z.enum([
    'member', 'chapter_officer', 'chapter_admin', 'state_chair',
    'regional_coordinator', 'national_board', 'super_admin',
  ]),
  charterId: z.string().uuid().nullable(),
});

export type AdminMemberUpdateInput = z.infer<typeof adminMemberUpdateSchema>;
export type CharterUpdateInput = z.infer<typeof charterUpdateSchema>;
export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>;
