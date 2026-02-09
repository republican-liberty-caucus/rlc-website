/** National flat fee per membership payment (in cents). All tiers pay this. */
export const NATIONAL_FLAT_FEE_CENTS = 1500;

/** National charter ID — set via NATIONAL_CHARTER_ID env var */
export function getNationalCharterId(): string {
  const id = process.env.NATIONAL_CHARTER_ID;
  if (!id) {
    throw new Error('NATIONAL_CHARTER_ID environment variable is not set');
  }
  return id;
}
