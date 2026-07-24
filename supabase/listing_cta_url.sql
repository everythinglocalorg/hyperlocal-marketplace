-- External link for the "Apply Now" listing CTA (and any future link-based CTA).
-- A stopgap until internal application forms exist: the owner pastes a link
-- (Google Form, their own site, etc.) and "Apply Now" opens it in a new tab.
alter table public.listings
  add column if not exists cta_url text;
