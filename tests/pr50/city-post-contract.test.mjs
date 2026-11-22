import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

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
 assert.match(read('app/api/city-hashtag-options/route.ts'),/normalizeCityHashtag\(city\.name\)===normalizeCityHashtag\(tag\)/);
});

test('scheduled city associations survive edits and trusted publication',()=>{
 assert.match(migration,/p_city_hashtag_refs jsonb/);
 assert.match(migration,/city_hashtag_refs=coalesce\(p_city_hashtag_refs,'\[\]'::jsonb\)/);
 assert.match(migration,/v_post\.city_id,v_post\.city_hashtag_refs,now\(\),now\(\)/);
 assert.match(migration,/grant execute on function public\.publish_due_scheduled_posts\(integer\) to service_role/);
 assert.match(read('components/post-scheduler.tsx'),/p_city_hashtag_refs:cityRefsPayload/);
});

test('City Posts do not alter the existing fundraising route or query contract',()=>{
 const fundraising=read('app/(app)/fundraising/page.tsx');
 assert.match(fundraising,/fundraisingUrl\(/);
 assert.doesNotMatch(migration,/alter table public\.fundraising_campaigns|create table public\.fundraising_campaigns/);
});
