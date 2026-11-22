-- Verification of the real Aluna comment mention trigger, RLS and member checks
-- against the isolated PostgreSQL fixture. Only synthetic UUIDs and data.
\set ON_ERROR_STOP on
select set_config('test.auth_user','11111111-1111-4111-8111-111111111111',false);
do $$
declare rejected boolean:=false;
begin
 -- Trigger must reject a label that does not match the submitted comment body.
 begin
  perform public.pr47_edit_comment('ffffffff-ffff-4fff-8fff-ffffffffffff',
   'No matching mention',
   '[{"actorId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","start":0,"label":"Bob"}]'::jsonb);
 exception when others then rejected:=true;
 end;
 if not rejected then raise exception 'PR47 real mention trigger failed to reject mismatched text';end if;
end $$;

-- Member can edit the restricted comment and preserve a validated Unicode mention.
do $$
declare ok boolean;
begin
 ok:=public.pr47_edit_comment('ffffffff-ffff-4fff-8fff-ffffffffffff',
  '🌍 @Bob welcome',
  '[{"actorId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","start":2,"label":"Bob"}]'::jsonb);
 if not ok then raise exception 'Member edit unexpectedly rejected';end if;
 if not exists(select 1 from public.comment_mentions
  where comment_id='ffffffff-ffff-4fff-8fff-ffffffffffff' and start_offset=2)
 then raise exception 'Unicode codepoint mention offset lost';end if;
end $$;

-- Verify actual RLS read behavior with the authenticated role (rather than postgres).
select set_config('test.auth_user','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
do $$
begin
 if exists(select 1 from public.comments
  where id='ffffffff-ffff-4fff-8fff-ffffffffffff')
 then raise exception 'Nonmember read protected comment through RLS';end if;
end $$;
reset role;
select set_config('test.auth_user','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
do $$
begin
 if not exists(select 1 from public.comments
  where id='ffffffff-ffff-4fff-8fff-ffffffffffff')
 then raise exception 'Member could not read own protected comment under RLS';end if;
end $$;
reset role;

-- Direct writes to the private per-person vote table must not be possible.
select set_config('test.auth_user','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
do $$
declare rejected boolean:=false;
begin
 begin
  insert into public.comment_votes(comment_id,voter_id,vote)
  values('ffffffff-ffff-4fff-8fff-ffffffffffff',
    '22222222-2222-4222-8222-222222222222',1);
 exception when insufficient_privilege then rejected:=true;
 end;
 if not rejected then raise exception 'Direct vote insert permission bypass';end if;
end $$;
reset role;
select 'PR48 real Aluna trigger/RLS/member integration PASS' as result;
