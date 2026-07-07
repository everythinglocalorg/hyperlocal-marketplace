-- ─────────────────────────────────────────────────────────────────────────────
-- LOCAL PRO+ TIER — add the third membership tier ('premium_plus') and put
-- every business on it for the free launch.
--   free          → Free
--   premium       → Local Pro ($49)
--   premium_plus  → Local Pro+ ($129)
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Allow the new tier value
alter table public.vendors drop constraint if exists vendors_tier_check;
alter table public.vendors
  add constraint vendors_tier_check check (tier in ('free', 'premium', 'premium_plus'));

-- 2) Launch: set every business to Local Pro+ with all features on
update public.vendors
set tier = 'premium_plus',
    features = '{"messages":true,"analytics":true,"bookings":true,"crm":true,"estimates":true}'::jsonb;

-- 3) New claims also land on Local Pro+ (launch promo)
create or replace function approve_claim_request(p_request_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_req public.claim_requests;
  v_is_admin boolean;
begin
  select (is_admin = true) into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select * into v_req from public.claim_requests where id = p_request_id;
  if v_req.id is null then return jsonb_build_object('ok', false, 'error', 'Request not found'); end if;
  if v_req.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'Request already ' || v_req.status); end if;

  if exists (select 1 from public.vendors where id = v_req.vendor_id and is_claimed = true) then
    update public.claim_requests set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = 'Vendor already claimed' where id = p_request_id;
    return jsonb_build_object('ok', false, 'error', 'Vendor already claimed');
  end if;
  if exists (select 1 from public.vendors where user_id = v_req.user_id) then
    return jsonb_build_object('ok', false, 'error', 'Claimer already owns a vendor');
  end if;

  update public.vendors
    set user_id = v_req.user_id, is_claimed = true, claimed_at = now(),
        tier = 'premium_plus',
        features = '{"messages":true,"analytics":true,"bookings":true,"crm":true,"estimates":true}'::jsonb
    where id = v_req.vendor_id;
  update public.profiles set role = 'vendor' where id = v_req.user_id;
  update public.claim_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = p_request_id;
  update public.claim_requests set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
    review_note = 'Another request was approved'
    where vendor_id = v_req.vendor_id and status = 'pending' and id <> p_request_id;

  return jsonb_build_object('ok', true, 'vendor_id', v_req.vendor_id);
end; $$;

create or replace function claim_vendor(p_slug text, p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_vendor_id uuid; v_already_claimed boolean; v_claimer_has_vendor boolean;
begin
  select id, is_claimed into v_vendor_id, v_already_claimed from public.vendors where slug = p_slug limit 1;
  if v_vendor_id is null then return jsonb_build_object('ok', false, 'error', 'Vendor not found'); end if;
  if v_already_claimed then return jsonb_build_object('ok', false, 'error', 'Already claimed'); end if;
  select exists(select 1 from public.vendors where user_id = p_user_id) into v_claimer_has_vendor;
  if v_claimer_has_vendor then return jsonb_build_object('ok', false, 'error', 'You already have a vendor account'); end if;

  update public.vendors
    set user_id = p_user_id, is_claimed = true, claimed_at = now(),
        tier = 'premium_plus',
        features = '{"messages":true,"analytics":true,"bookings":true,"crm":true,"estimates":true}'::jsonb
    where id = v_vendor_id;
  update public.profiles set role = 'vendor' where id = p_user_id;
  return jsonb_build_object('ok', true, 'vendor_id', v_vendor_id);
end; $$;
