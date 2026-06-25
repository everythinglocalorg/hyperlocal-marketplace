-- Spam / duplicate flags table
CREATE TABLE IF NOT EXISTS public.spam_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'message_duplicate' | 'listing_duplicate'
  flagged_user_id uuid REFERENCES auth.users(id),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}',
  status text DEFAULT 'open', -- 'open' | 'dismissed' | 'warned'
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.spam_flags ENABLE ROW LEVEL SECURITY;

-- Only admins can read/update flags
CREATE POLICY "Admins read flags"
  ON public.spam_flags FOR SELECT
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

CREATE POLICY "Admins update flags"
  ON public.spam_flags FOR UPDATE
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- Service role can insert (used by API routes)
CREATE POLICY "Service role insert flags"
  ON public.spam_flags FOR INSERT
  WITH CHECK (true);

-- Function: check if a message body is a duplicate for this sender
-- Returns: 'cross_vendor' if same body sent to 2+ other conversations today
--          'same_convo'   if same body already sent in this conversation
--          'ok'           if clean
CREATE OR REPLACE FUNCTION check_message_duplicate(
  sender_id_in uuid,
  conversation_id_in uuid,
  body_in text
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cross_count integer;
  same_count  integer;
  normalized  text;
BEGIN
  normalized := lower(trim(body_in));

  -- Count how many OTHER conversations this sender sent this exact body to today
  SELECT COUNT(DISTINCT m.conversation_id) INTO cross_count
  FROM public.messages m
  WHERE m.sender_id = sender_id_in
    AND lower(trim(m.body)) = normalized
    AND m.conversation_id <> conversation_id_in
    AND m.created_at > now() - interval '24 hours';

  IF cross_count >= 1 THEN
    RETURN 'cross_vendor';
  END IF;

  -- Count how many times this exact body appears in this conversation from this sender
  SELECT COUNT(*) INTO same_count
  FROM public.messages m
  WHERE m.sender_id = sender_id_in
    AND m.conversation_id = conversation_id_in
    AND lower(trim(m.body)) = normalized;

  IF same_count >= 2 THEN
    RETURN 'same_convo';
  END IF;

  RETURN 'ok';
END;
$$;

-- Function: check if a listing title is a duplicate for this vendor
CREATE OR REPLACE FUNCTION check_listing_duplicate(
  vendor_id_in uuid,
  title_in text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  exists_count integer;
BEGIN
  SELECT COUNT(*) INTO exists_count
  FROM public.listings
  WHERE vendor_id = vendor_id_in
    AND lower(trim(title)) = lower(trim(title_in))
    AND is_active = true;

  RETURN exists_count > 0;
END;
$$;
