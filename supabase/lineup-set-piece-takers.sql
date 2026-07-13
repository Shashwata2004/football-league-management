begin;

create table if not exists public.lineup_set_piece_takers (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  set_piece_type text not null check (set_piece_type in ('PENALTY', 'FREE_KICK')),
  priority smallint not null check (priority between 1 and 60),
  created_at timestamptz not null default now(),
  unique (lineup_id, set_piece_type, priority),
  unique (lineup_id, set_piece_type, player_registration_id)
);

create index if not exists idx_lineup_set_piece_takers_lineup
  on public.lineup_set_piece_takers(lineup_id, set_piece_type, priority);

alter table public.lineup_set_piece_takers enable row level security;
revoke all on public.lineup_set_piece_takers from anon, authenticated;
grant select, insert, update, delete on public.lineup_set_piece_takers to service_role;

commit;

notify pgrst, 'reload schema';
