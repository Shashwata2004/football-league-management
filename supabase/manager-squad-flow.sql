-- Manager squad generation flow.
-- Run in Supabase SQL Editor or with backend migration script.

create extension if not exists pgcrypto;

alter type public.request_status add value if not exists 'DRAFT';
alter type public.player_lifecycle_status add value if not exists 'ACTIVE';

do $$ begin
  create type public.identity_mode as enum ('GENERATED', 'VERIFIED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.position_category as enum ('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD');
exception when duplicate_object then null; end $$;

alter table public.players alter column date_of_birth drop not null;
alter table public.players alter column id_type drop not null;
alter table public.players alter column id_number_hash drop not null;
alter table public.players alter column id_number_last4 drop not null;
alter table public.players add column if not exists generated_identity_number text;

with target as (
  select
    id,
    row_number() over (order by created_at, id) as rn
  from public.players
  where id_type is null
    or id_type::text in ('GENERATED_NID', 'GENERATED_BIRTH_ID')
    or generated_identity_number is null
)
update public.players p
set
  id_type = case when target.rn % 2 = 0 then 'BIRTH_ID'::public.id_type else 'NID'::public.id_type end,
  generated_identity_number = case
    when target.rn % 2 = 0 then substr('2026' || lpad(target.rn::text, 13, '0'), 1, 17)
    else (1000000000 + target.rn)::text
  end,
  id_number_hash = encode(digest(case
    when target.rn % 2 = 0 then substr('2026' || lpad(target.rn::text, 13, '0'), 1, 17)
    else (1000000000 + target.rn)::text
  end, 'sha256'), 'hex'),
  id_number_last4 = right(case
    when target.rn % 2 = 0 then substr('2026' || lpad(target.rn::text, 13, '0'), 1, 17)
    else (1000000000 + target.rn)::text
  end, 4),
  updated_at = now()
from target
where p.id = target.id;

alter table public.teams add column if not exists secondary_color text;
alter table public.teams add column if not exists accent_color text;
alter table public.teams add column if not exists home_jersey_url text;
alter table public.teams add column if not exists away_jersey_url text;
alter table public.teams add column if not exists gk_home_jersey_url text;
alter table public.teams add column if not exists gk_away_jersey_url text;

alter table public.player_season_registrations add column if not exists player_code text;
alter table public.player_season_registrations add column if not exists football_position public.football_position;
alter table public.player_season_registrations add column if not exists position_category public.position_category;
alter table public.player_season_registrations add column if not exists identity_mode public.identity_mode not null default 'VERIFIED';
alter table public.player_season_registrations add column if not exists is_generated boolean not null default false;
alter table public.player_season_registrations add column if not exists created_by_manager_id uuid references public.profiles(id);
alter table public.player_season_registrations add column if not exists submitted_at timestamptz;
alter table public.player_season_registrations add column if not exists updated_at timestamptz not null default now();

alter table public.team_registrations add column if not exists updated_at timestamptz not null default now();

update public.player_season_registrations
set player_code = 'PLY-' || upper(substr(id::text, 1, 8))
where player_code is null;

update public.player_season_registrations
set football_position =
  case position
    when 'GK' then 'GK'::public.football_position
    when 'DEF' then 'CB'::public.football_position
    when 'MID' then 'CM'::public.football_position
    else 'ST'::public.football_position
  end
where football_position is null;

update public.player_season_registrations
set position_category =
  case football_position
    when 'GK' then 'GOALKEEPER'::public.position_category
    when 'CB' then 'DEFENDER'::public.position_category
    when 'LB' then 'DEFENDER'::public.position_category
    when 'RB' then 'DEFENDER'::public.position_category
    when 'DM' then 'MIDFIELDER'::public.position_category
    when 'CM' then 'MIDFIELDER'::public.position_category
    when 'AM' then 'MIDFIELDER'::public.position_category
    else 'FORWARD'::public.position_category
  end
where position_category is null;

alter table public.player_season_registrations drop constraint if exists player_registrations_generated_identity_check;
alter table public.player_season_registrations add constraint player_registrations_generated_identity_check
  check (
    (identity_mode = 'GENERATED' and is_generated = true)
    or identity_mode = 'VERIFIED'
  );

create unique index if not exists player_regs_unique_player_code
  on public.player_season_registrations(player_code)
  where player_code is not null;

alter table public.player_season_registrations drop constraint if exists player_season_registrations_team_registration_id_shirt_number_key;
create unique index if not exists player_regs_unique_active_squad_jersey
  on public.player_season_registrations(team_registration_id, shirt_number)
  where shirt_number is not null
    and player_status <> 'REMOVED'
    and (status in ('DRAFT', 'PENDING', 'APPROVED') or player_status = 'SUSPENDED');

create unique index if not exists players_unique_generated_identity_number
  on public.players(generated_identity_number)
  where generated_identity_number is not null;

create index if not exists idx_player_regs_generated_status
  on public.player_season_registrations(team_registration_id, is_generated, status);

notify pgrst, 'reload schema';
