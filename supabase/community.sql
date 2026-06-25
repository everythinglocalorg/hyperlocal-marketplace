-- Community Board tables

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  city text not null,
  state text,
  city_slug text not null, -- e.g. "wells-township-mn"
  title text not null,
  body text not null,
  type text not null default 'general', -- 'help' | 'product' | 'service' | 'general'
  tagged_vendor_id uuid references public.vendors(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.community_responses (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  tagged_vendor_id uuid references public.vendors(id) on delete set null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists community_posts_city_slug_idx on public.community_posts(city_slug);
create index if not exists community_posts_created_idx on public.community_posts(created_at desc);
create index if not exists community_responses_post_idx on public.community_responses(post_id);

-- RLS
alter table public.community_posts enable row level security;
alter table public.community_responses enable row level security;

create policy "Anyone can view active posts" on public.community_posts
  for select using (is_active = true);

create policy "Authenticated users can post" on public.community_posts
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own posts" on public.community_posts
  for update using (auth.uid() = user_id);

create policy "Anyone can view responses" on public.community_responses
  for select using (true);

create policy "Authenticated users can respond" on public.community_responses
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own responses" on public.community_responses
  for update using (auth.uid() = user_id);
