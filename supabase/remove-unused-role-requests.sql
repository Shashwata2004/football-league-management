begin;

do $$
declare
  role_request_rows_exist boolean;
begin
  if to_regclass('public.role_requests') is not null then
    execute 'lock table public.role_requests in access exclusive mode';
    execute 'select exists (select 1 from public.role_requests)'
      into role_request_rows_exist;

    if role_request_rows_exist then
      raise exception using
        errcode = '23514',
        message = 'Cannot remove role_requests because it contains data.';
    end if;
  end if;
end
$$;

drop table if exists public.role_requests;

commit;

notify pgrst, 'reload schema';
