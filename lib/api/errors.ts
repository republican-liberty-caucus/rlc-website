import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { ZodError } from 'zod';

// ── Error codes ────────────────────────────────────────────────────────────────

export const ApiErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

// ── Response type (for frontend consumption) ───────────────────────────────────

export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  details?: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Return a standardized JSON error response with a machine-readable code. */
export function apiError(
  message: string,
  code: ApiErrorCode,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { error: message, code };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

/** Return a 400 validation error from a Zod parse failure. */
export function validationError(zodError: ZodError): NextResponse<ApiErrorResponse> {
  return apiError(
    'Invalid input',
    ApiErrorCode.VALIDATION_ERROR,
    400,
    zodError.flatten(),
  );
}

/**
 * Map a Supabase/Postgres error to a standardized response.
 * Returns a NextResponse for known error codes, or `null` for unknown errors
 * (caller should fall through to a generic 500).
 */
export function handleSupabaseError(
  error: { code?: string; message?: string; details?: string },
  context: string,
): NextResponse<ApiErrorResponse> | null {
  const code = error.code ?? '';

  // PostgREST: no rows found
  if (code === 'PGRST116') {
    return apiError(`${context} not found`, ApiErrorCode.NOT_FOUND, 404);
  }

  // Postgres: unique_violation
  if (code === '23505') {
    return apiError(`${context} already exists`, ApiErrorCode.CONFLICT, 409);
  }

  // Postgres: foreign_key_violation
  if (code === '23503') {
    return apiError(
      `Invalid reference in ${context}`,
      ApiErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  // Unknown — log and let caller handle as 500
  logger.error(`Supabase error in ${context}:`, error);
  return null;
}
