import { z } from 'zod';
import type { OfficerTitle } from '@/types';

export const OFFICER_TITLES: OfficerTitle[] = [
  'chair',
  'vice_chair',
  'secretary',
  'treasurer',
  'at_large_board',
  'committee_chair',
  'committee_member',
  'state_coordinator',
  'regional_director',
];

export const OFFICER_TITLE_LABELS: Record<OfficerTitle, string> = {
  chair: 'Chair',
  vice_chair: 'Vice Chair',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  at_large_board: 'At-Large Board',
  committee_chair: 'Committee Chair',
  committee_member: 'Committee Member',
  state_coordinator: 'State Coordinator',
  regional_director: 'Regional Director',
};

export const assignOfficerPositionSchema = z
  .object({
    memberId: z.string().min(1),
    title: z.enum(OFFICER_TITLES as [OfficerTitle, ...OfficerTitle[]]),
    committeeName: z.string().max(100).optional().nullable(),
    startedAt: z.string().datetime().optional(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (data) => !['committee_chair', 'committee_member'].includes(data.title) || (data.committeeName && data.committeeName.trim().length > 0),
    { message: 'Committee name is required for committee positions', path: ['committeeName'] }
  );

export const updateOfficerPositionSchema = z.object({
  endedAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});
