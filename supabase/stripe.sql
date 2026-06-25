-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Adds Stripe columns to vendors table

alter table public.vendors
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_enabled boolean default false;
