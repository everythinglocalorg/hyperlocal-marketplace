-- Local Experiences — Book Now payments (Phase 3).
-- An Experience booking is a purchase_inquiries row. When the Experience has a
-- price and the Guide can take cards, the buyer pays IN FULL up front (no
-- deposits — see docs/local-experiences.md) straight to the Guide's Stripe
-- Connect account. These columns record that payment on the booking.
alter table public.purchase_inquiries
  add column if not exists amount_paid numeric,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_intent text;

-- Buyers need to read back their own booking row after checkout.
drop policy if exists "Buyers can view their inquiries" on public.purchase_inquiries;
create policy "Buyers can view their inquiries" on public.purchase_inquiries
  for select using (auth.uid() = buyer_id);
