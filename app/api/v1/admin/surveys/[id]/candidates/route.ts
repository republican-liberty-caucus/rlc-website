import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { candidateCreateSchema } from '@/lib/validations/survey';
import crypto from 'crypto';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: surveyId } = await params;
  const supabase = createServerClient();

  // Verify survey exists
  const { data: survey, error: surveyError } = await supabase
    .from('rlc_surveys')
    .select('id, status')
    .eq('id', surveyId)
    .single();

  if (surveyError || !survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = candidateCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const accessToken = crypto.randomBytes(32).toString('hex');

  const { data: candidate, error: insertError } = await supabase
    .from('rlc_candidate_responses')
    .insert({
      id: crypto.randomUUID(),
      survey_id: surveyId,
      candidate_name: input.candidateName,
      candidate_email: input.candidateEmail || null,
      candidate_party: input.candidateParty || null,
      candidate_office: input.candidateOffice || null,
      candidate_district: input.candidateDistrict || null,
      access_token: accessToken,
      status: 'pending',
    } as never)
    .select()
    .single();

  if (insertError) {
    console.error('Error adding candidate:', insertError);
    return NextResponse.json({ error: 'Failed to add candidate' }, { status: 500 });
  }

  return NextResponse.json({ candidate, accessToken }, { status: 201 });
}
