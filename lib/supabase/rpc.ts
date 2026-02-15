import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './client';

type ServerClient = SupabaseClient<Database>;

/**
 * Call a Supabase RPC function with typed parameters.
 * Centralizes the type cast needed because our Database type
 * doesn't include RPC function signatures.
 */
export function rpc<T = unknown>(
  supabase: ServerClient,
  fn: string,
  args?: Record<string, unknown>
): PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC signatures not in generated Database type
  return (supabase as any).rpc(fn, args);
}
