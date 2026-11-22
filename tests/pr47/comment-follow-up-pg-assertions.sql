-- Executes against isolated Actions PostgreSQL only. Never connect to shared Supabase.
\set ON_ERROR_STOP on

-- Guest edit denied.
select set_config('test.auth_user','',false);
do $$ begin
 if public.pr47_edit_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Anonymous edit') then
   raise exception 'Unauthenticated edit accepted';
 end if;
end $$;

-- Different signed-in principal may not edit another actor's comment.
select set_config('test.auth_user','22222222-2222-4222-8222-222222222222',false);
do $$ begin
 if public.pr47_edit_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Wrong author') then
   raise exception 'Unauthorized edit accepted';
 end if;
end $$;

select set_config('test.auth_user','11111111-1111-4111-8111-111111111111',false);
create temporary table comment_before as
 select created_at from public.comments where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
do $$
declare success boolean;
begin
 success:=public.pr47_edit_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','@Bob preserved',
  '[{"actorId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","start":0,"label":"Bob"}]'::jsonb);
 if not success then raise exception 'Authorized edit denied';end if;
 if not exists(select 1 from public.comments c,comment_before before
   where c.id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
     and c.body='@Bob preserved' and c.created_at=before.created_at and c.edited_at is not null)
 then raise exception 'Comment date or text invalid after edit';end if;
 if not exists(select 1 from public.comment_mentions where comment_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
   and actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 then raise exception 'Mention association lost';end if;
 if not exists(select 1 from public.notifications where id='33333333-3333-4333-8333-333333333333')
 then raise exception 'Unchanged mention notification lost';end if;
end $$;

-- Old mention recipients lose stale notifications, no new notifications are generated.
do $$
begin
 if not public.pr47_edit_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Mention removed','[]'::jsonb)
 then raise exception 'Authorized second edit denied';end if;
 if exists(select 1 from public.comment_mentions where comment_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
 then raise exception 'Stale mention row';end if;
 if exists(select 1 from public.notifications where id='33333333-3333-4333-8333-333333333333')
 then raise exception 'Stale notification';end if;
 if (select count(*) from public.notifications)>0 then raise exception 'Unexpected notifications';end if;
 if public.pr47_edit_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','   ','[]'::jsonb)
 then raise exception 'Empty edit accepted';end if;
end $$;

-- Vote 1, cancel, switch, then one vote from a different user.
do $$
declare v record;
begin
 select * into v from public.pr47_vote_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1);
 if v.upvotes<>1 or v.downvotes<>0 or v.my_vote<>1 then raise exception 'Upvote failed';end if;
 select * into v from public.pr47_vote_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1);
 if v.upvotes<>0 or v.downvotes<>0 or v.my_vote<>0 then raise exception 'Vote toggle failed';end if;
 select * into v from public.pr47_vote_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',-1);
 if v.upvotes<>0 or v.downvotes<>1 or v.my_vote<>-1 then raise exception 'Downvote failed';end if;
 select * into v from public.pr47_vote_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1);
 if v.upvotes<>1 or v.downvotes<>0 or v.my_vote<>1 then raise exception 'Vote switch failed';end if;
end $$;

select set_config('test.auth_user','22222222-2222-4222-8222-222222222222',false);
do $$
declare v record; rejected boolean:=false;
begin
 select * into v from public.pr47_vote_comment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',-1);
 if v.upvotes<>1 or v.downvotes<>1 or v.my_vote<>-1 then raise exception 'Separate voter failed';end if;
 begin
  perform * from public.pr47_vote_comment('ffffffff-ffff-4fff-8fff-ffffffffffff',1);
 exception when others then rejected:=true;
 end;
 if not rejected then raise exception 'Private comment vote permitted';end if;
 if exists(select 1 from public.pr47_comment_vote_summary(
  array['ffffffff-ffff-4fff-8fff-ffffffffffff']::uuid[]
 )) then raise exception 'Private comment vote summary leaked';end if;
end $$;

-- The owning user can vote on a restricted comment.
select set_config('test.auth_user','11111111-1111-4111-8111-111111111111',false);
do $$ declare v record;begin
 select * into v from public.pr47_vote_comment('ffffffff-ffff-4fff-8fff-ffffffffffff',1);
 if v.upvotes<>1 then raise exception 'Owner restricted vote failed';end if;
end $$;

-- Deleting comments cascades vote rows (and cannot orphan an active vote).
delete from public.comments where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
do $$ begin
 if exists(select 1 from public.comment_votes where comment_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
 then raise exception 'Vote cleanup failed';end if;
end $$;
select 'PR48 isolated PostgreSQL execution tests PASS' as result;
