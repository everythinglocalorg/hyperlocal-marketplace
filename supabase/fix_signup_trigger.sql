-- ============================================================
-- Harden handle_new_user so account creation can never fail
-- (a raised exception here surfaces to the user as
-- "Database error saving new user" and blocks signup entirely).
--
-- Changes vs referral-trigger.sql:
--   1. role is read from signup metadata (buyer/vendor only —
--      'admin' can never be self-assigned since metadata is
--      client-controlled). Previously the role metadata was
--      ignored, so new vendors got role='buyer' and were routed
--      to buyer onboarding after confirming their email.
--   2. Signup bonus and referral processing are best-effort:
--      if award_local_bucks or process_referral fails, we log a
--      warning instead of aborting the auth.users insert.
--   3. Profile insert is idempotent (on conflict do nothing).
--
-- Run in: Supabase Dashboard → SQL Editor (or applied directly
-- via DATABASE_URL). Replaces handle_new_user from schema.sql /
-- referral-trigger.sql.
-- ============================================================

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
    perform award_local_bucks(new.id, 10, 'signup_bonus');
  exception when others then
    raise warning 'handle_new_user: signup bonus failed for %: %', new.id, sqlerrm;
  end;

  if v_ref_code is not null and v_ref_code != '' then
    begin
      perform process_referral(new.id, v_ref_code);
    exception when others then
      raise warning 'handle_new_user: referral processing failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$ language plpgsql security definer;
