-- Local Score & Products Sold tracking
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS local_score integer DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS products_sold integer DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS last_score_login date;

-- Atomic increment function (avoids race conditions)
CREATE OR REPLACE FUNCTION increment_local_score(vendor_id_in uuid, pts_in integer)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.vendors
  SET local_score = COALESCE(local_score, 0) + pts_in
  WHERE id = vendor_id_in;
$$;

-- Also used for products_sold increment
CREATE OR REPLACE FUNCTION increment_products_sold(vendor_id_in uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.vendors
  SET products_sold = COALESCE(products_sold, 0) + 1,
      local_score = COALESCE(local_score, 0) + 2
  WHERE id = vendor_id_in;
$$;
