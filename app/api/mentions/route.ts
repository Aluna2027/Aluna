import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const input = (request.nextUrl.searchParams.get('q') ?? '').trim().normalize('NFKC');
  // Never interpret user-supplied LIKE wildcards as a broad account directory scan.
  const query = input.replace(/[%_\\]/g, '').slice(0, 64);
  if (query.length < 1) return NextResponse.json({ results: [] });

  let cursor: {people?:string;organizations?:string;peopleDone?:boolean;organizationsDone?:boolean}={};
  try {const raw=request.nextUrl.searchParams.get('cursor');if(raw){cursor=JSON.parse(Buffer.from(raw,'base64url').toString());if(!cursor||typeof cursor!=='object'||[cursor.people,cursor.organizations].some(id=>id!==undefined&&!/^[0-9a-f-]{36}$/i.test(id)))throw new Error();}}catch{return NextResponse.json({results:[]},{status:400});}
  const pageSize=12;
  let personQuery=client.from('public_profiles').select('id,display_name,avatar_url').ilike('display_name', `${query}%`).order('id').limit(pageSize);
  let orgQuery=client.from('organizations').select('id,name,logo_url').is('removed_at',null).ilike('name',`${query}%`).order('id').limit(pageSize);
  if(cursor.people)personQuery=personQuery.gt('id',cursor.people);
  if(cursor.organizations)orgQuery=orgQuery.gt('id',cursor.organizations);
  const [people, organizations] = await Promise.all([
    cursor.peopleDone?Promise.resolve({data:[],error:null}):personQuery,
    cursor.organizationsDone?Promise.resolve({data:[],error:null}):orgQuery,
  ]);
  if (people.error || organizations.error) {
    return NextResponse.json({ results: [] }, { status: 503 });
  }

  const peopleIds = (people.data ?? []).map(item => item.id);
  const orgIds = (organizations.data ?? []).map(item => item.id);
  const [personActors, organizationActors] = await Promise.all([
    peopleIds.length
      ? client.from('actors').select('id,profile_id').in('profile_id', peopleIds)
      : Promise.resolve({ data: [], error: null }),
    orgIds.length
      ? client.from('actors').select('id,organization_id').in('organization_id', orgIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (personActors.error || organizationActors.error) {
    return NextResponse.json({ results: [] }, { status: 503 });
  }
  const personActorsById = new Map((personActors.data ?? []).map(item => [item.profile_id, item.id]));
  const orgActorsById = new Map((organizationActors.data ?? []).map(item => [item.organization_id, item.id]));
  const results = [
    ...(people.data ?? []).filter(item => item.display_name && personActorsById.has(item.id))
      .map(item => ({
        id: personActorsById.get(item.id)!,
        name: item.display_name,
        kind: 'user' as const,
        href: `/people/${item.id}`,
        avatar: item.avatar_url,
      })),
    ...(organizations.data ?? []).filter(item => item.name && orgActorsById.has(item.id))
      .map(item => ({
        id: orgActorsById.get(item.id)!,
        name: item.name,
        kind: 'organization' as const,
        href: `/organizations/${item.id}`,
        avatar: item.logo_url,
      })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const next={people:people.data?.at(-1)?.id??cursor.people,organizations:organizations.data?.at(-1)?.id??cursor.organizations,peopleDone:!!cursor.peopleDone||(people.data?.length??0)<pageSize,organizationsDone:!!cursor.organizationsDone||(organizations.data?.length??0)<pageSize};
  const nextCursor=next.peopleDone&&next.organizationsDone?null:Buffer.from(JSON.stringify(next)).toString('base64url');
  return NextResponse.json({ results, nextCursor }, { headers: { 'Cache-Control': 'no-store' } });
}
