-- Phase 12: impact aggregation foundations. Values are source-linked, never demo defaults.
alter table public.contributions add column if not exists quantity numeric(14,2) check(quantity is null or quantity>=0);
alter table public.contributions add column if not exists quantity_unit text check(quantity_unit is null or quantity_unit in ('hours','items','people','nodes','currency'));
create index if not exists contributions_quantity_idx on public.contributions(contribution_type,quantity_unit) where quantity is not null;

create table public.impact_graph_edges (
 id uuid primary key default gen_random_uuid(),
 source_type text not null check(source_type in ('actor','mission','community','city','contribution','proof','verification')),
 source_id uuid not null,
 relation text not null check(relation in ('created','participated','located_in','contributed_to','supported_by','verified_by','measured_by')),
 target_type text not null check(target_type in ('actor','mission','community','city','contribution','proof','verification','impact_metric')),
 target_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index impact_graph_edges_source_idx on public.impact_graph_edges(source_type,source_id,created_at desc);
create index impact_graph_edges_target_idx on public.impact_graph_edges(target_type,target_id,created_at desc);
alter table public.impact_graph_edges enable row level security;
create policy "Read impact graph edges" on public.impact_graph_edges for select to authenticated using(true);
revoke insert,update,delete on public.impact_graph_edges from anon,authenticated;
