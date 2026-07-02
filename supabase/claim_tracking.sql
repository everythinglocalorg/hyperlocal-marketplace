-- ─────────────────────────────────────────────────────────────────────────────
-- Claim tracking: record WHEN an unclaimed business was claimed, so admins can
-- see who converted and verify the right owner is taking over the store.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.vendors
  add column if not exists claimed_at timestamptz;

-- Re-create claim_vendor to stamp claimed_at on conversion (otherwise identical)
create or replace function claim_vendor(p_slug text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_vendor_id uuid;
  v_already_claimed boolean;
  v_claimer_has_vendor boolean;
begin
  select id, is_claimed into v_vendor_id, v_already_claimed
  from public.vendors where slug = p_slug limit 1;

  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'Vendor not found');
  end if;

  if v_already_claimed then
    return jsonb_build_object('ok', false, 'error', 'Already claimed');
  end if;

  select exists(select 1 from public.vendors where user_id = p_user_id)
  into v_claimer_has_vendor;

  if v_claimer_has_vendor then
    return jsonb_build_object('ok', false, 'error', 'You already have a vendor account');
  end if;

  update public.vendors
  set user_id = p_user_id, is_claimed = true, claimed_at = now()
  where id = v_vendor_id;

  update public.profiles set role = 'vendor' where id = p_user_id;

  return jsonb_build_object('ok', true, 'vendor_id', v_vendor_id);
end;
$$;
