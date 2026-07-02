-- Every vendor starts at 5 stars. The first real review replaces this via the
-- update_vendor_rating() trigger (schema.sql), which recomputes rating as the
-- true average of all reviews — so seeded 5s never blend into real averages.

-- New vendors default to 5
alter table public.vendors alter column rating set default 5;

-- Existing vendors with no reviews yet start at 5; reviewed vendors keep their real average
update public.vendors set rating = 5 where coalesce(review_count, 0) = 0;
