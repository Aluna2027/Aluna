create or replace function public.check_campaign_mission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists(select 1 from public.missions m where m.id=new.mission_id) then
    raise exception 'Mission unavailable';
  end if;
  return new;
end
$$;

revoke all on function public.check_campaign_mission() from public, anon, authenticated;
