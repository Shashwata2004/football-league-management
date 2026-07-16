begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    'USER'
  )
  on conflict (id) do nothing;

  return new;
end
$function$;

revoke all on function app_private.handle_new_user()
from public, anon, authenticated;

commit;
