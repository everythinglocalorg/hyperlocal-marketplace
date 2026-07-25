-- Messaging v2 — Phase 2: delete + block enforcement.

-- Let a sender soft-delete their OWN message (sets deleted_at, clears body).
-- Recipients still see the row (RLS select) but the UI renders "message deleted".
drop policy if exists "Sender can update own messages" on public.messages;
create policy "Sender can update own messages" on public.messages
  for update using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

-- Block enforcement at the DB layer: a message can only be inserted when neither
-- party has blocked the other. (The /api/messages/send route checks this too, but
-- this makes it airtight regardless of client.) The "other party" is the vendor's
-- OWNER when the sender is the buyer, else the buyer.
create or replace function public.assert_not_blocked()
returns trigger language plpgsql security definer as $$
declare v_buyer uuid; v_owner uuid; v_other uuid;
begin
  select c.buyer_id, v.user_id into v_buyer, v_owner
  from public.conversations c
  join public.vendors v on v.id = c.vendor_id
  where c.id = new.conversation_id;

  v_other := case when new.sender_id = v_buyer then v_owner else v_buyer end;
  if v_other is not null and exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = new.sender_id and b.blocked_id = v_other)
       or (b.blocker_id = v_other and b.blocked_id = new.sender_id)
  ) then
    raise exception 'blocked';
  end if;
  return new;
end $$;

drop trigger if exists trg_assert_not_blocked on public.messages;
create trigger trg_assert_not_blocked before insert on public.messages
  for each row execute function public.assert_not_blocked();
