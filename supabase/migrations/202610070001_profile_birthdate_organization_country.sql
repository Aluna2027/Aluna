alter table public.profiles
 add column if not exists date_of_birth date null;

alter table public.organizations
 add column if not exists country text null;

alter table public.organizations
 drop constraint if exists organizations_country_length_check;

alter table public.organizations
 add constraint organizations_country_length_check
 check (country is null or char_length(country) between 2 and 100);

create or replace function public.create_organization_v2(
 p_name text,
 p_type public.organization_type,
 p_country text,
 p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid;
 v_user uuid := auth.uid();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if char_length(trim(p_name)) not between 2 and 160 then raise exception 'Name must be 2 to 160 characters'; end if;
 if p_type is null then raise exception 'Organization type required'; end if;
 if char_length(trim(coalesce(p_country,''))) not between 2 and 100 then raise exception 'Country required'; end if;
 if char_length(coalesce(p_description,'')) > 3000 then raise exception 'Description too long'; end if;

 insert into public.organizations (name, organization_type, country, description)
 values (
  trim(p_name),
  p_type,
  trim(p_country),
  nullif(trim(coalesce(p_description,'')),'')
 )
 returning id into v_id;

 insert into public.organization_members (organization_id, profile_id, member_role)
 values (v_id, v_user, 'admin');

 return v_id;
end
$$;

revoke all on function public.create_organization_v2(text,public.organization_type,text,text) from public,anon;
grant execute on function public.create_organization_v2(text,public.organization_type,text,text) to authenticated;
