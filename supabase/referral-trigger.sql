-- ============================================================
-- handle_new_user: profile creation + signup bonus + referral
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- SUPERSEDED-BY-SYNC: this is the same canonical version as in
-- fix_signup_bonus.sql — keep the two in lockstep.
--
-- IMPORTANT: this trigger runs as supabase_auth_admin whose
-- search_path is 'auth'. Every cross-function call MUST be
-- schema-qualified and the function must pin search_path=public,
-- or the calls fail silently (swallowed by the best-effort
-- exception handlers — that bug ate every signup bonus between
-- 2026-07-01 and 2026-07-16).
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
