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

create policy "Users can delete own posts" on public.community_posts
  for delete using (auth.uid() = user_id);

create policy "Admins can delete any post" on public.community_posts
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Users can delete own responses" on public.community_responses
  for delete using (auth.uid() = user_id);

create policy "Admins can delete any response" on public.community_responses
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- High Fives
create table if not exists public.community_post_highfives (
  post_id uuid references public.community_posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

alter table public.community_post_highfives enable row level security;

create policy "Anyone can view highfives" on public.community_post_highfives
  for select using (true);

create policy "Authenticated users can highfive" on public.community_post_highfives
  for insert with check (auth.uid() = user_id);

create policy "Users can remove their own highfive" on public.community_post_highfives
  for delete using (auth.uid() = user_id);

-- Flags
create table if not exists public.community_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.community_posts(id) on delete cascade,
  response_id uuid references public.community_responses(id) on delete cascade,
  reason text,
  created_at timestamptz default now()
);

alter table public.community_flags enable row level security;

create policy "Users can submit flags" on public.community_flags
  for insert with check (auth.uid() = user_id);

create policy "Admins can view all flags" on public.community_flags
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
