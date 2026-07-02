-- Per-listing CTA button.
-- Adds listings.cta_type: 'book' | 'estimate' | 'call' | 'menu' | 'buy' | 'rent'.
-- Null = legacy listings keep the automatic type/category-based CTA.

alter table public.listings
  add column if not exists cta_type text
  check (cta_type in ('book', 'estimate', 'call', 'menu', 'buy', 'rent'));
