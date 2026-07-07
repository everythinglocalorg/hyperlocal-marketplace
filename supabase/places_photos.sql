-- Update seeded campsite/park photos with verified FREE Unsplash CDN URLs.
-- Each URL was confirmed to resolve to https://images.unsplash.com (not paywalled plus.unsplash.com).
-- Main photo is themed per place; 2 additional related nature shots follow.

update public.places set images = array[
  'https://images.unsplash.com/photo-1634852991526-ad631868fc4d?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1623681193221-261b6578180e?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550594427-417e0a74911f?w=1200&q=80&auto=format&fit=crop'
] where slug = 'nerstrand-big-woods-state-park-nerstrand-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1550594427-417e0a74911f?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1781974178084-8fcb79f43b0c?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1634852991526-ad631868fc4d?w=1200&q=80&auto=format&fit=crop'
] where slug = 'sakatah-lake-state-park-waterville-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1775223312915-df371212abde?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1634852991526-ad631868fc4d?w=1200&q=80&auto=format&fit=crop'
] where slug = 'camp-faribo-family-campground-faribault-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1778209031049-1674e77c4e8a?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1752268797205-27d473590e51?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1775223312915-df371212abde?w=1200&q=80&auto=format&fit=crop'
] where slug = 'cannon-river-wilderness-area-faribault-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1769012220918-38f486eb6505?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1781974178084-8fcb79f43b0c?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550594427-417e0a74911f?w=1200&q=80&auto=format&fit=crop'
] where slug = 'rice-lake-state-park-owatonna-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1534770406361-3bfa1129f8de?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1778209031049-1674e77c4e8a?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1634852991526-ad631868fc4d?w=1200&q=80&auto=format&fit=crop'
] where slug = 'minneopa-state-park-mankato-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1781974178084-8fcb79f43b0c?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550594427-417e0a74911f?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1775223312915-df371212abde?w=1200&q=80&auto=format&fit=crop'
] where slug = 'lake-byllesby-regional-park-randolph-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1775223312915-df371212abde?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1752268797205-27d473590e51?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=1200&q=80&auto=format&fit=crop'
] where slug = 'mccullough-park-and-campground-faribault-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1623681193221-261b6578180e?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1634852991526-ad631868fc4d?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1781974178084-8fcb79f43b0c?w=1200&q=80&auto=format&fit=crop'
] where slug = 'lebanon-hills-regional-park-eagan-mn';

update public.places set images = array[
  'https://images.unsplash.com/photo-1752268797205-27d473590e51?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1778209031049-1674e77c4e8a?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1623681193221-261b6578180e?w=1200&q=80&auto=format&fit=crop'
] where slug = 'afton-state-park-afton-mn';

-- Any other places still missing photos get lake-themed defaults.
update public.places set images = array[
  'https://images.unsplash.com/photo-1781974178084-8fcb79f43b0c?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550594427-417e0a74911f?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1775223312915-df371212abde?w=1200&q=80&auto=format&fit=crop'
] where images is null or array_length(images, 1) is null;
