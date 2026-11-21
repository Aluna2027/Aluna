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

  const { url, key } = supabaseConfig();
  const objectUrl = `${url}/storage/v1/object/post-media/${post.media_path.split('/').map(encodeURIComponent).join('/')}`;
  const headers = new Headers({ apikey: key, authorization: `Bearer ${session.access_token}` });
  const range = request.headers.get('range');
  if (range && /^bytes=\d*-\d*(,\d*-\d*)?$/.test(range)) headers.set('range', range);
  const upstream = await fetch(objectUrl, { headers, cache: 'no-store' });
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
