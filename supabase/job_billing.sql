-- Pay-to-post jobs: a $5/month Stripe subscription keeps a job listing live.
-- Job posters can be any user (not just businesses), so the Stripe customer
-- lives on the profile. The per-job subscription id lets us cancel it when the
-- job is deleted and take the job down if the subscription lapses.

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.jobs add column if not exists stripe_subscription_id text;
