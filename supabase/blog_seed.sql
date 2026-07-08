-- ─────────────────────────────────────────────────────────────────────────────
-- BLOG SEED — two starter posts (author: The Locals). Safe to run after blog.sql.
-- Uses dollar-quoting so apostrophes need no escaping. Re-run-safe (on conflict).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.blog_posts
  (slug, title, excerpt, body, cover_image_url, category, tags, seo_description, author_name, author_title, is_published, published_at)
values
(
  'start-your-everything-local-storefront',
  $t$How to Start Your Everything Local Storefront (Step by Step)$t$,
  $e$Get your local business online and taking customers in minutes — no website, no developer, and free during launch.$e$,
  $md$Starting an online storefront used to mean hiring a developer, paying for hosting, and waiting weeks. Not anymore. With **Everything Local**, you can have a professional storefront that takes customers *today* — and right now it's [free during launch](/pricing).

Here's exactly how to get set up.

## 1. Create your free account

Head to the [business sign-up page](/signup?role=vendor) and choose "business." All you need is your name, email, and a password — no credit card required. Every new business starts with full **Local Pro+** access, free during launch.

## 2. Build your storefront

From your dashboard, add the essentials that build trust:

- Your **logo** and a **cover photo** (we'll even use your first product photo automatically)
- A short, honest **description** — write like you'd talk to a neighbor
- Your **service area** — the towns you cover, which also helps you show up in local search

## 3. Add your products or services

List what you offer with clear titles, real photos, and honest pricing. Every listing can have its own call-to-action — **Book Now**, **Call Now**, **Request a Free Estimate**, or **Buy Now** — so customers know exactly what to do next.

## 4. Turn on the ways customers reach you

Switch on **click-to-call and text**, the **estimate/lead form**, and **messaging** so a hot lead never goes cold. Everything lands in one inbox — no personal phone number required.

## 5. Get found locally

Your storefront is built for local search from day one. Add your service locations, collect a few reviews, and share your page and referral link with your network to get momentum.

---

That's it — you're open for business. Next, read our [10 Ways to Grow Your Local Business Online](/blog/10-ways-to-grow-your-local-business), and explore the free [Business Incubator](/incubator) for more guides and tools.

Ready? [Create your free storefront](/signup?role=vendor) and get discovered by neighbors who want to shop local.$md$,
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=60&auto=format&fit=crop',
  'guide',
  array['getting started','local business','storefront','online selling'],
  $s$A simple step-by-step guide to launching your local business online with Everything Local — free during launch, no website needed.$s$,
  'The Locals',
  'Everything Local Team',
  true, now()
),
(
  '10-ways-to-grow-your-local-business',
  $t$10 Ways to Grow Your Local Business Online$t$,
  $e$Practical, proven tactics to get more local customers — from reviews and referrals to speed-to-lead and showing up in your neighborhood.$e$,
  $md$Growing a local business online isn't about chasing the whole internet — it's about winning your town. Here are ten practical ways to get more local customers with Everything Local.

## 1. Complete your storefront

A finished profile — logo, cover photo, description, and service area — builds instant trust. Half-finished pages lose customers before they read a word. Start from your [dashboard](/dashboard/vendor).

## 2. Get reviews early and often

Reviews are the single biggest trust signal for local buyers. Ask every happy customer right after the job — it takes 30 seconds and pays off for months.

## 3. Respond in seconds, not hours

Most local customers buy from whoever answers first. Turn on **click-to-call, text, and messaging** so you never miss a lead.

## 4. Use your referral link

Word of mouth is your cheapest growth. Share your referral link on invoices, receipts, and social posts — you and your neighbor both earn [Local Bucks](/local-bucks).

## 5. Post on Local Pages

Neighbors literally post what they're looking for on your town's [Local Pages](/). Watch for requests you can fill and reply with a helpful answer, not a hard sell.

## 6. List clear offers and prices

Uncertainty kills conversions. Show a price or a clear "Free estimate" on every listing, and pick the right call-to-action so customers know exactly what to do.

## 7. Send fast, professional estimates

When a lead comes in, send an itemized estimate in a couple of taps. Looking professional and moving quickly wins jobs.

## 8. Keep your info current

Update your hours, phone, and service area whenever anything changes. Nothing loses a customer faster than wrong info.

## 9. Show up in local search

Add your service locations and keep your listings active — it's how nearby customers find you first instead of a big out-of-town chain.

## 10. Support the community back

Follow and shout out other local businesses, hire locally through [Local Jobs](/), and be a good neighbor. Local growth compounds when the whole community wins.

---

Want the full playbook? Explore the free [Business Incubator](/incubator), or if you're just getting started, read [How to Start Your Everything Local Storefront](/blog/start-your-everything-local-storefront).$md$,
  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&q=60&auto=format&fit=crop',
  'tips',
  array['marketing','local business','growth','tips'],
  $s$Ten practical, proven ways to grow your local business online — reviews, referrals, speed-to-lead, and showing up in local search.$s$,
  'The Locals',
  'Everything Local Team',
  true, now()
)
on conflict (slug) do nothing;
