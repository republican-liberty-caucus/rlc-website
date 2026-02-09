import { NextResponse } from 'next/server';
import { getRepresentatives } from '@/lib/civic/client';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || address.trim().length < 5) {
    return NextResponse.json({ error: 'Address is required (at least 5 characters)' }, { status: 400 });
  }

  try {
    const result = await getRepresentatives(address);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Civic API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
