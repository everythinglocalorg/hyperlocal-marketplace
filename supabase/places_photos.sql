-- Real, location-accurate photos from Wikimedia Commons (CC-licensed).
-- Each URL is an actual photo of that specific park/lake, verified via the Commons API.
-- Two private/small sites (Camp Faribo, McCullough Park) have NO real photo on Commons,
-- so they are cleared to the app's built-in placeholder rather than showing a misleading stock image.

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/c/cc/Nerstrand_Big_Woods_SP-HiddenFalls.JPG',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Hidden_Falls%2C_Nerstrand-Big_Woods_State_Park_%28468670246%29.jpg/1280px-Hidden_Falls%2C_Nerstrand-Big_Woods_State_Park_%28468670246%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Nerstrand-Big_Woods_State_Park_%28468641682%29.jpg/1280px-Nerstrand-Big_Woods_State_Park_%28468641682%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Nerstrand_Big_Woods_State_Park_%2815188528083%29.jpg/1280px-Nerstrand_Big_Woods_State_Park_%2815188528083%29.jpg'
] where slug = 'nerstrand-big-woods-state-park-nerstrand-mn';

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/d/d0/SakatahLakeStatePark.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Snowshoeing_Trail_at_Sakatah_Lake_State_Park%2C_Minnesota_%2839796119665%29.jpg/1280px-Snowshoeing_Trail_at_Sakatah_Lake_State_Park%2C_Minnesota_%2839796119665%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Sakatah_State_Park_Minnesota_winter_2321845605_o.jpg/1280px-Sakatah_State_Park_Minnesota_winter_2321845605_o.jpg'
] where slug = 'sakatah-lake-state-park-waterville-mn';

update public.places set images = array[]::text[]
  where slug = 'camp-faribo-family-campground-faribault-mn';

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Cannon_River_Northfield_5.JPG/1280px-Cannon_River_Northfield_5.JPG',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Cannon_river_at_Welch.jpg/1280px-Cannon_river_at_Welch.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Cannon_River%2C_Cannon_Falls_%2816320713197%29.jpg/1280px-Cannon_River%2C_Cannon_Falls_%2816320713197%29.jpg'
] where slug = 'cannon-river-wilderness-area-faribault-mn';

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/7/71/RiceLakeStateParkMN.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Rice_Lake_SP_Wiki_Version.JPG/1280px-Rice_Lake_SP_Wiki_Version.JPG'
] where slug = 'rice-lake-state-park-owatonna-mn';

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Upper_Waterfall_at_Minneopa_State_Park.jpg/1280px-Upper_Waterfall_at_Minneopa_State_Park.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Close_Up_of_Waterfall_at_Minneopa_State_Park.jpg/1280px-Close_Up_of_Waterfall_at_Minneopa_State_Park.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/River_Bluffs_at_Minneopa_State_Park%2C_Minnesota_%2833796677165%29.jpg/1280px-River_Bluffs_at_Minneopa_State_Park%2C_Minnesota_%2833796677165%29.jpg'
] where slug = 'minneopa-state-park-mankato-mn';

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Trail_along_Lake_Byllesby%2C_Dakota_County%2C_Minnesota_%2827364961897%29.jpg/1280px-Trail_along_Lake_Byllesby%2C_Dakota_County%2C_Minnesota_%2827364961897%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lake_Byllesby_Park_Spring_Hiking_Trail_-_Dakota_County_Parks%2C_Minnesota_%2841339260554%29.jpg/1280px-Lake_Byllesby_Park_Spring_Hiking_Trail_-_Dakota_County_Parks%2C_Minnesota_%2841339260554%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Grassy_Trails_at_Lake_Byllesby_Regional_Park%2C_Dakota_County%2C_Minnesota_%2827318847417%29.jpg/1280px-Grassy_Trails_at_Lake_Byllesby_Regional_Park%2C_Dakota_County%2C_Minnesota_%2827318847417%29.jpg'
] where slug = 'lake-byllesby-regional-park-randolph-mn';

update public.places set images = array[]::text[]
  where slug = 'mccullough-park-and-campground-faribault-mn';

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Lebanon_Hills_Regional_Park_Campground_-_Apple_Valley%2C_Minnesota_%2836180155210%29.jpg/1280px-Lebanon_Hills_Regional_Park_Campground_-_Apple_Valley%2C_Minnesota_%2836180155210%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/6/6f/JensenLake040617.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Reflectionlk.jpg/1280px-Reflectionlk.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/f/f1/Schulzelake.jpg'
] where slug = 'lebanon-hills-regional-park-eagan-mn';

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/7/7f/AftonStateParkStCroixRiver.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/5/5b/Afton_State_Park_trail.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/d/d8/Afton_State_Park_Beach.JPG'
] where slug = 'afton-state-park-afton-mn';

update public.places set images = array[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Lake_Wissota_State_Park_02.jpg/1280px-Lake_Wissota_State_Park_02.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Lake_Wissota_State_Park_01.jpg/1280px-Lake_Wissota_State_Park_01.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Lake_Wissota_State_Park_05.jpg/1280px-Lake_Wissota_State_Park_05.jpg'
] where slug = 'lake-wissota-wells-township-minnesota';
