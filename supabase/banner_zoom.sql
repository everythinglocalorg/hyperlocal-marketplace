-- Cover-photo zoom. Mirrors logo_zoom: a scale factor (1 = no zoom) applied to
-- the banner so vendors can zoom in to frame their cover instead of only
-- nudging it up/down. Rendered as `transform: scale(banner_zoom)` on the hero.
alter table public.vendors add column if not exists banner_zoom real not null default 1;
