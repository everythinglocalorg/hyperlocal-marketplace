-- Active-listing caps by tier: Free = 5, Local Pro = 15, Local Pro+ = unlimited.
-- Enforced server-side so it can't be bypassed. Only blocks NEW activations
-- (inserts of an active listing, or reactivating one) — existing over-cap
-- listings are grandfathered and stay active.

create or replace function enforce_listing_cap() returns trigger as $$
declare
  v_tier  text;
  v_cap   int;
  v_count int;
begin
  -- Nothing to check unless the row will end up active.
  if not coalesce(NEW.is_active, false) then
    return NEW;
  end if;

  -- On UPDATE, a row that was already active consumes no new slot.
  if TG_OP = 'UPDATE' and coalesce(OLD.is_active, false) then
    return NEW;
  end if;

  select tier into v_tier from public.vendors where id = NEW.vendor_id;

  v_cap := case v_tier
    when 'free'    then 5
    when 'premium' then 15
    else null            -- premium_plus (or anything unknown) => unlimited
  end;

  if v_cap is null then
    return NEW;
  end if;

  select count(*) into v_count
  from public.listings
  where vendor_id = NEW.vendor_id
    and is_active = true
    and (TG_OP = 'INSERT' or id <> NEW.id);

  if v_count >= v_cap then
    raise exception 'Your % plan allows % active listings. Deactivate one or upgrade to add more.',
      case v_tier when 'free' then 'Free' when 'premium' then 'Local Pro' else coalesce(v_tier, 'current') end,
      v_cap
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_listing_cap on public.listings;
create trigger trg_enforce_listing_cap
  before insert or update of is_active on public.listings
  for each row execute function enforce_listing_cap();
