import { z } from 'zod';

const socialCopyVariantSchema = z.object({
  formal: z.string(),
  casual: z.string(),
  punchy: z.string(),
});

const socialCopySchema = z.object({
  x: socialCopyVariantSchema,
  facebook: socialCopyVariantSchema,
  linkedin: socialCopyVariantSchema,
});

export const shareKitUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  socialCopy: socialCopySchema.optional(),
  ogImageOverrideUrl: z.string().url().max(2000).nullable().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export const shareLinkCreateSchema = z.object({
  shareKitId: z.string().uuid(),
});

export const shareEventCreateSchema = z.object({
  shareKitId: z.string().uuid(),
  platform: z.enum(['x', 'facebook', 'linkedin', 'email', 'sms', 'copy', 'qr']),
});

export type ShareKitUpdateInput = z.infer<typeof shareKitUpdateSchema>;
export type ShareEventCreateInput = z.infer<typeof shareEventCreateSchema>;
