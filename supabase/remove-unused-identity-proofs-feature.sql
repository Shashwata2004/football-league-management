begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $safety$
declare
  has_identity_proofs boolean;
begin
  if to_regclass('public.identity_proofs') is not null then
    execute 'select exists (select 1 from public.identity_proofs)'
    into has_identity_proofs;

    if has_identity_proofs then
      raise exception using
        errcode = '55000',
        message = 'Cannot remove identity_proofs because the table contains data.';
    end if;
  end if;

  if exists (
    select 1
    from storage.objects
    where bucket_id = 'identity-proofs'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Cannot remove identity-proofs because the Storage bucket contains objects.';
  end if;
end
$safety$;

drop policy if exists "identity_proofs_owner_upload"
on storage.objects;

drop policy if exists "identity_proofs_owner_read"
on storage.objects;

drop table if exists public.identity_proofs;

commit;
