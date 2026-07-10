-- ============================================================
-- Everything Local — paid business posts on Local Pages
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Hiring and Offer posts are business-only and billed $5/mo through the same
-- Stripe flow as Local Jobs. A draft post is inserted is_active = false and the
-- webhook flips it live once paid; these columns let us (a) cancel the sub when
-- the post is deleted and (b) link a Hiring post to its cross-posted job row.
-- ============================================================

alter table public.community_posts
  add column if not exists stripe_subscription_id text,
  add column if not exists linked_job_id uuid references public.jobs(id) on delete set null;
