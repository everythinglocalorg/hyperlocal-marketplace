-- Refer a friend (a registered user) to a business from its profile page.
-- Atomically: drops the friend into the vendor's CRM as a new lead, pings the
-- friend's notifications, and rewards the referrer with Local Bucks.
-- SECURITY DEFINER so the referrer (who doesn't own the vendor) can create the
-- CRM lead; the referrer is taken from auth.uid(), never trusted from a param.

create or replace function refer_to_vendor(p_vendor_id uuid, p_referred_user_id uuid)
returns text as $$
declare
  v_referrer uuid := auth.uid();
  v_referrer_name text;
  v_referred_name text;
  v_referred_email text;
  v_biz text;
  v_slug text;
  v_col uuid;
  v_link text;
begin
  if v_referrer is null then raise exception 'Not authenticated'; end if;
  if v_referrer = p_referred_user_id then raise exception 'You cannot refer yourself'; end if;

  select full_name into v_referrer_name from public.profiles where id = v_referrer;
  select full_name, email into v_referred_name, v_referred_email from public.profiles where id = p_referred_user_id;
  select business_name, slug into v_biz, v_slug from public.vendors where id = p_vendor_id and is_active = true;
  if v_biz is null then raise exception 'Business not found'; end if;

  v_link := '/vendors/' || v_slug;

  -- Already referred this person to this business? Don't duplicate or re-reward.
  if exists (
    select 1 from public.notifications
    where actor_id = v_referrer and user_id = p_referred_user_id and type = 'referral' and link = v_link
  ) then
    return 'already';
  end if;

  -- New Lead → the vendor's first pipeline column. Seed the default pipeline
  -- (matches CrmBoard's DEFAULT_COLUMNS) if they haven't opened their CRM yet,
  -- so the lead is always visible on the board.
  select id into v_col from public.crm_columns where vendor_id = p_vendor_id order by position limit 1;
  if v_col is null then
    insert into public.crm_columns (vendor_id, name, position) values
      (p_vendor_id, 'Cold Lead', 0), (p_vendor_id, 'Warm Lead', 1),
      (p_vendor_id, 'Estimate Requested', 2), (p_vendor_id, 'Booked', 3), (p_vendor_id, 'Rejected', 4);
    select id into v_col from public.crm_columns where vendor_id = p_vendor_id order by position limit 1;
  end if;

  insert into public.crm_contacts (vendor_id, column_id, name, email, source, notes)
  values (p_vendor_id, v_col, coalesce(nullif(v_referred_name, ''), 'Referred lead'),
          v_referred_email, 'referral', 'Referred by ' || coalesce(nullif(v_referrer_name, ''), 'a neighbor'));

  insert into public.notifications (user_id, actor_id, type, title, body, link)
  values (p_referred_user_id, v_referrer, 'referral',
          coalesce(nullif(v_referrer_name, ''), 'Someone') || ' thinks you''d love ' || v_biz,
          'Check out ' || v_biz || ' on Everything Local.', v_link);

  perform award_local_bucks(v_referrer, 10, 'refer_business', p_vendor_id, 'vendor');

  return 'ok';
end;
$$ language plpgsql security definer;
