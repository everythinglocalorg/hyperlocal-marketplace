-- ============================================================
-- Referral tracking improvements
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Function to handle referral on signup
-- Called after a new user confirms their email with a ref code
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
  insert into public.referrals (referrer_id, referred_id, referral_code)
  values (v_referrer_id, p_referred_id, upper(p_referral_code))
  on conflict (referred_id) do nothing;

  -- Update referred user's profile with who referred them
  update public.profiles
  set referred_by = v_referrer_id
  where id = p_referred_id and referred_by is null;

end;
$$ language plpgsql security definer;

-- Function called when a referred user makes their first purchase/booking
-- Awards Local Bucks to referrer
create or replace function complete_referral(p_referred_id uuid)
returns void as $$
declare
  v_referral record;
begin
  select * into v_referral
  from public.referrals
  where referred_id = p_referred_id
    and converted = false
    and bucks_awarded = false;

  if not found then return; end if;

  -- Mark as converted
  update public.referrals
  set converted = true, bucks_awarded = true, converted_at = now()
  where id = v_referral.id;

  -- Award referrer 50 Local Bucks
  perform award_local_bucks(
    v_referral.referrer_id,
    50,
    'referral_conversion',
    p_referred_id,
    'referral'
  );
end;
$$ language plpgsql security definer;

-- View: referral stats per user
create or replace view public.referral_stats as
select
  r.referrer_id,
  count(*) as total_referrals,
  count(*) filter (where r.converted = true) as converted_referrals,
  coalesce(sum(50) filter (where r.bucks_awarded = true), 0) as total_bucks_earned,
  max(r.created_at) as last_referral_at
from public.referrals r
group by r.referrer_id;
