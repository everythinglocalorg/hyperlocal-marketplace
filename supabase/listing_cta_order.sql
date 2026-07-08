-- Allow the "order" listing CTA (Order Now button, e.g. Toast online ordering).
alter table public.listings drop constraint if exists listings_cta_type_check;
alter table public.listings add constraint listings_cta_type_check
  check (cta_type is null or cta_type = any (array['book','estimate','call','menu','buy','rent','order']));
