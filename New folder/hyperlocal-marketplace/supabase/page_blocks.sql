-- Photo/text blocks for vendor website-style pages
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS page_blocks jsonb DEFAULT '[]';
