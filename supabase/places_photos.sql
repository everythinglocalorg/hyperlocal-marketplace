-- Update seeded campsite/park photos with verified Unsplash IDs (3 per place)
-- Uses source.unsplash.com/{id}/1200x800 format

update public.places set images = array[
  'https://source.unsplash.com/zk5EG2H7rGU/1200x800',
  'https://source.unsplash.com/hzLZu7IxbE8/1200x800',
  'https://source.unsplash.com/mpQUdnoVvBk/1200x800'
] where slug = 'nerstrand-big-woods-state-park-nerstrand-mn';

update public.places set images = array[
  'https://source.unsplash.com/LuCWEh0nb5s/1200x800',
  'https://source.unsplash.com/bEAjYh825rQ/1200x800',
  'https://source.unsplash.com/D4HBCk2SkHc/1200x800'
] where slug = 'sakatah-lake-state-park-waterville-mn';

update public.places set images = array[
  'https://source.unsplash.com/kmB4sE2BWCs/1200x800',
  'https://source.unsplash.com/TcgASSD5G04/1200x800',
  'https://source.unsplash.com/rg-YHCIyays/1200x800'
] where slug = 'camp-faribo-family-campground-faribault-mn';

update public.places set images = array[
  'https://source.unsplash.com/u--CG3sqdoQ/1200x800',
  'https://source.unsplash.com/6-1ZFO-muzk/1200x800',
  'https://source.unsplash.com/WRFPBDkgSOY/1200x800'
] where slug = 'cannon-river-wilderness-area-faribault-mn';

update public.places set images = array[
  'https://source.unsplash.com/TdtJyfT5spA/1200x800',
  'https://source.unsplash.com/NbLXMfQJavQ/1200x800',
  'https://source.unsplash.com/8KPQ5TJOyeU/1200x800'
] where slug = 'rice-lake-state-park-owatonna-mn';

update public.places set images = array[
  'https://source.unsplash.com/kbeCxW-TCLM/1200x800',
  'https://source.unsplash.com/IMK9P9CzSQg/1200x800',
  'https://source.unsplash.com/qMmoK7g0YuI/1200x800'
] where slug = 'minneopa-state-park-mankato-mn';

update public.places set images = array[
  'https://source.unsplash.com/xPKBOURwgK0/1200x800',
  'https://source.unsplash.com/O9OCCrkgT3I/1200x800',
  'https://source.unsplash.com/bsFsxULt9fE/1200x800'
] where slug = 'lake-byllesby-regional-park-randolph-mn';

update public.places set images = array[
  'https://source.unsplash.com/sXa6lUF51cQ/1200x800',
  'https://source.unsplash.com/zC6tyeuZTlo/1200x800',
  'https://source.unsplash.com/EnbRvdWktwA/1200x800'
] where slug = 'mccullough-park-and-campground-faribault-mn';

update public.places set images = array[
  'https://source.unsplash.com/E7stL4MShZg/1200x800',
  'https://source.unsplash.com/RzFqGKMT_LY/1200x800',
  'https://source.unsplash.com/ODAKeAbL2tc/1200x800'
] where slug = 'lebanon-hills-regional-park-eagan-mn';

update public.places set images = array[
  'https://source.unsplash.com/kb4y6RcHYrE/1200x800',
  'https://source.unsplash.com/TVVKrBzslvw/1200x800',
  'https://source.unsplash.com/Bt9byMl0zwE/1200x800'
] where slug = 'afton-state-park-afton-mn';
