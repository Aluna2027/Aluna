#!/usr/bin/env bash
set -euo pipefail
: "${PGPASSWORD:?Isolated PostgreSQL test password is required}"
psql_args=(-h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1)
admin_id='10000000-0000-4000-8000-000000000003'
app_a='30000000-0000-4000-8000-000000000001'
app_b='30000000-0000-4000-8000-000000000002'
psql "${psql_args[@]}" <<'SQL'
insert into public.profiles(id,display_name) values
 ('30000000-0000-4000-8000-000000000001','Concurrent Applicant A'),
 ('30000000-0000-4000-8000-000000000002','Concurrent Applicant B');
insert into public.first340_applications(profile_id,status,submitted_at) values
 ('30000000-0000-4000-8000-000000000001','submitted',now()),
 ('30000000-0000-4000-8000-000000000002','submitted',now());
create function public.pr50_test_delay_team_insert() returns trigger language plpgsql as 'begin
 if new.team_id=(select id from public.first340_teams where name=''Team 1'') then perform pg_sleep(2); end if;
 return new;
end';
create trigger pr50_test_delay_team_insert before insert on public.first340_team_members for each row execute function public.pr50_test_delay_team_insert();
do $pr50$
begin
 if (select count(*) from public.first340_team_members where team_id=(select id from public.first340_teams where name='Team 1'))<>16 then
  raise exception 'Concurrency fixture requires exactly one Team 1 place available';
 end if;
end
$pr50$;
SQL
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
psql "${psql_args[@]}" >"$tmp_dir/session-a.log" 2>&1 <<SQL &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','${admin_id}',true);
select public.admin_first340_decision((select id from public.first340_applications where profile_id='${app_a}'),'selected',(select id from public.first340_teams where name='Team 1'),'Concurrent assignment A');
commit;
SQL
pid_a=$!
sleep 0.2
psql "${psql_args[@]}" >"$tmp_dir/session-b.log" 2>&1 <<SQL &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','${admin_id}',true);
select public.admin_first340_decision((select id from public.first340_applications where profile_id='${app_b}'),'selected',(select id from public.first340_teams where name='Team 1'),'Concurrent assignment B');
commit;
SQL
pid_b=$!
if wait "$pid_a"; then status_a=0; else status_a=$?; fi
if wait "$pid_b"; then status_b=0; else status_b=$?; fi
if [[ "$status_a" -ne 0 ]]; then cat "$tmp_dir/session-a.log"; echo 'First assignment failed'; exit 1; fi
if [[ "$status_b" -eq 0 ]] || ! grep -qi 'Team is full' "$tmp_dir/session-b.log"; then cat "$tmp_dir/session-b.log"; echo 'Second assignment was not rejected for capacity'; exit 1; fi
psql "${psql_args[@]}" <<SQL
do \$pr50\$
begin
 if (select count(*) from public.first340_team_members where team_id=(select id from public.first340_teams where name='Team 1'))<>17 then raise exception 'Concurrent capacity did not stop at 17'; end if;
 if (select status from public.first340_applications where profile_id='${app_a}')<>'selected' or not exists(select 1 from public.first340_team_members where application_id=(select id from public.first340_applications where profile_id='${app_a}') and team_id=(select id from public.first340_teams where name='Team 1')) then raise exception 'Winning assignment inconsistent'; end if;
 if (select status from public.first340_applications where profile_id='${app_b}')<>'submitted' or exists(select 1 from public.first340_team_members where application_id=(select id from public.first340_applications where profile_id='${app_b}')) or exists(select 1 from public.first340_audit where application_id=(select id from public.first340_applications where profile_id='${app_b}')) then raise exception 'Rejected assignment left partial state'; end if;
 if (select count(*) from public.first340_team_members where application_id in (select id from public.first340_applications where profile_id in ('${app_a}','${app_b}')))<>1 then raise exception 'Duplicate concurrent assignment'; end if;
end
\$pr50\$;
SQL
psql "${psql_args[@]}" -c 'drop trigger pr50_test_delay_team_insert on public.first340_team_members; drop function public.pr50_test_delay_team_insert();'
psql "${psql_args[@]}" <<SQL
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','${admin_id}',true);
select public.admin_first340_decision((select id from public.first340_applications where profile_id='${app_a}'),'selected',(select id from public.first340_teams where name='Team 2'),'Concurrent winner moved to Team 2');
commit;
SQL
psql "${psql_args[@]}" <<SQL
do \$pr50\$
declare v_team_one uuid; v_team_two uuid; v_total integer;
begin
 select id into v_team_one from public.first340_teams where name='Team 1';
 select id into v_team_two from public.first340_teams where name='Team 2';
 select count(*) into v_total from public.first340_team_members;
 if v_total<>17 or (select count(*) from public.first340_team_members where team_id=v_team_one)<>16 or (select count(*) from public.first340_team_members where team_id=v_team_two)<>1 or (select count(*) from public.first340_team_members where application_id=(select id from public.first340_applications where profile_id='${app_a}'))<>1 or not exists(select 1 from public.first340_audit where application_id=(select id from public.first340_applications where profile_id='${app_a}') and previous_team_id=v_team_one and new_team_id=v_team_two) then raise exception 'Team switch failed capacity, single-assignment, or audit checks'; end if;
end
\$pr50\$;
SQL
echo 'PASS: two-session capacity race and audited team switch'
