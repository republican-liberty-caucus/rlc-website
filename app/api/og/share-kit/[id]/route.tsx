import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const SIZE = { width: 1200, height: 630 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return new Response('Not found', { status: 404 });
  }

  const supabase = createServerClient();

  const { data: rawKit, error: kitError } = await supabase
    .from('rlc_share_kits')
    .select('title, description, content_type, content_id, og_image_override_url')
    .eq('id', id)
    .single();

  if (kitError && kitError.code !== 'PGRST116') {
    logger.error('OG image: failed to fetch share kit:', { id, error: kitError });
  }

  const kit = rawKit as {
    title: string;
    description: string | null;
    content_type: string;
    content_id: string;
    og_image_override_url: string | null;
  } | null;

  if (!kit) {
    return new Response('Not found', { status: 404 });
  }

  // If admin uploaded an override, redirect to it
  if (kit.og_image_override_url) {
    return Response.redirect(kit.og_image_override_url, 302);
  }

  // Build badge text based on content type
  let badge = 'RLC';
  let badgeColor = '#1e3a5f'; // rlc-blue
  if (kit.content_type === 'endorsement') {
    badge = 'ENDORSED';
    badgeColor = '#c41e3a'; // rlc-red
  } else if (kit.content_type === 'campaign') {
    badge = 'TAKE ACTION';
    badgeColor = '#c41e3a';
  } else if (kit.content_type === 'event') {
    badge = 'EVENT';
    badgeColor = '#1e3a5f';
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            backgroundColor: '#c41e3a',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '60px 80px',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'flex',
              marginBottom: 24,
            }}
          >
            <span
              style={{
                backgroundColor: badgeColor,
                color: '#ffffff',
                padding: '8px 20px',
                borderRadius: 6,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 2,
              }}
            >
              {badge}
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: '#1a1a1a',
              lineHeight: 1.15,
              margin: 0,
              maxWidth: '90%',
            }}
          >
            {kit.title}
          </h1>

          {/* Description */}
          {kit.description && (
            <p
              style={{
                fontSize: 24,
                color: '#666666',
                marginTop: 20,
                lineHeight: 1.4,
                maxWidth: '80%',
              }}
            >
              {kit.description.length > 150
                ? kit.description.slice(0, 147) + '...'
                : kit.description}
            </p>
          )}
        </div>

        {/* Bottom bar with org name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 80px',
            backgroundColor: '#1e3a5f',
          }}
        >
          <span
            style={{
              color: '#ffffff',
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            Republican Liberty Caucus
          </span>
          <span
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 16,
            }}
          >
            rlc.org
          </span>
        </div>
      </div>
    ),
    {
      ...SIZE,
    },
  );
  } catch (err) {
    logger.error('OG image: unhandled error:', { error: err });
    return new Response('Internal error', { status: 500 });
  }
}
