begin;

lock table public.player_season_registrations in share row exclusive mode;
lock table public.player_season_stats in share row exclusive mode;

do $audit$
declare
  orphan_player_registrations integer;
  season_mismatches integer;
  invalid_counters integer;
  invalid_aggregates integer;
begin
  select count(*)
  into orphan_player_registrations
  from public.player_season_stats season_stat
  left join public.player_season_registrations player_registration
    on player_registration.id = season_stat.player_registration_id
  where player_registration.id is null;

  select count(*)
  into season_mismatches
  from public.player_season_stats season_stat
  join public.player_season_registrations player_registration
    on player_registration.id = season_stat.player_registration_id
  where season_stat.season_id is distinct from player_registration.season_id;

  select count(*)
  into invalid_counters
  from public.player_season_stats
  where least(
    appearances,
    starts,
    minutes_played,
    goals,
    assists,
    shots,
    shots_on_target,
    chances_created,
    big_chances_created,
    total_passes,
    accurate_passes,
    dribbles_attempted,
    successful_dribbles,
    dribbled_past,
    dispossessed,
    tackles,
    interceptions,
    yellow_cards,
    red_cards,
    player_of_match_count
  ) < 0;

  select count(*)
  into invalid_aggregates
  from public.player_season_stats
  where starts > appearances
    or minutes_played > appearances * 130
    or shots_on_target > shots
    or accurate_passes > total_passes
    or successful_dribbles > dribbles_attempted
    or player_of_match_count > appearances
    or (
      appearances = 0
      and (
        average_rating is not null
        or best_match_rating is not null
        or lowest_match_rating is not null
      )
    )
    or (
      appearances > 0
      and (
        average_rating is null
        or best_match_rating is null
        or lowest_match_rating is null
        or average_rating not between 4.5 and 10
        or best_match_rating not between 4.5 and 10
        or lowest_match_rating not between 4.5 and 10
        or lowest_match_rating > average_rating
        or average_rating > best_match_rating
      )
    );

  if orphan_player_registrations > 0
    or season_mismatches > 0
    or invalid_counters > 0
    or invalid_aggregates > 0 then
    raise exception using
      message = 'Cannot enforce player season statistics integrity because existing data is invalid.',
      detail = format(
        'orphan_player_registrations=%s, season_mismatches=%s, invalid_counters=%s, invalid_aggregates=%s',
        orphan_player_registrations,
        season_mismatches,
        invalid_counters,
        invalid_aggregates
      );
  end if;
end
$audit$;

do $parent_key$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.player_season_registrations'::regclass
      and conname = 'player_season_registrations_id_season_id_key'
  ) then
    alter table public.player_season_registrations
      add constraint player_season_registrations_id_season_id_key
      unique (id, season_id);
  end if;
end
$parent_key$;

do $replace_foreign_key$
declare
  current_definition text;
begin
  select pg_get_constraintdef(oid)
  into current_definition
  from pg_constraint
  where conrelid = 'public.player_season_stats'::regclass
    and conname = 'player_season_stats_player_registration_id_fkey';

  if current_definition is not null
    and (
      position(
        'FOREIGN KEY (player_registration_id, season_id)'
        in current_definition
      ) = 0
      or position(
        'REFERENCES player_season_registrations(id, season_id)'
        in current_definition
      ) = 0
      or position('ON DELETE CASCADE' in current_definition) = 0
    ) then
    alter table public.player_season_stats
      drop constraint player_season_stats_player_registration_id_fkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.player_season_stats'::regclass
      and conname = 'player_season_stats_player_registration_id_fkey'
  ) then
    alter table public.player_season_stats
      add constraint player_season_stats_player_registration_id_fkey
      foreign key (player_registration_id, season_id)
      references public.player_season_registrations(id, season_id)
      on delete cascade
      not valid;
  end if;
end
$replace_foreign_key$;

alter table public.player_season_stats
  drop constraint if exists player_season_stats_non_negative_dashboard_stats;

alter table public.player_season_stats
  add constraint player_season_stats_non_negative_dashboard_stats
  check (
    appearances >= 0
    and starts >= 0
    and minutes_played >= 0
    and goals >= 0
    and assists >= 0
    and shots >= 0
    and shots_on_target >= 0
    and chances_created >= 0
    and big_chances_created >= 0
    and total_passes >= 0
    and accurate_passes >= 0
    and dribbles_attempted >= 0
    and successful_dribbles >= 0
    and dribbled_past >= 0
    and dispossessed >= 0
    and tackles >= 0
    and interceptions >= 0
    and yellow_cards >= 0
    and red_cards >= 0
    and player_of_match_count >= 0
  )
  not valid;

alter table public.player_season_stats
  drop constraint if exists player_season_stats_aggregate_consistency_check;

alter table public.player_season_stats
  add constraint player_season_stats_aggregate_consistency_check
  check (
    starts <= appearances
    and minutes_played <= appearances * 130
    and shots_on_target <= shots
    and accurate_passes <= total_passes
    and successful_dribbles <= dribbles_attempted
    and player_of_match_count <= appearances
    and (
      (
        appearances = 0
        and average_rating is null
        and best_match_rating is null
        and lowest_match_rating is null
      )
      or (
        appearances > 0
        and average_rating is not null
        and best_match_rating is not null
        and lowest_match_rating is not null
        and average_rating between 4.5 and 10
        and best_match_rating between 4.5 and 10
        and lowest_match_rating between 4.5 and 10
        and lowest_match_rating <= average_rating
        and average_rating <= best_match_rating
      )
    )
  )
  not valid;

alter table public.player_season_stats
  validate constraint player_season_stats_player_registration_id_fkey;

alter table public.player_season_stats
  validate constraint player_season_stats_non_negative_dashboard_stats;

alter table public.player_season_stats
  validate constraint player_season_stats_aggregate_consistency_check;

commit;

notify pgrst, 'reload schema';
