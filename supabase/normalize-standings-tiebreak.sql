begin;

lock table public.standings in share row exclusive mode;

alter table public.standings
  drop constraint if exists standings_non_negative_totals_check;

alter table public.standings
  drop constraint if exists standings_fair_play_score_check;

-- Historical values stored card penalties as positive numbers. Fair-play is now
-- a score: zero is clean and card penalties reduce it below zero.
update public.standings
set fair_play_score = -fair_play_score
where fair_play_score > 0;

alter table public.standings
  add constraint standings_non_negative_totals_check
  check (
    won >= 0
    and drawn >= 0
    and lost >= 0
    and goals_for >= 0
    and goals_against >= 0
  )
  not valid;

alter table public.standings
  add constraint standings_fair_play_score_check
  check (fair_play_score <= 0)
  not valid;

alter table public.standings
  validate constraint standings_non_negative_totals_check;

alter table public.standings
  validate constraint standings_fair_play_score_check;

drop index if exists public.idx_standings_season_sort;

create index idx_standings_season_sort
  on public.standings(
    season_id,
    ((won * 3) + drawn) desc,
    (goals_for - goals_against) desc,
    goals_for desc,
    fair_play_score desc,
    admin_draw_rank asc
  );

commit;

notify pgrst, 'reload schema';
