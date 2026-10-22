-- PR #33: optional demographic fields for personal onboarding.
-- Demo migration first; no production application until verified.
alter table public.profiles add column if not exists gender text;
alter table public.profiles drop constraint if exists profiles_gender_allowed;
alter table public.profiles add constraint profiles_gender_allowed
 check (gender is null or gender in ('male','female','prefer_not_to_say'));

create or replace function public.complete_member_onboarding_v4(
 p_display_name text,p_first_name text,p_last_name text,p_avatar text,
 p_location text,p_bio text,p_skills text[],p_interests text[],
 p_aluna_role public.aluna_member_role,p_date_of_birth date,p_gender text
) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid:=auth.uid();
begin
 if v_id is null then raise exception 'Authentication required'; end if;
 if p_date_of_birth > current_date or
    (p_gender is not null and p_gender not in ('male','female','prefer_not_to_say'))
 then raise exception 'Invalid profile fields'; end if;
 perform public.complete_member_onboarding_v3(
  p_display_name,p_first_name,p_last_name,p_avatar,p_location,p_bio,
  p_skills,p_interests,p_aluna_role);
 update public.profiles set date_of_birth=p_date_of_birth,gender=p_gender
 where id=v_id;
 if not found then raise exception 'Profile unavailable'; end if;
end $$;
revoke all on function public.complete_member_onboarding_v4(
 text,text,text,text,text,text,text[],text[],public.aluna_member_role,date,text)
 from public,anon;
grant execute on function public.complete_member_onboarding_v4(
 text,text,text,text,text,text,text[],text[],public.aluna_member_role,date,text)
 to authenticated;
