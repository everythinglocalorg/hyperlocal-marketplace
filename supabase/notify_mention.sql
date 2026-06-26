-- Security-definer function so any authenticated user can create a notification
-- for another user (e.g. tagging them in a community post).
-- Bypasses RLS on the notifications table — safe because we validate inputs here.

create or replace function public.create_notification(
  p_user_id  uuid,
  p_actor_id uuid,
  p_type     text,
  p_title    text,
  p_body     text,
  p_link     text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, actor_id, type, title, body, link)
  select p_user_id, p_actor_id, p_type, p_title, p_body, p_link
  where p_user_id is not null
    and p_actor_id is not null
    and p_user_id <> p_actor_id;
$$;

grant execute on function public.create_notification(uuid, uuid, text, text, text, text) to authenticated;
