# Local Experiences — curated itineraries by Local Guides

Status: **spec / not built.** New Explore category. A "Book Now" product built on the
existing listings + booking + Stripe-Connect machinery.

## Concept
Paid businesses act as **Local Guides**: bundle real places, restaurants, and
things‑to‑do on Everything Local into a **curated itinerary** (a "package" — e.g.
_"A Perfect Foodie Weekend in Eau Claire"_), organize it by day and time, add insider
tips, and **sell it at their own price**. Experiences behave **like products** and
surface under a new **"Experiences"** category in the **Explore** tab. The purchase
model is **Book Now** — a buyer books the experience for a date; the Guide confirms.

## Who can create (hard rules)
- **Regular users cannot create Experiences.** Only **businesses on a paid tier**
  (`isPaidTier(vendor.tier)` — Local Pro / Local Pro+).
- A user **becomes a "Local Guide" by creating a business page** (vendor onboarding)
  and being on a paid tier. Gate the builder behind: signed in → owns a vendor →
  vendor is paid. Otherwise show an upsell ("Become a Local Guide — create your
  business page / upgrade").
- **Releasing (publishing) each new Experience costs a one‑time $50 platform fee.**
  Drafting/editing is free; going live requires the $50 payment.

## Purchase model — "Book Now"
- The Experience listing uses **`cta_type = "book"` → "Book Now"** (see `src/lib/cta.ts`).
- Buying = **booking flow**: buyer picks a **date** (optionally party size + notes),
  the Guide confirms. Reuse the existing booking system
  (`RentalBookingModal`, `kind` prop — add/`"experience"` or reuse `"service"`;
  day‑blocking + availability so a Guide can cap capacity/day).
- Payment routes to the **Guide's Stripe Connect** (destination charge; deposit or
  full, like rentals/proposals). No Connect yet → fall back to the `purchase_inquiries`
  request flow the cart uses.

## Two separate money flows
1. **Release fee to the PLATFORM.** Reuse the Jobs/Boosts Stripe pattern: on release,
   a Stripe Checkout (platform account) → `checkout.session.completed` webhook flips
   `is_published = true`.
   - **First publish = $50.** Once live it **stays live indefinitely** (no recurring/
     expiry fee).
   - The Guide can **Pause** an Experience anytime (takes it off the market) — **free**.
   - **Re‑publishing from paused = $10 each time** (another Checkout → webhook).
   - Track: `first_published_at` (set once) so the fee is $50 only on the very first
     release and $10 on every re‑publish thereafter. Editing while live does not
     re‑charge.
2. **Booking price — set by the GUIDE, paid to the GUIDE** via their Stripe Connect.

## Model it like a product (max reuse of Explore)
An Experience **is a `listings` row with `type = 'experience'`** (owned by the vendor,
has `price`, `images`, `cta_type='book'`; shows in Explore/search + the product grid
automatically) **plus** an itinerary:
- `experience_stops`: `id, listing_id, day int, position int, start_time time null,
  duration_min null, title, notes, ref_type ('vendor'|'listing'|'place'|'custom'),
  ref_id uuid null, custom_address, custom_lat, custom_lng`. RLS: public read for stops
  of published experiences; owner manages.
- Release/meta state on the listing (or `experience_meta`): `release_paid bool`,
  `is_published bool`, `theme[]`, `duration_label`, `best_for`, `est_cost_cents`.
- Being a listing, it's already a product card in Explore/search, Wishlist‑able, and
  can flow through booking — you mainly add the itinerary layer + the paid‑tier + $50
  gates + Book‑Now wiring.

## Local Guide builder (dashboard "Experiences" tab)
1. Create draft: title, city (`CitySelector`), theme tags, cover photo (listing‑image
   upload), summary, duration, "best for," **booking price**, `cta_type='book'`.
2. Add stops via a **picker** searching the site's own `vendors` / `listings` /
   `places`, plus a **custom stop** (title + address → geocode via the
   `/api/vendors/geocode` Nominatim pattern).
3. Organize into **Day 1 / Day 2…**, reorder within a day, optional start time +
   duration, a tip/note per stop.
4. **Publish → $50 Stripe Checkout → webhook publishes it.**

## Public Experience (product‑style; detail = rich guide)
- Product card in **Explore** (new "Experiences" filter) + global search, CTA **Book Now**.
- Detail: hero (cover, title, theme chips, "Curated by {business}" + follow, price,
  est. cost/duration, rating) → **day‑by‑day timeline** of numbered stop cards (photo,
  time, tip, link to the real vendor/listing/place) → **route map** via `LeafletMap`
  with **numbered pins in order** → **Book Now** (date pick → Guide's Connect / inquiry
  fallback) + **♥ Save** (`FavoritesProvider`) + **Reviews** (`target_type:'experience'`).

## Reuse (don't rebuild)
Listings/product cards + Explore/search, the **booking system** (`RentalBookingModal`,
day‑blocking/availability), `LeafletMap`, listing‑image upload, `CitySelector`, Stripe
Connect + the Jobs/Boosts webhook pattern, `isPaidTier`/tier gating, `FavoritesProvider`,
`award_local_bucks`, `/api/vendors/geocode`.

## Phases
1. **MVP:** `type='experience'` listings + `experience_stops` + RLS; builder gated to
   paid vendors (draft, add real/custom stops, days/reorder); the $50 publish→webhook→
   go‑live flow; detail page with timeline + numbered map; Explore "Experiences"
   category; **Book Now** via the existing booking flow.
2. **Sell direct:** Guide's Stripe Connect for the booking payment (deposit/full),
   Wishlist, reviews.
3. **Polish:** theme filters, "Local Guides" directory, share links, printable/PDF
   guide, "clone & customize," Local Bucks rewards for publishing/first booking.

## Resolved
- **Eligibility = ANY paid membership** (Local Pro **or** Local Pro+) can create and
  sell Experiences — gate on `isPaidTier(vendor.tier)`, not `isPlusTier`.
- **Lifecycle & fees:** first publish **$50**; stays live as long as the Guide wants;
  **Pause is free**; each **re‑publish from paused = $10**. Editing while live is free.

## Open decisions
- Deposit vs full payment at booking time.
