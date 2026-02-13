import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline } from '@/lib/vetting/permissions';
import { districtDataCreateSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canViewPipeline(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServerClient();

    // Get the vetting's district_data_id
    const { data: vetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('district_data_id')
      .eq('id', id)
      .single();

    if (vettingError) {
      if (vettingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
      }
      logger.error('Error fetching vetting for district data:', { id, error: vettingError });
      return NextResponse.json({ error: 'Failed to fetch vetting' }, { status: 500 });
    }

    const v = vetting as unknown as { district_data_id: string | null };

    if (!v.district_data_id) {
      return NextResponse.json({ districtData: null });
    }

    const { data: districtData, error: ddError } = await supabase
      .from('rlc_candidate_district_data')
      .select('*')
      .eq('id', v.district_data_id)
      .single();

    if (ddError) {
      logger.error('Error fetching district data:', { districtDataId: v.district_data_id, error: ddError });
      return NextResponse.json({ error: 'Failed to fetch district data' }, { status: 500 });
    }

    return NextResponse.json({ districtData });
  } catch (err) {
    logger.error('Unhandled error in GET district-data:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Chair or national can manage district data
    if (!ctx.isChair && !ctx.isNational) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServerClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parseResult = districtDataCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    // Verify vetting exists
    const { data: vetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, district_data_id')
      .eq('id', id)
      .single();

    if (vettingError) {
      if (vettingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
      }
      logger.error('Error fetching vetting for district data upsert:', { id, error: vettingError });
      return NextResponse.json({ error: 'Failed to fetch vetting' }, { status: 500 });
    }

    const v = vetting as unknown as { id: string; district_data_id: string | null };

    const ddPayload = {
      state_code: parseResult.data.stateCode,
      district_id: parseResult.data.districtId,
      office_type: parseResult.data.officeType,
      cook_pvi: parseResult.data.cookPvi ?? null,
      population: parseResult.data.population ?? null,
      party_registration: parseResult.data.partyRegistration ?? null,
      municipalities: parseResult.data.municipalities,
      counties: parseResult.data.counties,
      overlapping_districts: parseResult.data.overlappingDistricts,
      electoral_history: parseResult.data.electoralHistory ?? null,
      map_url: parseResult.data.mapUrl ?? null,
    };

    let districtDataId: string;

    if (v.district_data_id) {
      // Update existing district data
      const { data: updated, error: updateError } = await supabase
        .from('rlc_candidate_district_data')
        .update(ddPayload as never)
        .eq('id', v.district_data_id)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating district data:', { error: updateError });
        return NextResponse.json({ error: 'Failed to update district data' }, { status: 500 });
      }

      return NextResponse.json({ districtData: updated });
    } else {
      // Create new district data and link to vetting
      const { data: created, error: createError } = await supabase
        .from('rlc_candidate_district_data')
        .insert(ddPayload as never)
        .select()
        .single();

      if (createError) {
        logger.error('Error creating district data:', { error: createError });
        return NextResponse.json({ error: 'Failed to create district data' }, { status: 500 });
      }

      const createdRow = created as unknown as { id: string };
      districtDataId = createdRow.id;

      // Link to vetting
      const { error: linkError } = await supabase
        .from('rlc_candidate_vettings')
        .update({ district_data_id: districtDataId } as never)
        .eq('id', id);

      if (linkError) {
        logger.error('Error linking district data to vetting:', { id, districtDataId, error: linkError });
        return NextResponse.json({ error: 'District data created but failed to link to vetting' }, { status: 500 });
      }

      return NextResponse.json({ districtData: created }, { status: 201 });
    }
  } catch (err) {
    logger.error('Unhandled error in POST district-data:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
