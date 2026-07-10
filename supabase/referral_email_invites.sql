-- Off-platform referrals: invite a neighbor by email to a business. Mirrors
-- refer_to_vendor (on-platform @-tag) but the invitee isn't a registered user —
-- we drop them into the vendor's CRM, log the invite, and reward the referrer.
-- The actual email is sent by /api/referral-invite after this succeeds.

create table if not exists public.referral_email_invites (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id   uuid not null references public.vendors(id) on delete cascade,
  name        text,
  email       text not null,
  rewarded    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_referral_email_invites_referrer on public.referral_email_invites(referrer_id, created_at);
create index if not exists idx_referral_email_invites_dedupe on public.referral_email_invites(referrer_id, vendor_id, email);

alter table public.referral_email_invites enable row level security;
drop policy if exists "own referral invites" on public.referral_email_invites;
create policy "own referral invites" on public.referral_email_invites
  for select using (auth.uid() = referrer_id);

create or replace function refer_to_vendor_email(p_vendor_id uuid, p_name text, p_email text)
returns text as $$
declare
  v_referrer uuid := auth.uid();
  v_referrer_name text;
  v_biz text;
  v_col uuid;
  v_sends_24h integer;
  v_rewards_24h integer;
  v_rewarded boolean := false;
  v_email text := lower(trim(p_email));
begin
  if v_referrer is null then raise exception 'Not authenticated'; end if;
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required';
  end if;

  select full_name into v_referrer_name from public.profiles where id = v_referrer;
  select business_name into v_biz from public.vendors where id = p_vendor_id and is_active = true;
  if v_biz is null then raise exception 'Business not found'; end if;

  -- Already invited this email to this business? Don't duplicate or re-reward.
  if exists (
    select 1 from public.referral_email_invites
    where referrer_id = v_referrer and vendor_id = p_vendor_id and email = v_email
  ) then
    return 'already';
  end if;

  -- Hard send cap: 15 referrals (tag + email combined) per rolling 24h.
  select
    (select count(*) from public.notifications
       where actor_id = v_referrer and type = 'referral' and created_at > now() - interval '24 hours')
    + (select count(*) from public.referral_email_invites
       where referrer_id = v_referrer and created_at > now() - interval '24 hours')
  into v_sends_24h;

  if v_sends_24h >= 15 then
    if not exists (
      select 1 from public.spam_flags
      where flagged_user_id = v_referrer and type = 'referral_rate_limit'
        and status = 'open' and created_at > now() - interval '24 hours'
    ) then
      insert into public.spam_flags (type, flagged_user_id, vendor_id, details)
      values ('referral_rate_limit', v_referrer, p_vendor_id,
              jsonb_build_object('sends_24h', v_sends_24h, 'channel', 'email', 'email', v_email));
    end if;
    raise exception 'Daily referral limit reached. Try again tomorrow.';
  end if;

  -- Reward cap: only the first 5 rewarded referrals (tag + email) per 24h pay out.
  select count(*) into v_rewards_24h
  from public.local_bucks_transactions
  where user_id = v_referrer and reason in ('refer_business', 'refer_business_email')
    and created_at > now() - interval '24 hours';
  v_rewarded := v_rewards_24h < 5;

  -- New Lead → the vendor's first pipeline column (seed the default pipeline if
  -- they haven't opened their CRM yet). Matches refer_to_vendor / CrmBoard.
  select id into v_col from public.crm_columns where vendor_id = p_vendor_id order by position limit 1;
  if v_col is null then
    insert into public.crm_columns (vendor_id, name, position) values
      (p_vendor_id, 'Cold Lead', 0), (p_vendor_id, 'Warm Lead', 1),
      (p_vendor_id, 'Estimate Requested', 2), (p_vendor_id, 'Booked', 3), (p_vendor_id, 'Rejected', 4);
    select id into v_col from public.crm_columns where vendor_id = p_vendor_id order by position limit 1;
  end if;

  insert into public.crm_contacts (vendor_id, column_id, name, email, source, notes)
  values (p_vendor_id, v_col, coalesce(nullif(p_name, ''), 'Referred lead'), v_email, 'referral',
          'Referred by ' || coalesce(nullif(v_referrer_name, ''), 'a neighbor') || ' (email invite)');

  insert into public.referral_email_invites (referrer_id, vendor_id, name, email, rewarded)
  values (v_referrer, p_vendor_id, nullif(p_name, ''), v_email, v_rewarded);

  if v_rewarded then
    perform award_local_bucks(v_referrer, 5, 'refer_business_email', p_vendor_id, 'vendor');
    return 'ok';
  end if;

  return 'sent_unrewarded';
end;
$$ language plpgsql security definer;
