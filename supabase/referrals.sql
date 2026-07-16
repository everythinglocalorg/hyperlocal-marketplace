-- ============================================================
-- Referral tracking improvements
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Function to handle referral on signup
-- Called after a new user confirms their email with a ref code.
-- Awards the referrer 20 Local Bucks as soon as the referred
-- user signs up with their link.
create or replace function process_referral(
  p_referred_id uuid,
  p_referral_code text
)
returns void as $$
declare
  v_referrer_id uuid;
begin
  -- Look up who owns this referral code
  select id into v_referrer_id
  from public.profiles
  where referral_code = upper(p_referral_code)
    and id != p_referred_id;

  if v_referrer_id is null then return; end if;

  -- Record the referral (ignore if already exists)
  insert into public.referrals (referrer_id, referred_id, referral_code, converted, bucks_awarded, converted_at)
  values (v_referrer_id, p_referred_id, upper(p_referral_code), true, true, now())
  on conflict (referred_id) do nothing;

  -- Only award when the referral row was actually created,
  -- so a repeat signup event can never double-pay.
  if not found then return; end if;

  -- Update referred user's profile with who referred them
  update public.profiles
  set referred_by = v_referrer_id
  where id = p_referred_id and referred_by is null;

  -- Award referrer 20 Local Bucks at signup.
  -- TODO: everyone currently has Local Pro, so all referrers are paid.
  -- When Local Pro becomes a paid monthly subscription, gate this award:
  --   if not exists (
  --     select 1 from public.vendors
  --     where user_id = v_referrer_id and subscription_status = 'active'
  --   ) then return; end if;
  -- NOTE: schema-qualified + pinned search_path — this runs inside the auth
  -- signup trigger where search_path is 'auth' (see fix_signup_bonus.sql).
  perform public.award_local_bucks(
    v_referrer_id,
    20,
    'referral_signup',
    p_referred_id,
    'referral'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- The old purchase-conversion payout is retired: referrals now pay
-- out at signup, inside process_referral above.
drop function if exists public.complete_referral(uuid);

-- View: referral stats per user
create or replace view public.referral_stats as
select
  r.referrer_id,
  count(*) as total_referrals,
  count(*) filter (where r.converted = true) as converted_referrals,
  coalesce(sum(20) filter (where r.bucks_awarded = true), 0) as total_bucks_earned,
  max(r.created_at) as last_referral_at
from public.referrals r
group by r.referrer_id;
