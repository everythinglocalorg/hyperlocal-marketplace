-- ============================================================
-- FIX: signup bonus + referral payout silently failing
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- Root cause: the auth service (supabase_auth_admin) runs with
-- search_path=auth. handle_new_user called award_local_bucks()
-- and process_referral() UNQUALIFIED, so inside the signup
-- trigger they resolved to nothing → "function does not exist"
-- → swallowed by the best-effort exception handler. Every signup
-- since ~2026-07-01 got a profile but no 10 LB, and signup-link
-- referrals never paid.
--
-- Fix: pin search_path=public on the functions and schema-qualify
-- every cross-function call.
-- ============================================================

create or replace function public.award_local_bucks(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id uuid default null,
  p_reference_type text default null
)
returns void as $$
begin
  insert into public.local_bucks_transactions(user_id, amount, type, reason, reference_id, reference_type)
  values (p_user_id, p_amount, 'earn', p_reason, p_reference_id, p_reference_type);

  update public.profiles
  set local_bucks = local_bucks + p_amount
  where id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.process_referral(
  p_referred_id uuid,
  p_referral_code text
)
returns void as $$
declare
  v_referrer_id uuid;
begin
  select id into v_referrer_id
  from public.profiles
  where referral_code = upper(p_referral_code)
    and id != p_referred_id;

  if v_referrer_id is null then return; end if;

  insert into public.referrals (referrer_id, referred_id, referral_code, converted, bucks_awarded, converted_at)
  values (v_referrer_id, p_referred_id, upper(p_referral_code), true, true, now())
  on conflict (referred_id) do nothing;

  -- Only award when the referral row was actually created,
  -- so a repeat signup event can never double-pay.
  if not found then return; end if;

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
  perform public.award_local_bucks(
    v_referrer_id,
    20,
    'referral_signup',
    p_referred_id,
    'referral'
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_referral_code text;
  v_ref_code text;
  v_role text;
begin
  -- Generate unique referral code
  loop
    new_referral_code := upper(substring(md5(random()::text) from 1 for 6));
    exit when not exists (select 1 from public.profiles where referral_code = new_referral_code);
  end loop;

  v_ref_code := new.raw_user_meta_data->>'referred_by_code';
  v_role := case
    when new.raw_user_meta_data->>'role' = 'vendor' then 'vendor'
    else 'buyer'
  end;

  insert into public.profiles (id, email, full_name, avatar_url, role, referral_code)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    v_role,
    new_referral_code
  )
  on conflict (id) do nothing;

  -- Best-effort: a failure here must never block account creation
  begin
    perform public.award_local_bucks(new.id, 10, 'signup_bonus');
  exception when others then
    raise warning 'handle_new_user: signup bonus failed for %: %', new.id, sqlerrm;
  end;

  if v_ref_code is not null and v_ref_code != '' then
    begin
      perform public.process_referral(new.id, v_ref_code);
    exception when others then
      raise warning 'handle_new_user: referral processing failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
