import { z } from 'zod';

export const splitRuleSchema = z.object({
  recipientCharterId: z.string().uuid('Invalid charter ID'),
  percentage: z.number().min(0.01, 'Percentage must be > 0').max(100, 'Percentage must be <= 100'),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const splitConfigUpdateSchema = z.object({
  disbursementModel: z.enum(['national_managed', 'state_managed']),
  isActive: z.boolean().default(true),
  rules: z.array(splitRuleSchema).optional(),
});

export const splitConfigUpdateWithValidation = splitConfigUpdateSchema.refine(
  (data) => {
    if (!data.rules || data.rules.length === 0) return true;
    const activeRules = data.rules.filter((r) => r.isActive);
    if (activeRules.length === 0) return true;
    const sum = activeRules.reduce((acc, r) => acc + r.percentage, 0);
    return Math.abs(sum - 100) < 0.01;
  },
  { message: 'Active rule percentages must sum to 100%' }
);

export type SplitRuleInput = z.infer<typeof splitRuleSchema>;
export type SplitConfigUpdateInput = z.infer<typeof splitConfigUpdateSchema>;
