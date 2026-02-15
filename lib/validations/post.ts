import { z } from 'zod';

export const postCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
  content: z.string().max(1_000_000, 'Content is too large').optional().nullable(),
  excerpt: z.string().max(500).optional().nullable(),
  featuredImageUrl: z.string().url().optional().nullable(),
  charterId: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'published']).default('draft'),
  contentType: z.enum(['post', 'page', 'press_release']).default('post'),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
});

export const postUpdateSchema = postCreateSchema.partial();

export type PostCreateInput = z.infer<typeof postCreateSchema>;
export type PostUpdateInput = z.infer<typeof postUpdateSchema>;
