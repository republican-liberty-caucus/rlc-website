import { z } from 'zod';

export const campaignCreateSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  billId: z.string().optional(),
  charterId: z.string().optional(),
  targetChamber: z.enum(['us_house', 'us_senate', 'state_house', 'state_senate']).optional(),
  targetStateCode: z.string().max(2).optional(),
  messageTemplate: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export const campaignUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  billId: z.string().optional(),
  charterId: z.string().optional(),
  targetChamber: z.enum(['us_house', 'us_senate', 'state_house', 'state_senate']).optional(),
  targetStateCode: z.string().max(2).optional(),
  messageTemplate: z.string().optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export const participationCreateSchema = z.object({
  action: z.string().min(1).max(100),
  legislatorId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
