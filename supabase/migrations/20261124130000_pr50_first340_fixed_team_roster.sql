-- PR #50: initialize the fixed First 340 cohort roster.
-- This migration preserves any compatible canonical team rows and never rewrites
-- application or membership history. Run only after separate owner approval.
begin;

lock table public.first340_teams in share row exclusive mode;
lock table public.first340_team_members in share row exclusive mode;

do $$
begin
  if exists (
    select 1 from public.first340_teams
    where name !~ '^Team ([1-9]|1[0-9]|20)$' or capacity <> 17
  ) then
    raise exception 'Existing First 340 teams do not match the fixed 20 x 17 roster; manual review required';
  end if;

  if exists (
    select 1 from public.first340_teams
    group by name having count(*) > 1
  ) then
    raise exception 'Duplicate First 340 team names exist; manual review required';
  end if;

  if exists (
    select 1 from public.first340_team_members
    group by team_id having count(*) > 17
  ) then
    raise exception 'An existing First 340 team exceeds the approved capacity of 17';
  end if;
end
$$;

alter table public.first340_teams
  alter column capacity set default 17;

alter table public.first340_teams
  drop constraint if exists first340_teams_capacity_check;
alter table public.first340_teams
  add constraint first340_teams_capacity_check
  check (capacity = 17);

alter table public.first340_teams
  drop constraint if exists first340_teams_name_check;
alter table public.first340_teams
  add constraint first340_teams_name_check
  check (name ~ '^Team ([1-9]|1[0-9]|20)$');

create unique index if not exists first340_teams_name_uidx
  on public.first340_teams(name);

insert into public.first340_teams(name, description, capacity)
select
  'Team ' || team_number,
  'First 340 cohort team ' || team_number,
  17
from generate_series(1, 20) as team_number
on conflict (name) do nothing;

do $$
begin
  if (select count(*) from public.first340_teams) <> 20
    or exists (
      select 1
      from generate_series(1, 20) as expected(team_number)
      left join public.first340_teams team
        on team.name = 'Team ' || expected.team_number
       and team.capacity = 17
      where team.id is null
    )
  then
    raise exception 'First 340 fixed roster did not initialize as 20 teams of 17';
  end if;
end
$$;

commit;
