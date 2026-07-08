-- ─────────────────────────────────────────────────────────────────────────────
-- BLOG — public, SEO-focused posts (news, marketplace tips, business highlights).
-- Public reads published posts; admins manage everything. Body is Markdown so
-- authors can add in-text links (backlinks that pass link equity to businesses).
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,                         -- short summary for cards + meta description fallback
  body text not null default '',        -- Markdown
  cover_image_url text,
  category text not null default 'news' -- 'news' | 'tips' | 'highlight' | 'guide' | 'other'
    check (category in ('news', 'tips', 'highlight', 'guide', 'other')),
  tags text[] not null default '{}',
  seo_description text,                  -- meta description override
  author_name text,
  author_title text,                    -- e.g. "Everything Local Team", "Founder"
  author_avatar_url text,
  author_profile_id uuid references public.profiles(id) on delete set null,
  featured_vendor_slug text,            -- optional business this post highlights
  is_published boolean not null default false,
  published_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists blog_posts_published_idx on public.blog_posts(is_published, published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts(category);
create index if not exists blog_posts_slug_idx on public.blog_posts(slug);

alter table public.blog_posts enable row level security;

-- Anyone can read published posts
drop policy if exists "Anyone can view published posts" on public.blog_posts;
create policy "Anyone can view published posts" on public.blog_posts
  for select using (is_published = true);

-- Admins can read everything (incl. drafts) and manage
drop policy if exists "Admins read all posts" on public.blog_posts;
create policy "Admins read all posts" on public.blog_posts
  for select using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admins insert posts" on public.blog_posts;
create policy "Admins insert posts" on public.blog_posts
  for insert with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admins update posts" on public.blog_posts;
create policy "Admins update posts" on public.blog_posts
  for update using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admins delete posts" on public.blog_posts;
create policy "Admins delete posts" on public.blog_posts
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Count a public view (safe to call from anyone; only bumps the counter)
create or replace function increment_blog_view(p_slug text)
returns void language sql security definer as $$
  update public.blog_posts set view_count = view_count + 1
  where slug = p_slug and is_published = true;
$$;
