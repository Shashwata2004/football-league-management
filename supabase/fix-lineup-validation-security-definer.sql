-- Fix "permission denied for schema app_private" on lineup submission.
--
-- app_private.validate_lineup_after_change() is a trigger function whose body
-- makes nested schema-qualified calls to app_private.validate_published_lineup().
-- As a SECURITY INVOKER function, that nested call is resolved against the
-- invoking role (service_role), which was intentionally stripped of access to
-- app_private (revoke all ... from public). Trigger dispatch bypasses the ACL,
-- so the trigger fires, but the nested call is denied -> errcode 42501.
--
-- Making the caller SECURITY DEFINER runs its body as the schema owner, which
-- retains USAGE on app_private and EXECUTE on the helper, while keeping
-- app_private locked down from service_role. This mirrors the existing
-- harden-auth-trigger-function.sql pattern.
--
-- Safe to run multiple times.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function app_private.validate_lineup_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_name = 'lineups' then
    perform app_private.validate_published_lineup(new.id);
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform app_private.validate_published_lineup(old.lineup_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform app_private.validate_published_lineup(new.lineup_id);
    return new;
  end if;

  return old;
end
$function$;

revoke all on function app_private.validate_lineup_after_change()
from public, anon, authenticated;

commit;
