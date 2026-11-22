import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfig } from '@/lib/supabase/config';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createClient();
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    client.auth.getUser(), client.auth.getSession(),
  ]);
  if (!user || !session?.access_token) return new NextResponse('Unauthorized', { status: 401 });

  // The post lookup uses the normal RLS policy, so this route cannot disclose a
  // member attachment to a caller who cannot read its parent post.
  const { data: post } = await client.from('posts').select('media_path,media_type,visibility').eq('id', id).maybeSingle();
  if (!post?.media_path || post.visibility !== 'members') return new NextResponse('Not found', { status: 404 });
  const parts = post.media_path.split('/');
  if (parts.length !== 3 || parts[1] !== id || parts.some((part: string) => !part || part === '.' || part === '..')) return new NextResponse('Not found', { status: 404 });

  // Privileged access occurs only AFTER the authenticated, RLS-filtered lookup.
  // Never return a bearer URL or credential to the caller.
  const { url } = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return new NextResponse('Media unavailable', { status: 503 });
  const objectUrl = `${url}/storage/v1/object/post-media/${post.media_path.split('/').map(encodeURIComponent).join('/')}`;
  const headers = new Headers({ apikey: key, authorization: `Bearer ${key}` });
  const range = request.headers.get('range');
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new NextResponse('Invalid range', { status: 416 });
  if (range) headers.set('range', range);
  const upstream = await fetch(objectUrl, { headers, cache: 'no-store', redirect: 'error', signal: request.signal });
  if (!upstream.ok || !upstream.body) return new NextResponse('Media unavailable', { status: upstream.status || 404 });

  const responseHeaders = new Headers({
    'cache-control': 'private, no-store',
    'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'accept-ranges': 'bytes',
  });
  for (const name of ['content-length', 'content-range']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}
