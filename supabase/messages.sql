-- One conversation per buyer+vendor+listing combo
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  listing_title text,
  last_message_at timestamptz default now(),
  last_message_preview text,
  vendor_unread int not null default 0,
  buyer_unread int not null default 0,
  created_at timestamptz default now(),
  unique(listing_id, buyer_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists conversations_vendor_idx on public.conversations(vendor_id, last_message_at desc);
create index if not exists conversations_buyer_idx on public.conversations(buyer_id, last_message_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Conversations: visible to buyer or vendor
create policy "Participants can view conversations" on public.conversations
  for select using (
    auth.uid() = buyer_id or
    exists (select 1 from public.vendors where id = vendor_id and user_id = auth.uid())
  );

create policy "Buyers can create conversations" on public.conversations
  for insert with check (auth.uid() = buyer_id);

create policy "Participants can update conversations" on public.conversations
  for update using (
    auth.uid() = buyer_id or
    exists (select 1 from public.vendors where id = vendor_id and user_id = auth.uid())
  );

-- Messages: visible to participants
create policy "Participants can view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.buyer_id = auth.uid() or
           exists (select 1 from public.vendors where id = c.vendor_id and user_id = auth.uid()))
    )
  );

create policy "Participants can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.buyer_id = auth.uid() or
           exists (select 1 from public.vendors where id = c.vendor_id and user_id = auth.uid()))
    )
  );
