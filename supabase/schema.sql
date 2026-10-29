-- Pixie Webs booking leads.
-- Run this in the Supabase SQL editor (Database > SQL editor > New query).

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),

  name  text        not null,
  email text        not null,
  phone text        not null,

  start_time timestamptz not null,
  end_time   timestamptz not null,

  event_id  text,
  meet_link text,

  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_term     text,
  utm_content  text,
  referrer     text,

  created_at timestamptz not null default now()
);

-- The real double-booking guard: two requests for the same slot cannot both win.
create unique index if not exists bookings_start_time_key
  on public.bookings (start_time);

create index if not exists bookings_created_at_idx
  on public.bookings (created_at desc);

create index if not exists bookings_email_idx
  on public.bookings (email);

-- No policies by design. The API writes with the service role key, which
-- bypasses RLS; anon and authenticated clients get nothing.
alter table public.bookings enable row level security;
