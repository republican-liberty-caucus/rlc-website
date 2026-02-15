import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { supabase } = result;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError('Invalid form data', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  const file = formData.get('file') as File | null;

  if (!file) {
    return apiError('No file provided', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return apiError(`Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}`, ApiErrorCode.VALIDATION_ERROR, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return apiError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, ApiErrorCode.VALIDATION_ERROR, 400);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const uniqueId = crypto.randomUUID().slice(0, 8);
  const path = `images/${year}/${month}/${uniqueId}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    logger.error('Supabase storage upload failed', { path, fileType: file.type, fileSize: file.size, error: error.message });
    return apiError(`Upload failed: ${error.message}`, ApiErrorCode.INTERNAL_ERROR, 500);
  }

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);

  if (!urlData.publicUrl || !urlData.publicUrl.startsWith('http')) {
    logger.error('Upload succeeded but public URL is invalid', { path, publicUrl: urlData.publicUrl });
    return apiError('Upload succeeded but could not generate public URL', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ url: urlData.publicUrl });
}
