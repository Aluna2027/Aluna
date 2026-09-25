-- Existing members retain access; new profiles complete the short onboarding flow.
alter table public.profiles add column skills text[] not null default '{}';
alter table public.profiles add column interests text[] not null default '{}';
alter table public.profiles add column onboarded_at timestamptz;
update public.profiles set onboarded_at=created_at where onboarded_at is null;
alter table public.profiles add constraint profile_skills_limit check(cardinality(skills)<=20);
alter table public.profiles add constraint profile_interests_limit check(cardinality(interests)<=20);
grant update(skills,interests) on public.profiles to authenticated;

create function public.complete_member_onboarding(p_name text,p_avatar text,p_location text,p_bio text,p_skills text[],p_interests text[])
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid:=auth.uid();
begin
 if v_id is null then raise exception 'Authentication required'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 1 and 120
    or char_length(coalesce(p_location,''))>160 or char_length(coalesce(p_bio,''))>2000
    or char_length(coalesce(p_avatar,''))>500 or (p_avatar is not null and p_avatar<>'' and p_avatar !~ '^https://[^[:space:]]+$')
    or cardinality(coalesce(p_skills,'{}'))>20 or cardinality(coalesce(p_interests,'{}'))>20
    or exists(select 1 from unnest(coalesce(p_skills,'{}') || coalesce(p_interests,'{}')) x where char_length(trim(x)) not between 1 and 80)
 then raise exception 'Invalid profile fields'; end if;
 update public.profiles set display_name=trim(p_name),avatar_url=nullif(trim(coalesce(p_avatar,'')),''),
  location_text=nullif(trim(coalesce(p_location,'')),''),bio=nullif(trim(coalesce(p_bio,'')),''),
  skills=coalesce(p_skills,'{}'),interests=coalesce(p_interests,'{}'),onboarded_at=coalesce(onboarded_at,now()),updated_at=now()
 where id=v_id;
 if not found then raise exception 'Profile unavailable'; end if;
end $$;
revoke all on function public.complete_member_onboarding(text,text,text,text,text[],text[]) from public;
grant execute on function public.complete_member_onboarding(text,text,text,text,text[],text[]) to authenticated;
