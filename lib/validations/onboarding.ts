import { z } from 'zod';
import type { OnboardingStep } from '@/types';

// Step 1: Coordinator Membership
export const coordinatorMembershipSchema = z.object({
  member_id: z.string().uuid(),
  verified: z.literal(true, { errorMap: () => ({ message: 'Coordinator membership must be verified' }) }),
  tier: z.string().optional(),
  status: z.string().optional(),
});

// Step 2: Coordinator Appointment
export const coordinatorAppointmentSchema = z.object({
  appointed_by: z.string().optional(),
  appointment_date: z.string().optional(),
  role_type: z.enum(['contact', 'coordinator']).default('coordinator'),
});

// Step 3: Recruit Members — array of founding members
export const recruitMembersSchema = z.object({
  founding_members: z.array(z.object({
    member_id: z.string().uuid().optional(),
    name: z.string(),
    email: z.string().email(),
    status: z.enum(['linked', 'invited', 'pending']).default('pending'),
  })).min(10, 'At least 10 founding members required'),
});

// Step 4: Template Bylaws
export const templateBylawsSchema = z.object({
  reviewed: z.literal(true, { errorMap: () => ({ message: 'Bylaws must be reviewed' }) }),
  deviations: z.string().optional(),
  bylaws_url: z.string().url().optional(),
});

// Step 5: Organizational Meeting
export const organizationalMeetingSchema = z.object({
  meeting_date: z.string(),
  bylaws_adopted: z.literal(true, { errorMap: () => ({ message: 'Bylaws must be adopted at the meeting' }) }),
  officers: z.array(z.object({
    member_id: z.string().uuid().optional(),
    name: z.string(),
    title: z.enum(['chair', 'vice_chair', 'secretary', 'treasurer', 'at_large_board']),
  })).min(4, 'At least 4 officers required'),
});

// Step 6: Submit Documents
export const submitDocumentsSchema = z.object({
  charter_name: z.string().min(1),
  state_code: z.string().length(2).optional(),
  formation_date: z.string().optional(),
  questions: z.object({
    q1: z.string(),
    q2: z.string(),
    q3: z.string(),
    q4: z.string(),
    q5: z.string(),
  }),
  acknowledgments: z.object({
    a1: z.literal(true),
    a2: z.literal(true),
    a3: z.literal(true),
    a4: z.literal(true),
    a5: z.literal(true),
    a6: z.literal(true),
  }),
  mou_accepted: z.literal(true, { errorMap: () => ({ message: 'MOU must be accepted' }) }),
});

// Step 7: Legal Entity
export const legalEntitySchema = z.object({
  ein: z.string().optional(),
  bank_name: z.string().optional(),
  signatory_1: z.string().optional(),
  signatory_2: z.string().optional(),
  state_registration: z.string().optional(),
});

// Step 8: Stripe Connect
export const stripeConnectSchema = z.object({
  stripe_account_id: z.string().min(1, 'Stripe account ID is required'),
  onboarding_complete: z.literal(true, { errorMap: () => ({ message: 'Stripe onboarding must be complete' }) }),
});

export const STEP_DATA_SCHEMAS: Record<OnboardingStep, z.ZodType> = {
  coordinator_membership: coordinatorMembershipSchema,
  coordinator_appointment: coordinatorAppointmentSchema,
  recruit_members: recruitMembersSchema,
  template_bylaws: templateBylawsSchema,
  organizational_meeting: organizationalMeetingSchema,
  submit_documents: submitDocumentsSchema,
  legal_entity: legalEntitySchema,
  stripe_connect: stripeConnectSchema,
};
