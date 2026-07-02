-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIM VERIFICATION — up-front owner check.
-- Claiming an unclaimed business now creates a PENDING request instead of an
-- instant takeover. An admin verifies the owner and approves/rejects it.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- Requires: profiles.is_admin (boolean), vendors.is_claimed, vendors.claimed_at
--           (claimed_at comes from claim_tracking.sql / RUN_THESE.sql).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  full_name text,
  contact_email text,
  contact_phone text,
  message text,                                   -- how the claimer proves they own it
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz default now(),
  unique (vendor_id, user_id)                      -- one request per user per vendor
);

create index if not exists claim_requests_vendor_idx on public.claim_requests(vendor_id);
create index if not exists claim_requests_status_idx on public.claim_requests(status, created_at desc);

alter table public.claim_requests enable row level security;

-- A logged-in user may create a request for themselves
drop policy if exists "Users create own claim requests" on public.claim_requests;
create policy "Users create own claim requests" on public.claim_requests
  for insert with check (auth.uid() = user_id);

-- Requesters see their own; admins see all
drop policy if exists "View own or admin claim requests" on public.claim_requests;
create policy "View own or admin claim requests" on public.claim_requests
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Admins may update (approve/reject)
drop policy if exists "Admins update claim requests" on public.claim_requests;
create policy "Admins update claim requests" on public.claim_requests
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ── Approve: admin-only. Links the vendor to the requesting user. ────────────
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
  if v_req.id is null then
    return jsonb_build_object('ok', false, 'error', 'Request not found');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Request already ' || v_req.status);
  end if;

  if exists (select 1 from public.vendors where id = v_req.vendor_id and is_claimed = true) then
    update public.claim_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = 'Vendor already claimed'
      where id = p_request_id;
    return jsonb_build_object('ok', false, 'error', 'Vendor already claimed');
  end if;

  if exists (select 1 from public.vendors where user_id = v_req.user_id) then
    return jsonb_build_object('ok', false, 'error', 'Claimer already owns a vendor');
  end if;

  update public.vendors
    set user_id = v_req.user_id, is_claimed = true, claimed_at = now()
    where id = v_req.vendor_id;
  update public.profiles set role = 'vendor' where id = v_req.user_id;

  update public.claim_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;

  -- auto-reject other pending requests for the same vendor
  update public.claim_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = 'Another request was approved'
    where vendor_id = v_req.vendor_id and status = 'pending' and id <> p_request_id;

  return jsonb_build_object('ok', true, 'vendor_id', v_req.vendor_id);
end; $$;

-- ── Reject: admin-only. ──────────────────────────────────────────────────────
create or replace function reject_claim_request(p_request_id uuid, p_note text default null)
returns jsonb language plpgsql security definer as $$
declare v_is_admin boolean;
begin
  select (is_admin = true) into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;
  update public.claim_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = coalesce(p_note, review_note)
    where id = p_request_id and status = 'pending';
  return jsonb_build_object('ok', true);
end; $$;
