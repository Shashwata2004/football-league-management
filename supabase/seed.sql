-- Seed data. Replace the UUID below with an existing Supabase Auth user ID.

-- Example:
-- update public.profiles
-- set role = 'ADMIN'
-- where id = '00000000-0000-0000-0000-000000000000';

insert into public.leagues (name, country, description)
values ('Demo Custom Football League', 'Bangladesh', 'Seed league for local MVP verification')
on conflict do nothing;

with admin_account as (
  insert into public.app_admins (email, full_name, password_hash)
  values (
    'admin@scoreline.com',
    'Scoreline Admin',
    'fd4f6fa7babb79fbc54e61532a2a0600:7282879a85f5cc57872a6cfcd4850c86a6781227f0ea9a26c88e9615a5f62a4ad2c5f16123a7e03bc176f0a622a14700934dd601cc31169c6fa5c15ab05eabbd'
  )
  on conflict (email) do update
  set
    full_name = excluded.full_name,
    password_hash = excluded.password_hash,
    updated_at = now()
  returning id, email, full_name
)
insert into public.profiles (id, email, full_name, role)
select id, email, full_name, 'ADMIN'::public.user_role
from admin_account
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'ADMIN'::public.user_role,
  updated_at = now();
