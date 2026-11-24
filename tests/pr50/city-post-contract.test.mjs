import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractCityHashtags,matchCityHashtagCandidates,normalizeCityHashtag} from '../../lib/city-hashtags.ts';

const read=path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261122105500_pr50_city_post_associations.sql');

test('service display names preserve existing tab identifiers and slugs',()=>{
 const profiles=read('lib/profiles.ts');
 assert.match(profiles,/userTabs = \[[^\]]*'Missions','Fundraising'/);
 assert.match(profiles,/label==='Missions'\?'SDG Missions':label==='Fundraising'\?'SDG Fundraising'/);
 const cityTabs=read('lib/cities.ts');
 for(const row of ["slug: 'overview'","slug: 'posts'","slug: 'wifi-mesh-communities'","slug: 'missions', title: 'SDG Missions'","slug: 'fundraising', title: 'SDG Fundraising'"])assert.ok(cityTabs.includes(row),row);
 assert.ok(cityTabs.indexOf("slug: 'posts'")<cityTabs.indexOf("slug: 'wifi-mesh-communities'"));
 assert.match(read('components/profile-tabs.tsx'),/const slug=tabSlug\(label\);const display=tabDisplayLabel\(label\)/);
});

test('City Posts reuse existing posts and the shared feed renderer',()=>{
 const page=read('app/(app)/cities/[id]/page.tsx');
 assert.match(page,/client\.rpc\('city_feed_page'/);
 assert.match(page,/<PostComposer[^>]*cityId=\{place\.id\}/);
 assert.match(page,/<FeedList posts=\{cityPosts\}/);
 assert.match(migration,/add column city_id uuid references public\.places\(id\)/);
 assert.match(migration,/language sql stable security invoker/);
 assert.match(migration,/where \(p\.city_id=p_city or exists\(select 1 from public\.post_city_hashtag_refs/);
 assert.match(migration,/Read city hashtag references of visible posts[\s\S]*using \(public\.can_view_post\(post_id\)\)/);
 assert.match(migration,/create function public\.city_feed_page\([\s\S]*?language sql stable security invoker/);
});

test('city hashtag refs are bounded, validated and not created for first-name choice',()=>{
 assert.match(migration,/jsonb_array_length\(new\.city_hashtag_refs\)>10/);
 assert.match(migration,/public\.pr50_city_key\(city\.name\)<>public\.pr50_city_key\(canonical_tag\)/);
 assert.match(migration,/Duplicate city hashtag reference/);
 const picker=read('components/city-hashtag-picker.tsx');
 assert.match(picker,/<option value="__first_name__">First name — no city association<\/option>/);
 assert.match(read('components/post-composer.tsx'),/selectedCity!=='__first_name__'/);
 assert.match(read('app/api/city-hashtag-options/route.ts'),/matchCityHashtagCandidates\(tag,matching\)/);
});

test('city hashtag normalization agrees with the migration for Latin accents and ignores non-ASCII-only keys',()=>{
 const expected=new Map([['Paris','paris'],['SanJose','sanjose'],['SãoPaulo','saopaulo'],['SaoPaulo','saopaulo'],['İstanbul','istanbul'],['Århus','arhus']]);
 for(const [input,key] of expected)assert.equal(normalizeCityHashtag(input),key,input);
 assert.equal(normalizeCityHashtag('東京'),'');
 assert.match(migration,/regexp_replace\(lower\(normalize\(p_value,NFKD\) collate "C"\),'\[\^a-z0-9\]','','g'\)/);
 assert.match(read('app/api/city-hashtag-options/route.ts'),/return key!==''&&wanted\.has\(key\)/);
});

test('ambiguous city hashtags return every stable city ID and never guess',()=>{
 const cities=[
  {id:'paris-fr',name:'Paris',country:'France',region:'Île-de-France'},
  {id:'paris-us',name:'Paris',country:'United States',region:'Texas'},
  {id:'same-a',name:'Springfield',country:'United States',region:'Illinois'},
  {id:'same-b',name:'Springfield',country:'United States',region:'Missouri'},
 ];
 assert.deepEqual(matchCityHashtagCandidates('#Paris',cities).map(city=>city.id),['paris-fr','paris-us']);
 assert.deepEqual(matchCityHashtagCandidates('#Springfield',cities).map(city=>city.id),['same-a','same-b']);
 assert.deepEqual(matchCityHashtagCandidates('#不存在',cities),[]);
 assert.deepEqual(extractCityHashtags('First name #Paris #SanJose #SãoPaulo #SaoPaulo #paris'),['paris','sanjose','sãopaulo','saopaulo']);
 const picker=read('components/city-hashtag-picker.tsx');
 assert.ok(picker.indexOf('choices.map(city=>')<picker.indexOf('<option value="__first_name__">'));
 assert.match(picker,/\{city\.label\}/);
 const seeded=JSON.parse(read('data/cities.json'));
 const hyderabad=matchCityHashtagCandidates('Hyderabad',seeded);
 assert.equal(hyderabad.length,2);
 assert.deepEqual(hyderabad.map(city=>city.id),['in-hyderabad','pk-hyderabad']);
 assert.notEqual(hyderabad[0].country,hyderabad[1].country);
});

test('scheduled city associations survive edits and trusted publication',()=>{
 assert.match(migration,/p_city_hashtag_refs jsonb/);
 assert.match(migration,/city_hashtag_refs=coalesce\(p_city_hashtag_refs,'\[\]'::jsonb\)/);
 assert.match(migration,/v_post\.city_id,v_post\.city_hashtag_refs,now\(\),now\(\)/);
 assert.match(migration,/grant execute on function public\.publish_due_scheduled_posts\(integer\) to service_role/);
 assert.match(read('components/post-scheduler.tsx'),/p_city_hashtag_refs:cityRefsPayload/);
 assert.match(migration,/city_hashtag_refs=coalesce\(p_city_hashtag_refs,'\[\]'::jsonb\)/);
 assert.match(migration,/case when trim\(p_body\)=r\.body then r\.city_hashtag_refs else '\[\]'::jsonb end/);
 assert.match(migration,/not public\.is_mesh_member\(v_post\.community_id,v_post\.actor_id\)/);
 assert.match(migration,/not public\.is_mission_participant\(v_post\.mission_id,v_post\.actor_id\)/);
 assert.match(migration,/mention_refs,city_id,city_hashtag_refs,created_at,updated_at/);
 assert.match(migration,/status=case when attempt_count>=4 then 'failed' else 'pending' end/);
 assert.match(migration,/retry_after=now\(\)\+interval '5 minutes'/);
 assert.match(migration,/city_hashtag_refs jsonb not null default '\[\]'::jsonb/);
 assert.match(read('components/post-scheduler.tsx'),/setDraftCityRefs\(current=>Object\.fromEntries\(Object\.entries\(current\)\.filter\(\(\[tag\]\)=>extractCityHashtags\(text\)\.includes\(tag\)\)\)\)/);
 assert.match(read('components/post-scheduler.tsx'),/city_id:cityId\|\|null,city_hashtag_refs:refs/);
 assert.match(migration,/if not found or not public\.can_act_as\(r\.actor_id\)/);
});

test('city feed RPC relies on caller RLS and cannot be executed anonymously',()=>{
 const fn=migration.match(/create function public\.city_feed_page\([\s\S]*?\$fn\$;/)?.[0]??'';
 assert.match(fn,/language sql stable security invoker/);
 assert.doesNotMatch(fn,/security definer/i);
 assert.match(fn,/from public\.posts p join public\.actors a/);
 assert.match(fn,/select count\(\*\) from public\.reactions r where r\.post_id=p\.id/);
 assert.match(fn,/select count\(\*\) from public\.comments c where c\.post_id=p\.id/);
 assert.match(migration,/grant execute on function public\.city_feed_page\(uuid,timestamptz,uuid,integer\) to authenticated/);
 assert.match(migration,/revoke all on function public\.city_feed_page\(uuid,timestamptz,uuid,integer\) from public,anon/);
 const currentRls=read('supabase/migrations/20261121033802_pr47_members_only_audience.sql');
 const visibilityMigration=read('supabase/migrations/20261122011523_pr47_post_insert_returning_visibility.sql');
 const fields=visibilityMigration.match(/create function public\.pr47_can_view_post_fields[\s\S]*?\$fn\$;/)?.[0]??'';
 assert.match(currentRls,/create or replace function public\.can_view_post/);
 assert.match(visibilityMigration,/create or replace function public\.can_view_post[\s\S]*?pr47_can_view_post_fields/);
 assert.match(fields,/visibility='members'[\s\S]*?mesh_community_members[\s\S]*?is_mission_participant/);
});

test('City Posts do not alter the existing fundraising route or query contract',()=>{
 const fundraising=read('app/(app)/fundraising/page.tsx');
 assert.match(fundraising,/fundraisingUrl\(/);
 assert.doesNotMatch(migration,/alter table public\.fundraising_campaigns|create table public\.fundraising_campaigns/);
});
