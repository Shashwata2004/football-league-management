begin;

lock table public.player_season_registrations in access exclusive mode;

alter table public.player_season_registrations
  drop column if exists allow_resubmission;

commit;

notify pgrst, 'reload schema';
