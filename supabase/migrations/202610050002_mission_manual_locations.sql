alter table public.missions
  add column if not exists manual_place text,
  add column if not exists manual_country text;

alter table public.missions
  alter column city_id drop not null;

alter table public.missions
  drop constraint if exists missions_manual_place_length_check;
alter table public.missions
  add constraint missions_manual_place_length_check
  check (manual_place is null or char_length(trim(manual_place)) between 1 and 160);

alter table public.missions
  drop constraint if exists missions_manual_country_check;
alter table public.missions
  add constraint missions_manual_country_check
  check (manual_country is null or manual_country in (
    'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
    'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
    'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic (CAR)','Chad','Chile','China','Colombia','Comoros','Congo (Congo-Brazzaville)','Costa Rica','Cote d''Ivoire (Ivory Coast)','Croatia','Cuba','Cyprus','Czechia (Czech Republic)',
    'Democratic Republic of the Congo (Congo-Kinshasa)','Denmark','Djibouti','Dominica','Dominican Republic',
    'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini (formerly Swaziland)','Ethiopia',
    'Fiji','Finland','France',
    'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
    'Haiti','Holy See (Vatican City) – UN Observer State','Honduras','Hungary',
    'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
    'Jamaica','Japan','Jordan',
    'Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
    'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
    'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar (formerly Burma)',
    'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia (formerly Macedonia)','Norway',
    'Oman',
    'Pakistan','Palau','Palestine – UN Observer State','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
    'Qatar',
    'Romania','Russia','Rwanda',
    'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
    'Tajikistan','Tanzania','Thailand','Timor-Leste (East Timor)','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey (Türkiye)','Turkmenistan','Tuvalu',
    'Uganda','Ukraine','United Arab Emirates (UAE)','United Kingdom (UK)','United States of America (USA)','Uruguay','Uzbekistan',
    'Vanuatu','Venezuela','Vietnam',
    'Yemen',
    'Zambia','Zimbabwe'
  ));

alter table public.missions
  drop constraint if exists missions_location_mode_check;
alter table public.missions
  add constraint missions_location_mode_check
  check (
    (city_id is not null and manual_place is null and manual_country is null)
    or
    (city_id is null and manual_place is not null and manual_country is not null and community_id is null)
  );

create or replace function public.create_mission_v2(
  p_city uuid,
  p_manual_place text,
  p_manual_country text,
  p_community uuid,
  p_actor uuid,
  p_title text,
  p_overview text,
  p_location text,
  p_goal text,
  p_roles text default null,
  p_start date default null,
  p_end date default null,
  p_budget numeric default null,
  p_funding numeric default null,
  p_currency char(3) default 'EUR'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.can_act_as(p_actor) then raise exception 'Not permitted'; end if;

  if p_city is not null then
    if p_manual_place is not null or p_manual_country is not null then raise exception 'Choose one mission location method'; end if;
    if not exists(select 1 from public.places where id=p_city and source_key is not null) then raise exception 'City unavailable'; end if;
  else
    if nullif(trim(coalesce(p_manual_place,'')),'') is null or nullif(trim(coalesce(p_manual_country,'')),'') is null then raise exception 'Manual place and country are required'; end if;
    if p_community is not null then raise exception 'Manual mission locations cannot link a mesh community'; end if;
  end if;

  if char_length(coalesce(p_roles,''))>2000 then raise exception 'Roles too long'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 3 and 180
    or char_length(trim(coalesce(p_overview,''))) not between 10 and 5000
    or char_length(trim(coalesce(p_location,''))) not between 2 and 240
    or char_length(trim(coalesce(p_goal,''))) not between 3 and 2000
    or char_length(trim(coalesce(p_manual_place,''))) > 160
  then raise exception 'Invalid mission details'; end if;

  insert into public.missions(
    city_id,manual_place,manual_country,community_id,created_by_actor_id,title,overview,location_text,goal,roles_summary,
    starts_on,ends_on,budget_amount,funding_goal_amount,currency_code
  )
  values(
    p_city,
    nullif(trim(coalesce(p_manual_place,'')),''),
    nullif(trim(coalesce(p_manual_country,'')),''),
    p_community,p_actor,trim(p_title),trim(p_overview),trim(p_location),trim(p_goal),
    nullif(trim(coalesce(p_roles,'')),''),
    p_start,p_end,p_budget,p_funding,p_currency
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.create_mission_v2(uuid,text,text,uuid,uuid,text,text,text,text,text,date,date,numeric,numeric,char(3)) from public;
revoke all on function public.create_mission_v2(uuid,text,text,uuid,uuid,text,text,text,text,text,date,date,numeric,numeric,char(3)) from anon;
grant execute on function public.create_mission_v2(uuid,text,text,uuid,uuid,text,text,text,text,text,date,date,numeric,numeric,char(3)) to authenticated;
