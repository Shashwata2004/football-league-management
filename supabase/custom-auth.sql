-- Switch from Supabase Auth signup/login to backend-owned demo auth.
-- This keeps Supabase as PostgreSQL only and creates separate tables for users/managers.

create extension if not exists pgcrypto;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_managers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_managers enable row level security;
alter table public.app_admins enable row level security;

revoke all on public.app_users from anon, authenticated;
revoke all on public.app_managers from anon, authenticated;
revoke all on public.app_admins from anon, authenticated;
grant select, insert, update, delete on public.app_users, public.app_managers, public.app_admins to service_role;
