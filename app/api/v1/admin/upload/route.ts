import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const uniqueId = crypto.randomUUID().slice(0, 8);
  const path = `images/${year}/${month}/${uniqueId}-${safeName}`;

  const supabase = createServerClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    logger.error('Supabase storage upload failed', { path, fileType: file.type, fileSize: file.size, error: error.message });
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);

  if (!urlData.publicUrl || !urlData.publicUrl.startsWith('http')) {
    logger.error('Upload succeeded but public URL is invalid', { path, publicUrl: urlData.publicUrl });
    return NextResponse.json({ error: 'Upload succeeded but could not generate public URL' }, { status: 500 });
  }

  return NextResponse.json({ url: urlData.publicUrl });
}
