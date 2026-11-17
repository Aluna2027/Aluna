-- PR47 live acceptance. Synthetic rows only; explicit rollback.
-- Reviewed for Demo zujkasvuxrleisbsnrxv after migration 20261117024100.
-- Does not exercise the global publisher or mutate existing records.
begin;
do $test$
declare
 u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); org uuid:=gen_random_uuid();
 a1 uuid; a2 uuid; ao uuid; p uuid:=gen_random_uuid(); hidden uuid:=gen_random_uuid(); sched uuid:=gen_random_uuid();
 refs jsonb; affected integer;
begin
 insert into auth.users(id,instance_id,aud,role,email,raw_user_meta_data,created_at,updated_at)
 values(u1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u1::text||'@pr47.invalid','{}',now(),now()),
       (u2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u2::text||'@pr47.invalid','{}',now(),now());
 update public.profiles set display_name=case id when u1 then 'PR47 Author' else 'Zoë Person' end where id in(u1,u2);
 select id into strict a1 from public.actors where profile_id=u1;
 select id into strict a2 from public.actors where profile_id=u2;
 insert into public.organizations(id,name,organization_type) values(org,'PR47 Organization','ngo');
 select id into strict ao from public.actors where organization_id=org;
 insert into public.organization_members(organization_id,profile_id,member_role) values(org,u2,'admin');
 refs:=jsonb_build_array(jsonb_build_object('actorId',a2,'start',2,'label','Zoë Person'),jsonb_build_object('actorId',ao,'start',14,'label','PR47 Organization'));
 perform set_config('request.jwt.claim.sub',u1::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';
 insert into public.posts(id,actor_id,body,visibility,mention_refs) values(p,a1,'🌍 @Zoë Person @PR47 Organization #Inclusión #東京 #ＳＤＧ９ #inclusión','public',refs);
 if (select count(*) from public.post_mentions where post_id=p)<>2 then raise exception 'Mention index mismatch'; end if;
 if (select count(*) from public.post_hashtags where post_id=p and tag in('inclusión','東京','sdg9'))<>3 then raise exception 'Unicode hashtag mismatch'; end if;
 update public.posts set body=body||' edited' where id=p;
 execute 'reset role';
 if (select count(*) from public.notifications where target_id=p and kind='mention')<>2 then raise exception 'Notification dedup mismatch'; end if;
 update public.profiles set display_name='Renamed Person' where id=u2;
 execute 'set local role authenticated';
 update public.posts set body='X '||body,mention_refs=jsonb_build_array(jsonb_build_object('actorId',a2,'start',4,'label','Zoë Person'),jsonb_build_object('actorId',ao,'start',16,'label','PR47 Organization')) where id=p;
 begin
  insert into public.posts(actor_id,body,visibility,mention_refs) values(a1,'@Forged','public',jsonb_build_array(jsonb_build_object('actorId',gen_random_uuid(),'start',0,'label','Forged')));
  raise exception 'Forged reference accepted';
 exception when raise_exception then
  if sqlerrm='Forged reference accepted' then raise; end if;
 end;
 insert into public.posts(id,actor_id,body,visibility,mention_refs) values(hidden,a1,'@Renamed Person #PR47Hidden','followers',jsonb_build_array(jsonb_build_object('actorId',a2,'start',0,'label','Renamed Person')));
 insert into public.scheduled_posts(id,actor_id,body,scheduled_for,mention_refs) values(sched,a1,'@Renamed Person #Scheduled',now()+interval '1 day',jsonb_build_array(jsonb_build_object('actorId',a2,'start',0,'label','Renamed Person')));
 perform public.activate_scheduled_post(sched);
 perform public.edit_scheduled_post(sched,'@Renamed Person #Scheduled',now()+interval '2 days','public');
 if (select jsonb_array_length(mention_refs) from public.scheduled_posts where id=sched)<>1 then raise exception 'Legacy RPC lost annotations'; end if;
 perform public.edit_scheduled_post(sched,'@Renamed Person #Updated',now()+interval '2 days','public',jsonb_build_array(jsonb_build_object('actorId',a2,'start',0,'label','Renamed Person')));
 execute 'reset role';
 if exists(select 1 from public.notifications where target_id in(hidden,sched) and kind='mention') then raise exception 'Private/scheduled disclosure'; end if;
 perform set_config('request.jwt.claim.sub',u2::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.post_hashtags where post_id=hidden) then raise exception 'RLS hashtag disclosure'; end if;
 if exists(select 1 from public.post_mentions where post_id=hidden) then raise exception 'RLS mention disclosure'; end if;
 update public.posts set body='unauthorized' where id=p;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Unauthorized post update accepted'; end if;
 begin
  perform public.edit_scheduled_post(sched,'unauthorized',now()+interval '2 days','public');
  raise exception 'Unauthorized legacy RPC accepted';
 exception when raise_exception then if sqlerrm<>'Not permitted' then raise; end if; end;
 begin
  perform public.edit_scheduled_post(sched,'unauthorized',now()+interval '2 days','public','[]');
  raise exception 'Unauthorized new RPC accepted';
 exception when raise_exception then if sqlerrm<>'Not permitted' then raise; end if; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',u1::text,true);
 execute 'set local role authenticated';
 delete from public.posts where id=p;
 execute 'reset role';
 if exists(select 1 from public.notifications where target_id=p and kind='mention') then raise exception 'Delete orphaned mention notifications'; end if;
end
$test$;
rollback;
select 'PASS: synthetic transaction rolled back; person/org mentions, Unicode tags, rename/edit, notification dedup/privacy, scheduler RPC compatibility, unauthorized RPC/update and annotation RLS assertions' result;
