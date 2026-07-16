# Local Experiences — curated itineraries by Local Guides

Status: **built (Phases 1–3).** New Explore category, built on the existing listings +
Explore + LeafletMap machinery.

## Concept
Paid businesses act as **Local Guides**: bundle real places, restaurants, and
things‑to‑do on Everything Local into a **curated itinerary** (e.g. _"A Perfect Foodie
Weekend in Eau Claire"_), organize it by day and time, and add insider tips.
Experiences surface under an **"Experiences"** filter in the **Explore** tab.

**Experiences are free — for everyone, in every direction.** Free for a Guide to
publish, and free for a visitor to read. Nothing is sold and nothing is charged.

## Why free (the business model)
The itinerary is not the product — it's **exposure**. A restaurant owner who builds a
crawl featuring his friends' businesses is doing free marketing for the platform and
free discovery for its members. The value to Everything Local is engagement and the
pull of local content into Explore; the money comes from **memberships**, since only
paid businesses can publish. That makes Experiences a **membership perk and a reason to
upgrade**, not a revenue line of their own.

This is a deliberate reversal of the original spec (which charged $50 to publish and let
Guides sell itineraries). That model was killed before launch: a $50 fee upfront, on a
marketplace with no buyers yet, was the surest way to end up with zero Experiences. See
_Rejected_ below.

## Who can create (hard rules)
- **Regular users cannot create Experiences.** Only **businesses on a paid tier**
  (`isPaidTier(vendor.tier)` — Local Pro / Local Pro+). This is the only gate.
- A user **becomes a "Local Guide" by creating a business page** (vendor onboarding) and
  being on a paid tier. The builder is gated: signed in → owns a vendor → vendor is
  paid. Otherwise it shows an upsell.
- **Publishing is free and unlimited.** No release fee, no recurring fee, no expiry.
- **Pause / re‑publish are free** and reversible. `first_published_at` is retained only
  as a "live since" record — it no longer prices anything.

## No purchase model
There is no Book Now, no price, no checkout, no Stripe. The public page's calls to
action are **♡ Save Experience** (the existing `FavoritesProvider` wishlist — an
Experience is a listing, so this works natively) and **Share**.

`listings.price` is left unused on `type='experience'` rows and nothing reads it.

## Model it like a product (max reuse of Explore)
An Experience **is a `listings` row with `type = 'experience'`** (owned by the vendor,
has `images`, `cta_type='book'`; wishlist‑able; shows in Explore) **plus** an itinerary:
- `experience_stops`: `id, listing_id, day int, position int, start_time time null,
  duration_min null, title, notes, ref_type ('vendor'|'listing'|'place'|'custom'),
  ref_id uuid null, custom_address, custom_lat, custom_lng`. Public read; owner manages.
  Fill `custom_lat`/`custom_lng` on **every** stop, including `place`/`vendor` refs —
  the route map builds its markers from those columns.
- `experience_meta`: `is_published bool`, `first_published_at`, `theme[]`,
  `duration_label`, `best_for`, `est_cost_cents`.

`is_published` and `listings.is_active` are flipped together and both mean live.

## Local Guide builder (`/dashboard/experiences`)
1. Create draft: title, cover photo, summary, duration, "best for," themes.
2. Add stops via a picker over the site's own `vendors` / `listings` / `places`, plus a
   custom stop (title + address → geocode via the `/api/vendors/geocode` pattern).
3. Organize into Day 1 / Day 2…, reorder within a day, optional start time + duration,
   a tip per stop.
4. **Publish** — free, instant, no checkout. **Pause** takes it off Explore.

## Public Experience (`/experiences/[id]`)
Hero (cover, title, "🗺️ Local Experience") → meta row ("Curated by {business}",
duration, stop count, **Free**) → theme chips + "best for" → **route map** via
`LeafletMap` with **numbered pins in order** → **day‑by‑day timeline** of numbered stop
cards (time, tip, link through to the real vendor/listing/place) → sticky **Share** +
**♡ Save Experience**.

## Explore integration (`/explore/[city]`)
Published Experiences load in the server page and are scoped by **distance from the
vendor's coordinates** (haversine in the page — deliberately *not* a second RPC), with a
city/state fallback for un‑geocoded Guides. They render as a **"Local Experiences" rail**
on the All tab and as a grid behind their own **Experiences** filter pill. Both are
hidden when the city has none.

## Reuse (don't rebuild)
Listings + Explore, `LeafletMap` (`numbered` prop), listing‑image upload, `CitySelector`,
`isPaidTier` gating, `FavoritesProvider`, `/api/vendors/geocode`.

## Rejected (and why — don't re‑litigate without new information)
- **$50 first publish / $10 re‑publish.** Cold‑start poison. Charging for supply on a
  marketplace with no demand yet is backwards; free is what gets the first ten Guides.
- **Guides selling itineraries.** A list of five local places isn't worth $35 — it's
  freely Googleable and trivially screenshotted, so the secrecy was never defensible.
- **Paywalling the stop locations.** Kills the SEO/discovery value that makes the page
  worth having (a tourist searching "things to do in Eau Claire with kids" is the whole
  point) and protects information that leaks the moment one buyer shares it.

## Parked (live ideas, not scheduled)
- **Reseller / commission model.** The version of paid Experiences that *could* work:
  the Guide negotiates real discounted access with partner businesses and earns a margin
  on a bundle. Sells *access*, not information — so the route can stay fully public.
  Blocked on partner supply, redemption (QR at the door), and settlement — an ops
  problem, not a code problem.
- Seasonal variants of a proven route, a "Local Guides" directory, reviews
  (`target_type:'experience'`), printable/PDF guide, "clone & customize".
