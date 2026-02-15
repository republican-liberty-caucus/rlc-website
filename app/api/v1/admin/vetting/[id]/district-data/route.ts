import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline } from '@/lib/vetting/permissions';
import { districtDataCreateSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canViewPipeline(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
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
        return apiError('Vetting not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error fetching vetting for district data:', { id, error: vettingError });
      return apiError('Failed to fetch vetting', ApiErrorCode.INTERNAL_ERROR, 500);
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
      return apiError('Failed to fetch district data', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ districtData });
  } catch (err) {
    logger.error('Unhandled error in GET district-data:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    // Chair or national can manage district data
    if (!ctx.isChair && !ctx.isNational) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = createServerClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = districtDataCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    // Verify vetting exists
    const { data: vetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, district_data_id')
      .eq('id', id)
      .single();

    if (vettingError) {
      if (vettingError.code === 'PGRST116') {
        return apiError('Vetting not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error fetching vetting for district data upsert:', { id, error: vettingError });
      return apiError('Failed to fetch vetting', ApiErrorCode.INTERNAL_ERROR, 500);
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
        return apiError('Failed to update district data', ApiErrorCode.INTERNAL_ERROR, 500);
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
        return apiError('Failed to create district data', ApiErrorCode.INTERNAL_ERROR, 500);
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
        return apiError('District data created but failed to link to vetting', ApiErrorCode.INTERNAL_ERROR, 500);
      }

      return NextResponse.json({ districtData: created }, { status: 201 });
    }
  } catch (err) {
    logger.error('Unhandled error in POST district-data:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
