-- Local fulfillment at checkout: Porch Pickup and Local Drop.
--
-- A vendor flips these on per product listing. When either is on, the buyer gets
-- a fulfillment choice at checkout and the final button becomes "Order Now"
-- (there's no live Stripe on this flow yet — it submits an order request the
-- store confirms). The chosen method is recorded on the order request.
alter table public.listings
  add column if not exists porch_pickup boolean not null default false,
  add column if not exists local_drop boolean not null default false;

-- 'porch_pickup' | 'local_drop' (null where it doesn't apply / older rows)
alter table public.purchase_inquiries
  add column if not exists fulfillment text;
