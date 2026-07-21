-- Fulfillment locations for Porch Pickup / Local Drop.
--
-- Both methods just reveal a vendor-set location + instructions to the buyer at
-- checkout — no buyer address, no messaging. Set once at the store level; an
-- individual listing can override (blank = inherit the store default).
--
--   pickup_info → shown when the buyer chooses Porch Pickup (where/how to pick up)
--   drop_info   → shown when the buyer chooses Local Drop (where to meet)
alter table public.vendors
  add column if not exists pickup_info text,
  add column if not exists drop_info text;

alter table public.listings
  add column if not exists pickup_info text,
  add column if not exists drop_info text;
