import { z } from 'zod';

export const eventCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
  description: z.string().optional().nullable(),
  eventType: z.string().optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  timezone: z.string().default('America/New_York'),
  isVirtual: z.boolean().default(false),
  locationName: z.string().max(200).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  postalCode: z.string().max(10).optional().nullable(),
  virtualUrl: z.string().url().optional().nullable(),
  registrationRequired: z.boolean().default(true),
  maxAttendees: z.number().int().positive().optional().nullable(),
  registrationFee: z.number().positive().optional().nullable(),
  registrationDeadline: z.coerce.date().optional().nullable(),
  charterId: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'published', 'cancelled']).default('draft'),
});

export const eventUpdateSchema = eventCreateSchema.partial();

export const eventRegistrationSchema = z.object({
  eventId: z.string().uuid(),
  guestEmail: z.string().email().optional(),
  guestName: z.string().max(200).optional(),
});

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;
