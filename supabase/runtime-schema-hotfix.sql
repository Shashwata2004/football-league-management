-- Runtime schema hotfix for current matchday + upgraded simulation stats.
-- Safe to run multiple times.

alter table public.seasons
  add column if not exists active_matchday_number integer,
  add column if not exists active_matchday_date date,
  add column if not exists active_matchday_started_at timestamptz;

update public.seasons as season
set active_matchday_date = coalesce(
  (
    select min((fixture.kickoff_at at time zone 'Asia/Dhaka')::date)
    from public.fixtures as fixture
    where fixture.season_id = season.id
      and coalesce(fixture.matchday_number, fixture.round_no) = season.active_matchday_number
      and coalesce(fixture.result_confirmed, false) = false
      and fixture.status not in ('FINAL', 'COMPLETED')
  ),
  (
    select max((fixture.kickoff_at at time zone 'Asia/Dhaka')::date)
    from public.fixtures as fixture
    where fixture.season_id = season.id
      and coalesce(fixture.matchday_number, fixture.round_no) = season.active_matchday_number
  )
)
where season.active_matchday_number is not null
  and season.active_matchday_date is null;

alter table public.manager_messages
  add column if not exists notification_key text;

with ranked_reminders as (
  select
    id,
    row_number() over (
      partition by fixture_id, team_registration_id
      order by created_at desc, id desc
    ) as row_number
  from public.manager_messages
  where fixture_id is not null
    and team_registration_id is not null
    and lower(message) like '%submit your lineup%'
)
update public.manager_messages as message
set read_at = coalesce(message.read_at, now())
from ranked_reminders as reminder
where message.id = reminder.id
  and reminder.row_number > 1;

with latest_reminders as (
  select distinct on (fixture_id, team_registration_id)
    id,
    fixture_id,
    team_registration_id
  from public.manager_messages
  where fixture_id is not null
    and team_registration_id is not null
    and lower(message) like '%submit your lineup%'
  order by fixture_id, team_registration_id, created_at desc, id desc
)
update public.manager_messages as message
set notification_key =
  'matchday-lineup:' || reminder.fixture_id || ':' || reminder.team_registration_id
from latest_reminders as reminder
where message.id = reminder.id
  and message.notification_key is null;

create unique index if not exists manager_messages_notification_key_uidx
  on public.manager_messages (notification_key);

alter table public.team_match_stats
  add column if not exists expected_goals numeric(4,2) not null default 0 check (expected_goals >= 0),
  add column if not exists shots_off_target integer not null default 0 check (shots_off_target >= 0),
  add column if not exists hit_woodwork integer not null default 0 check (hit_woodwork >= 0),
  add column if not exists tackles integer not null default 0 check (tackles >= 0),
  add column if not exists interceptions integer not null default 0 check (interceptions >= 0),
  add column if not exists blocks integer not null default 0 check (blocks >= 0),
  add column if not exists clearances integer not null default 0 check (clearances >= 0),
  add column if not exists keeper_saves integer not null default 0 check (keeper_saves >= 0);

alter table public.player_match_stats
  add column if not exists dribbled_past integer not null default 0 check (dribbled_past >= 0),
  add column if not exists clean_sheet boolean not null default false,
  add column if not exists penalty_scored integer not null default 0 check (penalty_scored >= 0),
  add column if not exists penalty_missed integer not null default 0 check (penalty_missed >= 0),
  add column if not exists penalty_saved_for_gk integer not null default 0 check (penalty_saved_for_gk >= 0);

alter table public.player_match_stats
  drop constraint if exists player_match_stats_rating_check;

alter table public.player_match_stats
  add constraint player_match_stats_rating_check check (rating between 4.5 and 10);

alter table public.player_season_stats
  add column if not exists dribbled_past integer not null default 0 check (dribbled_past >= 0);

alter type public.match_event_type add value if not exists 'PENALTY_GOAL';
alter type public.match_event_type add value if not exists 'PENALTY_SAVED';
alter type public.match_event_type add value if not exists 'PENALTY_MISS';
alter type public.match_event_type add value if not exists 'INJURY';
alter type public.match_event_type add value if not exists 'OWN_GOAL';
alter type public.match_event_type add value if not exists 'HIT_WOODWORK';

alter table public.match_substitutions
  drop constraint if exists match_substitutions_reason_check;

alter table public.match_substitutions
  add constraint match_substitutions_reason_check
  check (reason in ('LOW_RATING', 'FATIGUE', 'TACTICAL_CHANGE', 'YELLOW_CARD_RISK', 'INJURY_PLACEHOLDER', 'INJURY'));

create table if not exists public.match_injuries (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  injury_type text not null default 'MINOR_KNOCK',
  severity text not null default 'MINOR',
  minute integer not null check (minute between 1 and 130),
  forced_substitution boolean not null default false,
  expected_matches_out integer not null default 0 check (expected_matches_out >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.player_suspensions (
  id uuid primary key default gen_random_uuid(),
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  reason text not null,
  source_fixture_id uuid references public.fixtures(id) on delete set null,
  matches_remaining integer not null default 1 check (matches_remaining >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SERVED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

notify pgrst, 'reload schema';
