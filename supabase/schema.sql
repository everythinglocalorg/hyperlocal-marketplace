-- ============================================================
-- HyperLocal Marketplace — Full Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis"; -- for geo/radius search

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  phone_verified boolean default false,
  role text not null default 'buyer' check (role in ('buyer', 'vendor', 'admin')),
  local_bucks integer not null default 0,
  referral_code text unique not null,
  referred_by uuid references public.profiles(id),
  birthday date,
  last_login_at timestamptz,
  login_streak integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view any profile" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- ============================================================
-- VENDORS
-- ============================================================
create table public.vendors (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  business_name text not null,
  slug text unique not null,
  description text,
  category text not null,
  city text not null,
  state text not null,
  zip_code text not null,
  address text,
  latitude double precision,
  longitude double precision,
  location geography(point, 4326), -- PostGIS point for radius search
  service_radius_miles integer default 25,
  phone text,
  website text,
  logo_url text,
  banner_url text,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  is_verified boolean default false,
  is_active boolean default true,
  rating numeric(3,2) default 0,
  review_count integer default 0,
  local_bucks_earned integer default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.vendors enable row level security;

create policy "Anyone can view active vendors" on public.vendors
  for select using (is_active = true);

create policy "Vendors can update own profile" on public.vendors
  for update using (auth.uid() = user_id);

create policy "Vendors can insert own profile" on public.vendors
  for insert with check (auth.uid() = user_id);

-- Index for geo search
create index vendors_location_idx on public.vendors using gist(location);
create index vendors_city_idx on public.vendors(city, state);
create index vendors_category_idx on public.vendors(category);
create index vendors_tier_idx on public.vendors(tier);

-- ============================================================
-- LISTINGS
-- ============================================================
create table public.listings (
  id uuid default uuid_generate_v4() primary key,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  title text not null,
  description text,
  type text not null check (type in ('product', 'service', 'restaurant', 'event')),
  price numeric(10,2),
  price_label text, -- e.g. "Starting at $50" or "Free estimate"
  condition text check (condition in ('new', 'used')),
  quantity integer,
  images text[] default '{}',
  category text not null,
  tags text[] default '{}',
  is_active boolean default true,
  is_featured boolean default false,
  view_count integer default 0,
  click_count integer default 0,
  -- Event/rental specific
  event_start_at timestamptz,
  event_end_at timestamptz,
  event_capacity integer,
  event_location text,
  -- Service specific
  service_area_zips text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.listings enable row level security;

create policy "Anyone can view active listings" on public.listings
  for select using (is_active = true);

create policy "Vendors can manage own listings" on public.listings
  for all using (
    auth.uid() = (select user_id from public.vendors where id = vendor_id)
  );

create index listings_vendor_idx on public.listings(vendor_id);
create index listings_type_idx on public.listings(type);
create index listings_category_idx on public.listings(category);
create index listings_featured_idx on public.listings(is_featured) where is_featured = true;

-- ============================================================
-- REVIEWS
-- ============================================================
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  listing_id uuid references public.listings(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  images text[] default '{}',
  is_verified_purchase boolean default false,
  created_at timestamptz default now(),
  unique(vendor_id, reviewer_id) -- one review per vendor per user
);

alter table public.reviews enable row level security;

create policy "Anyone can view reviews" on public.reviews
  for select using (true);

create policy "Verified buyers can insert reviews" on public.reviews
  for insert with check (auth.uid() = reviewer_id);

create policy "Reviewers can update own reviews" on public.reviews
  for update using (auth.uid() = reviewer_id);

create index reviews_vendor_idx on public.reviews(vendor_id);

-- Update vendor rating when review is inserted/updated
create or replace function update_vendor_rating()
returns trigger as $$
begin
  update public.vendors
  set
    rating = (select avg(rating) from public.reviews where vendor_id = new.vendor_id),
    review_count = (select count(*) from public.reviews where vendor_id = new.vendor_id)
  where id = new.vendor_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_review_change
  after insert or update on public.reviews
  for each row execute function update_vendor_rating();

-- ============================================================
-- LOCAL BUCKS TRANSACTIONS
-- ============================================================
create table public.local_bucks_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null, -- positive = earn, negative = spend
  type text not null check (type in ('earn', 'spend')),
  reason text not null,
  reference_id uuid, -- links to review, listing, referral, etc.
  reference_type text, -- 'review', 'listing', 'referral', 'booking', etc.
  created_at timestamptz default now()
);

alter table public.local_bucks_transactions enable row level security;

create policy "Users can view own transactions" on public.local_bucks_transactions
  for select using (auth.uid() = user_id);

create index lbt_user_idx on public.local_bucks_transactions(user_id);
create index lbt_created_idx on public.local_bucks_transactions(created_at desc);

-- Function to award Local Bucks and update balance atomically
create or replace function award_local_bucks(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id uuid default null,
  p_reference_type text default null
)
returns void as $$
begin
  insert into public.local_bucks_transactions(user_id, amount, type, reason, reference_id, reference_type)
  values (p_user_id, p_amount, 'earn', p_reason, p_reference_id, p_reference_type);

  update public.profiles
  set local_bucks = local_bucks + p_amount
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- Function to spend Local Bucks
create or replace function spend_local_bucks(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id uuid default null,
  p_reference_type text default null
)
returns boolean as $$
declare
  current_balance integer;
begin
  select local_bucks into current_balance from public.profiles where id = p_user_id;

  if current_balance < p_amount then
    return false;
  end if;

  insert into public.local_bucks_transactions(user_id, amount, type, reason, reference_id, reference_type)
  values (p_user_id, -p_amount, 'spend', p_reason, p_reference_id, p_reference_type);

  update public.profiles
  set local_bucks = local_bucks - p_amount
  where id = p_user_id;

  return true;
end;
$$ language plpgsql security definer;

-- ============================================================
-- REFERRALS
-- ============================================================
create table public.referrals (
  id uuid default uuid_generate_v4() primary key,
  referrer_id uuid references public.profiles(id) not null,
  referred_id uuid references public.profiles(id) not null,
  referral_code text not null,
  converted boolean default false, -- true when referred user makes first purchase
  bucks_awarded boolean default false,
  created_at timestamptz default now(),
  converted_at timestamptz,
  unique(referred_id) -- each user can only be referred once
);

alter table public.referrals enable row level security;

create policy "Users can view own referrals" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_id);

create index referrals_referrer_idx on public.referrals(referrer_id);

-- ============================================================
-- BOOKINGS
-- ============================================================
create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references public.listings(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  notes text,
  scheduled_at timestamptz,
  amount numeric(10,2),
  payment_method text check (payment_method in ('stripe', 'in_person', 'venmo', 'paypal', 'cash')),
  payment_status text default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  stripe_payment_intent_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bookings enable row level security;

create policy "Buyers can view own bookings" on public.bookings
  for select using (auth.uid() = buyer_id);

create policy "Vendors can view their bookings" on public.bookings
  for select using (
    auth.uid() = (select user_id from public.vendors where id = vendor_id)
  );

create policy "Buyers can create bookings" on public.bookings
  for insert with check (auth.uid() = buyer_id);

create policy "Vendors can update booking status" on public.bookings
  for update using (
    auth.uid() = (select user_id from public.vendors where id = vendor_id)
  );

create index bookings_buyer_idx on public.bookings(buyer_id);
create index bookings_vendor_idx on public.bookings(vendor_id);

-- ============================================================
-- MESSAGES
-- ============================================================
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Users can view own messages" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);

create policy "Recipients can mark as read" on public.messages
  for update using (auth.uid() = recipient_id);

create index messages_sender_idx on public.messages(sender_id);
create index messages_recipient_idx on public.messages(recipient_id);
create index messages_vendor_idx on public.messages(vendor_id);

-- ============================================================
-- AD BOOSTS (Local Bucks spending)
-- ============================================================
create table public.boosts (
  id uuid default uuid_generate_v4() primary key,
  booster_id uuid references public.profiles(id) not null, -- who spent the LB
  vendor_id uuid references public.vendors(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  type text not null check (type in ('vendor_profile', 'listing', 'event', 'category_sponsor', 'spotlight')),
  bucks_spent integer not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.boosts enable row level security;

create policy "Anyone can view active boosts" on public.boosts
  for select using (is_active = true and ends_at > now());

create policy "Users can create boosts" on public.boosts
  for insert with check (auth.uid() = booster_id);

create index boosts_vendor_idx on public.boosts(vendor_id) where is_active = true;
create index boosts_ends_at_idx on public.boosts(ends_at);

-- ============================================================
-- BADGES & ACHIEVEMENTS
-- ============================================================
create table public.user_badges (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  badge_key text not null,
  earned_at timestamptz default now(),
  unique(user_id, badge_key)
);

alter table public.user_badges enable row level security;

create policy "Anyone can view badges" on public.user_badges
  for select using (true);

create index user_badges_user_idx on public.user_badges(user_id);

-- ============================================================
-- LEADERBOARD VIEW (weekly Local Bucks earned)
-- ============================================================
create or replace view public.leaderboard_weekly as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.role,
  v.business_name,
  coalesce(sum(t.amount), 0) as bucks_this_week
from public.profiles p
left join public.vendors v on v.user_id = p.id
left join public.local_bucks_transactions t
  on t.user_id = p.id
  and t.type = 'earn'
  and t.created_at >= date_trunc('week', now())
group by p.id, p.full_name, p.avatar_url, p.role, v.business_name
order by bucks_this_week desc;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_referral_code text;
begin
  -- Generate unique referral code
  loop
    new_referral_code := upper(substring(md5(random()::text) from 1 for 6));
    exit when not exists (select 1 from public.profiles where referral_code = new_referral_code);
  end loop;

  insert into public.profiles (id, email, full_name, avatar_url, referral_code)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new_referral_code
  );

  -- Award signup bonus
  perform award_local_bucks(new.id, 10, 'signup_bonus');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- GEO SEARCH FUNCTION
-- Find vendors within X miles of a lat/lng point
-- ============================================================
create or replace function search_vendors_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_miles integer default 25,
  p_category text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  business_name text,
  slug text,
  description text,
  category text,
  city text,
  state text,
  logo_url text,
  banner_url text,
  tier text,
  is_verified boolean,
  rating numeric,
  review_count integer,
  local_bucks_earned integer,
  distance_miles double precision
) as $$
begin
  return query
  select
    v.id,
    v.business_name,
    v.slug,
    v.description,
    v.category,
    v.city,
    v.state,
    v.logo_url,
    v.banner_url,
    v.tier,
    v.is_verified,
    v.rating,
    v.review_count,
    v.local_bucks_earned,
    st_distance(
      v.location,
      st_point(p_longitude, p_latitude)::geography
    ) / 1609.34 as distance_miles
  from public.vendors v
  where
    v.is_active = true
    and st_dwithin(
      v.location,
      st_point(p_longitude, p_latitude)::geography,
      p_radius_miles * 1609.34
    )
    and (p_category is null or v.category = p_category)
  order by distance_miles asc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;
