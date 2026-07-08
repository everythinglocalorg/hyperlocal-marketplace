// Attribution for seeded place photos sourced from Wikimedia Commons.
// Keyed by the exact image URL stored on the place. User-uploaded photos have
// no entry (none needed — the uploader owns them).

export type PhotoCredit = { author: string; license: string };

export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  // Nerstrand Big Woods State Park
  'https://upload.wikimedia.org/wikipedia/commons/c/cc/Nerstrand_Big_Woods_SP-HiddenFalls.JPG': { author: 'McGhiever', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Hidden_Falls%2C_Nerstrand-Big_Woods_State_Park_%28468670246%29.jpg/1280px-Hidden_Falls%2C_Nerstrand-Big_Woods_State_Park_%28468670246%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Nerstrand-Big_Woods_State_Park_%28468641682%29.jpg/1280px-Nerstrand-Big_Woods_State_Park_%28468641682%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Nerstrand_Big_Woods_State_Park_%2815188528083%29.jpg/1280px-Nerstrand_Big_Woods_State_Park_%2815188528083%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },

  // Sakatah Lake State Park
  'https://upload.wikimedia.org/wikipedia/commons/d/d0/SakatahLakeStatePark.jpg': { author: 'McGhiever', license: 'Public domain' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Snowshoeing_Trail_at_Sakatah_Lake_State_Park%2C_Minnesota_%2839796119665%29.jpg/1280px-Snowshoeing_Trail_at_Sakatah_Lake_State_Park%2C_Minnesota_%2839796119665%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Sakatah_State_Park_Minnesota_winter_2321845605_o.jpg/1280px-Sakatah_State_Park_Minnesota_winter_2321845605_o.jpg': { author: 'Tony Webster', license: 'CC BY-SA 3.0' },

  // Cannon River
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Cannon_River_Northfield_5.JPG/1280px-Cannon_River_Northfield_5.JPG': { author: 'AlexiusHoratius', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Cannon_river_at_Welch.jpg/1280px-Cannon_river_at_Welch.jpg': { author: 'Iulus Ascanius', license: 'Public domain' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Cannon_River%2C_Cannon_Falls_%2816320713197%29.jpg/1280px-Cannon_River%2C_Cannon_Falls_%2816320713197%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },

  // Rice Lake State Park
  'https://upload.wikimedia.org/wikipedia/commons/7/71/RiceLakeStateParkMN.jpg': { author: 'McGhiever', license: 'CC BY-SA 2.5' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Rice_Lake_SP_Wiki_Version.JPG/1280px-Rice_Lake_SP_Wiki_Version.JPG': { author: 'Firry Floyd', license: 'CC BY-SA 3.0' },

  // Minneopa State Park
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Upper_Waterfall_at_Minneopa_State_Park.jpg/1280px-Upper_Waterfall_at_Minneopa_State_Park.jpg': { author: 'Mathieu Landretti', license: 'CC BY-SA 4.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Close_Up_of_Waterfall_at_Minneopa_State_Park.jpg/1280px-Close_Up_of_Waterfall_at_Minneopa_State_Park.jpg': { author: 'Mathieu Landretti', license: 'CC BY-SA 4.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/River_Bluffs_at_Minneopa_State_Park%2C_Minnesota_%2833796677165%29.jpg/1280px-River_Bluffs_at_Minneopa_State_Park%2C_Minnesota_%2833796677165%29.jpg': { author: 'Tony Webster', license: 'CC BY-SA 2.0' },

  // Lake Byllesby Regional Park
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Trail_along_Lake_Byllesby%2C_Dakota_County%2C_Minnesota_%2827364961897%29.jpg/1280px-Trail_along_Lake_Byllesby%2C_Dakota_County%2C_Minnesota_%2827364961897%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lake_Byllesby_Park_Spring_Hiking_Trail_-_Dakota_County_Parks%2C_Minnesota_%2841339260554%29.jpg/1280px-Lake_Byllesby_Park_Spring_Hiking_Trail_-_Dakota_County_Parks%2C_Minnesota_%2841339260554%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Grassy_Trails_at_Lake_Byllesby_Regional_Park%2C_Dakota_County%2C_Minnesota_%2827318847417%29.jpg/1280px-Grassy_Trails_at_Lake_Byllesby_Regional_Park%2C_Dakota_County%2C_Minnesota_%2827318847417%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },

  // Lebanon Hills Regional Park
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Lebanon_Hills_Regional_Park_Campground_-_Apple_Valley%2C_Minnesota_%2836180155210%29.jpg/1280px-Lebanon_Hills_Regional_Park_Campground_-_Apple_Valley%2C_Minnesota_%2836180155210%29.jpg': { author: 'Tony Webster', license: 'CC BY-SA 2.0' },
  'https://upload.wikimedia.org/wikipedia/commons/6/6f/JensenLake040617.jpg': { author: 'Pete Nelson', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Reflectionlk.jpg/1280px-Reflectionlk.jpg': { author: 'William Wesen', license: 'Public domain' },
  'https://upload.wikimedia.org/wikipedia/commons/f/f1/Schulzelake.jpg': { author: 'William Wesen', license: 'Public domain' },

  // Afton State Park
  'https://upload.wikimedia.org/wikipedia/commons/7/7f/AftonStateParkStCroixRiver.jpg': { author: 'McGhiever', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/5/5b/Afton_State_Park_trail.jpg': { author: 'Greg Seitz', license: 'CC BY-SA 2.5' },
  'https://upload.wikimedia.org/wikipedia/commons/d/d8/Afton_State_Park_Beach.JPG': { author: 'McGhiever', license: 'CC BY-SA 3.0' },

  // Lake Wissota State Park
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Lake_Wissota_State_Park_02.jpg/1280px-Lake_Wissota_State_Park_02.jpg': { author: 'TheFugeni', license: 'CC BY-SA 4.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Lake_Wissota_State_Park_01.jpg/1280px-Lake_Wissota_State_Park_01.jpg': { author: 'TheFugeni', license: 'CC BY-SA 4.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Lake_Wissota_State_Park_05.jpg/1280px-Lake_Wissota_State_Park_05.jpg': { author: 'TheFugeni', license: 'CC BY-SA 4.0' },

  // ── Eau Claire, WI ──
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/CarsonParkBaseballStadium2009.JPG/1280px-CarsonParkBaseballStadium2009.JPG': { author: '1986q', license: 'Public domain' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Carson_Park_Exterior_Eau_Claire_Wisconsin.jpg/1280px-Carson_Park_Exterior_Eau_Claire_Wisconsin.jpg': { author: 'Royalbroil', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Carson_Park_summer_football.JPG/1280px-Carson_Park_summer_football.JPG': { author: 'Libertyernie2', license: 'CC BY-SA 4.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Phoenix_Park_Trail_Bridge_-_Chippewa_River_State_Trail%2C_Eau_Claire%2C_Wisconsin_%2841062369002%29.jpg/1280px-Phoenix_Park_Trail_Bridge_-_Chippewa_River_State_Trail%2C_Eau_Claire%2C_Wisconsin_%2841062369002%29.jpg': { author: 'Tony Webster', license: 'CC BY 2.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Phoenix_Park_-_pedestrian_bridge_Eau_Claire%2C_Wisconsin.jpg/1280px-Phoenix_Park_-_pedestrian_bridge_Eau_Claire%2C_Wisconsin.jpg': { author: 'TessTalks', license: 'CC BY-SA 4.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Peony_and_Labyrinth_in_Phoenix_Park._Eau_Claire%2C_WIsconsin.jpg/1280px-Peony_and_Labyrinth_in_Phoenix_Park._Eau_Claire%2C_WIsconsin.jpg': { author: 'TessTalks', license: 'CC BY-SA 4.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/SargeBoydBandshellInOwenPark%2C_Eau_Claire.jpg/1280px-SargeBoydBandshellInOwenPark%2C_Eau_Claire.jpg': { author: 'Villwock', license: 'Public domain' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Sarge_Boyd_Bandshell_in_Owen_Park.jpg/1280px-Sarge_Boyd_Bandshell_in_Owen_Park.jpg': { author: 'Villwock', license: 'Public domain' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/5Aug2010-EauClaireMunicipalBandbyVernBarber_at_Bandshell_in_Owen_Park%2C_Eau_Claire.jpg/1280px-5Aug2010-EauClaireMunicipalBandbyVernBarber_at_Bandshell_in_Owen_Park%2C_Eau_Claire.jpg': { author: 'Villwock', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Eau_Claire_-_Chippewa_River_looking_south_east.jpg/1280px-Eau_Claire_-_Chippewa_River_looking_south_east.jpg': { author: 'Autoshade (Wikimedia Commons)', license: 'Public domain' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Chippewa_River_Eau_Claire_Wisconsin.jpg/1280px-Chippewa_River_Eau_Claire_Wisconsin.jpg': { author: 'Tim Kiser', license: 'CC BY-SA 3.0 US' },
  'https://upload.wikimedia.org/wikipedia/commons/2/2a/Big_Falls_County_Park_Eau_Caire_WI_A.jpg': { author: 'Unknown', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Big_Falls_County_Park_Eau_Caire_WI_B.jpg/1280px-Big_Falls_County_Park_Eau_Caire_WI_B.jpg': { author: 'Unknown', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Eau_Claire_River_Wisconsin_A.jpg/1280px-Eau_Claire_River_Wisconsin_A.jpg': { author: 'Unknown', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Lake_Altoona_Resovoir_from_Road.jpg/1280px-Lake_Altoona_Resovoir_from_Road.jpg': { author: 'Bonnachoven', license: 'CC0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Lake_Altoona_Resevoir_another_view.jpg/1280px-Lake_Altoona_Resevoir_another_view.jpg': { author: 'Bonnachoven', license: 'CC0' },
  'https://upload.wikimedia.org/wikipedia/commons/2/25/Chippewa_Valley_Museum%2C_WI_Ojibwe_carrying_child_in_tiginaagan_or_traditional_cradleboard.jpg': { author: 'Unknown', license: 'Public domain' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/The_Pablo_Center_-_Eau_Claire%2C_Wisconsin.jpg/1280px-The_Pablo_Center_-_Eau_Claire%2C_Wisconsin.jpg': { author: 'TessTalks', license: 'CC BY-SA 4.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/CSS_vs._UWEC_at_Hobbs_%281%29.jpg/1280px-CSS_vs._UWEC_at_Hobbs_%281%29.jpg': { author: 'Libertyernie2', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/CSS_vs._UWEC_at_Hobbs_%282%29.jpg/1280px-CSS_vs._UWEC_at_Hobbs_%282%29.jpg': { author: 'Libertyernie2', license: 'CC BY-SA 3.0' },
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/CSS_vs._UWEC_at_Hobbs_%283%29.jpg/1280px-CSS_vs._UWEC_at_Hobbs_%283%29.jpg': { author: 'Libertyernie2', license: 'CC BY-SA 3.0' },
};

export function creditFor(url: string | undefined | null): PhotoCredit | null {
  if (!url) return null;
  return PHOTO_CREDITS[url] ?? null;
}
