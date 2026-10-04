-- Phase 19: first and last names for member profiles.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

alter table public.profiles drop constraint if exists profiles_first_name_length;
alter table public.profiles add constraint profiles_first_name_length
  check (first_name is null or char_length(first_name) between 1 and 80);

alter table public.profiles drop constraint if exists profiles_last_name_length;
alter table public.profiles add constraint profiles_last_name_length
  check (last_name is null or char_length(last_name) between 1 and 80);

grant update (first_name,last_name) on public.profiles to authenticated;

create or replace function public.complete_member_onboarding_v3(
  p_display_name text,
  p_first_name text,
  p_last_name text,
  p_avatar text,
  p_location text,
  p_bio text,
  p_skills text[],
  p_interests text[],
  p_aluna_role public.aluna_member_role
)
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid:=auth.uid();
begin
 if v_id is null then raise exception 'Authentication required'; end if;
 if p_aluna_role is null
    or char_length(trim(coalesce(p_display_name,''))) not between 1 and 120
    or char_length(trim(coalesce(p_first_name,''))) not between 1 and 80
    or char_length(trim(coalesce(p_last_name,''))) not between 1 and 80
    or char_length(coalesce(p_location,''))>160
    or char_length(coalesce(p_bio,''))>2000
    or char_length(coalesce(p_avatar,''))>500
    or (p_avatar is not null and p_avatar<>'' and p_avatar !~ '^https://[^[:space:]]+$')
    or cardinality(coalesce(p_skills,'{}'))>20
    or cardinality(coalesce(p_interests,'{}'))>20
    or exists(
      select 1
      from unnest(coalesce(p_skills,'{}') || coalesce(p_interests,'{}')) x
      where char_length(trim(x)) not between 1 and 80
    )
 then raise exception 'Invalid profile fields'; end if;

 update public.profiles
 set display_name=trim(p_display_name),
     first_name=trim(p_first_name),
     last_name=trim(p_last_name),
     avatar_url=nullif(trim(coalesce(p_avatar,'')),''),
     location_text=nullif(trim(coalesce(p_location,'')),''),
     bio=nullif(trim(coalesce(p_bio,'')),''),
     skills=coalesce(p_skills,'{}'),
     interests=coalesce(p_interests,'{}'),
     aluna_role=p_aluna_role,
     onboarded_at=coalesce(onboarded_at,now()),
     updated_at=now()
 where id=v_id;

 if not found then raise exception 'Profile unavailable'; end if;
end $$;

revoke all on function public.complete_member_onboarding_v3(text,text,text,text,text,text,text[],text[],public.aluna_member_role) from public;
grant execute on function public.complete_member_onboarding_v3(text,text,text,text,text,text,text[],text[],public.aluna_member_role) to authenticated;
