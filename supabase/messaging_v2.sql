-- Messaging v2 — Phase 1: fix the broken unread badge + enable direct (no-listing)
-- conversations, plus the data foundation for delete / block / reactions / images.

-- 1) THE BUG FIX. No code path incremented the recipient's unread on a new
--    message (every conversation showed 0 unread → no red badge ever). This
--    trigger makes the DB the single source of truth: on every message it sets
--    the preview/timestamp and bumps the RECIPIENT's unread. Client code should
--    stop incrementing manually (it double-counted on the inbox path).
create or replace function public.bump_conversation_on_message()
returns trigger language plpgsql security definer as $$
declare v_buyer uuid;
begin
  select buyer_id into v_buyer from public.conversations where id = new.conversation_id;
  update public.conversations set
    last_message_at = now(),
    last_message_preview = left(new.body, 100),
    vendor_unread = vendor_unread + (case when new.sender_id = v_buyer then 1 else 0 end),
    buyer_unread  = buyer_unread  + (case when new.sender_id = v_buyer then 0 else 1 end)
  where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_bump_conversation on public.messages;
create trigger trg_bump_conversation after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

-- 2) Direct (no-listing) conversations. Messaging a business straight from its
--    storefront used to shove the vendor id into listing_id (a FK to listings) →
--    silent failure. Now those threads use listing_id NULL; one per buyer+vendor.
create unique index if not exists conversations_direct_unique
  on public.conversations (vendor_id, buyer_id) where listing_id is null;

-- 3) Soft-delete + image attachment on a message (UI wired in a later phase).
alter table public.messages
  add column if not exists deleted_at timestamptz,
  add column if not exists image_url text;

-- 4) Emoji reactions.
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);
alter table public.message_reactions enable row level security;
create policy "Participants manage reactions" on public.message_reactions for all
  using (
    exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (c.buyer_id = auth.uid()
             or exists (select 1 from public.vendors v where v.id = c.vendor_id and v.user_id = auth.uid()))
    )
  )
  with check (auth.uid() = user_id);

-- 5) Two-way blocks. Either side of a blocked pair can see the block (to hide
--    threads / disable send); only the blocker can create/remove it.
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;
create policy "Manage own blocks" on public.user_blocks for all
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
create policy "See blocks involving me" on public.user_blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);
