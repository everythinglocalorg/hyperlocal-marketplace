-- ─────────────────────────────────────────────────────────────────────────────
-- Estimates: snapshot customer contact info on the estimate + address on CRM
-- contacts, so a proposal can be emailed to the customer or sent as an in-app
-- message regardless of whether they have an account.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.estimates
  add column if not exists customer_name    text,
  add column if not exists customer_email   text,
  add column if not exists customer_phone   text,
  add column if not exists customer_address text,
  add column if not exists sent_at          timestamptz;

alter table public.crm_contacts
  add column if not exists address text;
