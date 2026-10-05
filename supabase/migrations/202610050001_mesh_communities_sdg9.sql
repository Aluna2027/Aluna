alter table public.mesh_communities
  add column if not exists sdg_number smallint not null default 9,
  add column if not exists sdg_title text not null default 'Industry, Innovation and Infrastructure';

alter table public.mesh_communities
  drop constraint if exists mesh_communities_sdg_number_check;

alter table public.mesh_communities
  add constraint mesh_communities_sdg_number_check check (sdg_number = 9);

alter table public.mesh_communities
  drop constraint if exists mesh_communities_sdg_title_check;

alter table public.mesh_communities
  add constraint mesh_communities_sdg_title_check
  check (sdg_title = 'Industry, Innovation and Infrastructure');
