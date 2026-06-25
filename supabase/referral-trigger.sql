-- ============================================================
-- Update the handle_new_user trigger to process referral codes
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- This replaces the handle_new_user function from schema.sql
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_referral_code text;
  v_ref_code text;
begin
  -- Generate unique referral code
  loop
    new_referral_code := upper(substring(md5(random()::text) from 1 for 6));
    exit when not exists (select 1 from public.profiles where referral_code = new_referral_code);
  end loop;

  -- Extract referral code from user metadata if present
  v_ref_code := new.raw_user_meta_data->>'referred_by_code';

  insert into public.profiles (id, email, full_name, avatar_url, referral_code)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new_referral_code
  );

  -- Award signup Local Bucks
  perform award_local_bucks(new.id, 10, 'signup_bonus');

  -- Process referral if a code was provided
  if v_ref_code is not null and v_ref_code != '' then
    perform process_referral(new.id, v_ref_code);
  end if;

  return new;
end;
$$ language plpgsql security definer;
