alter table public.reactions
  add column if not exists vote smallint not null default 1;

alter table public.reactions
  drop constraint if exists reactions_vote_check;

alter table public.reactions
  add constraint reactions_vote_check check (vote in (-1, 1));
