import { z } from 'zod';

export const profileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(20).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  postalCode: z.string().max(10).optional().nullable(),
  emailOptIn: z.boolean().default(true),
  smsOptIn: z.boolean().default(false),
  doNotPhone: z.boolean().default(false),
});

export const memberSearchSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['new_member', 'current', 'grace', 'expired', 'pending', 'cancelled', 'deceased', 'expiring']).optional(),
  tier: z.enum(['student_military', 'individual', 'premium', 'sustaining', 'patron', 'benefactor', 'roundtable']).optional(),
  charterId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type MemberSearchInput = z.infer<typeof memberSearchSchema>;
