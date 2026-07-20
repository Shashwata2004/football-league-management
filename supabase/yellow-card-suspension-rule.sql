begin;

alter table public.seasons
  add column if not exists yellow_card_suspension_threshold integer not null default 3;

alter table public.seasons
  drop constraint if exists seasons_yellow_card_suspension_threshold_check;

alter table public.seasons
  add constraint seasons_yellow_card_suspension_threshold_check
  check (yellow_card_suspension_threshold between 2 and 10);

commit;

notify pgrst, 'reload schema';
