-- ─────────────────────────────────────────────────────────────────────────────
-- Manual appointments: let vendors create bookings for walk-in / phone customers
-- who don't have an Everything Local account.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- buyer_id may be null for manually-created appointments (no account on file)
alter table public.bookings
  alter column buyer_id drop not null;

-- Contact details captured directly on the booking for manual entries
alter table public.bookings
  add column if not exists customer_name  text,
  add column if not exists customer_phone text,
  add column if not exists title          text;

-- Distinguish vendor-created appointments from buyer-requested bookings
alter table public.bookings
  add column if not exists source text not null default 'buyer';
-- source: 'buyer' = requested through the site, 'manual' = vendor created it

-- Allow a vendor to insert bookings for their own vendor row (manual appts)
drop policy if exists "Vendors can create own bookings" on public.bookings;
create policy "Vendors can create own bookings" on public.bookings
  for insert with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );
