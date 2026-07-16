export type UserRole = 'buyer' | 'vendor' | 'admin'
export type VendorTier = 'free' | 'premium'
export type ListingType = 'product' | 'service' | 'restaurant' | 'event' | 'rental' | 'thrift'
export type ListingCondition = 'new' | 'used'
export type PaymentMethod = 'stripe' | 'in_person' | 'venmo' | 'paypal' | 'cash'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  phone_verified: boolean
  role: UserRole
  local_bucks: number
  referral_code: string
  referred_by: string | null
  created_at: string
}

export interface Vendor {
  id: string
  user_id: string
  business_name: string
  slug: string
  description: string | null
  category: string
  city: string
  state: string
  zip_code: string
  address: string | null
  latitude: number | null
  longitude: number | null
  service_radius_miles: number
  phone: string | null
  website: string | null
  logo_url: string | null
  banner_url: string | null
  tier: VendorTier
  is_verified: boolean
  is_active: boolean
  rating: number
  review_count: number
  local_bucks_earned: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  created_at: string
}

export interface Listing {
  id: string
  vendor_id: string
  title: string
  description: string | null
  type: ListingType
  price: number | null
  price_label: string | null
  condition: ListingCondition | null
  quantity: number | null
  images: string[]
  category: string
  tags: string[]
  cta_type?: string | null
  is_active: boolean
  is_featured: boolean
  view_count: number
  click_count: number
  created_at: string
  vendor?: Vendor
}

export interface Review {
  id: string
  vendor_id: string
  reviewer_id: string
  rating: number
  comment: string | null
  images: string[]
  is_verified_purchase: boolean
  created_at: string
  reviewer?: Profile
}

export interface LocalBucksTransaction {
  id: string
  user_id: string
  amount: number
  type: 'earn' | 'spend'
  reason: string
  reference_id: string | null
  created_at: string
}

export interface City {
  name: string
  state: string
  slug: string
  latitude: number
  longitude: number
  is_active: boolean
}

// Launch cities — shown as quick-picks. Platform accepts any US location.
export const LAUNCH_CITIES: City[] = [
  { name: 'Eau Claire', state: 'WI', slug: 'eau-claire-wi', latitude: 44.8113, longitude: -91.4985, is_active: true },
  { name: 'Faribault', state: 'MN', slug: 'faribault-mn', latitude: 44.2955, longitude: -93.2688, is_active: true },
]

// Keep CITIES as alias for backwards compat
export const CITIES = LAUNCH_CITIES

export interface UserLocation {
  city: string
  state: string
  latitude: number
  longitude: number
  displayName: string
  source: 'gps' | 'search' | 'manual'
}

export const CATEGORIES = [
  'Products',
  'Thrift Sales',
  'Services & Trades',
  'Restaurants & Food',
  // Food trucks get their own category so they can be pulled onto the
  // /food-trucks/[city] board — they're businesses, not places.
  'Food Trucks',
  'Events & Rentals',
  'Health & Beauty',
  'Home & Garden',
  'Clothing & Accessories',
  'Arts & Crafts',
  'Sports & Outdoors',
  'Auto & Transportation',
  'Pet Services',
  'Childcare & Education',
  'Housing & Rentals',
] as const

export type Category = typeof CATEGORIES[number]

// ─── Places ──────────────────────────────────────────────────────────────────

export type PlaceType = 'park' | 'campground' | 'attraction' | 'thing_to_do' | 'food_truck'
export type PlaceFees = 'free' | 'day-use' | 'camping' | 'varies'

export interface Place {
  id: string
  slug: string
  name: string
  type: PlaceType
  subtype: string | null
  description: string | null
  address: string | null
  city: string
  state: string
  zip: string | null
  city_slug: string
  latitude: number | null
  longitude: number | null
  images: string[]
  tags: string[]
  amenities: string[]
  activities: string[]
  hours: Record<string, string> | null
  fees: PlaceFees
  fee_details: string | null
  website: string | null
  phone: string | null
  created_by: string
  is_claimed: boolean
  claimed_by: string | null
  claimed_at: string | null
  created_at: string
  updated_at: string
  is_active: boolean
  vendor_id: string | null
  stripe_subscription_id: string | null
  // from places_nearby RPC
  distance_miles?: number
}

// 'food_truck' is intentionally absent: food trucks are businesses now and live
// on their own board (/food-trucks/[city]), not in Explore. The PlaceType union
// keeps the value so pre-existing (now inactive) place rows still typecheck.
export const PLACE_TYPES: { value: PlaceType; label: string; paid?: boolean }[] = [
  { value: 'park',        label: 'Park' },
  { value: 'campground',  label: 'Campground' },
  { value: 'attraction',  label: 'Attraction',   paid: true },
  { value: 'thing_to_do', label: 'Thing to Do',  paid: true },
]

export const PAID_PLACE_TYPES: PlaceType[] = ['attraction', 'thing_to_do']

export const PLACE_AMENITIES = [
  'Restrooms', 'Parking', 'Trails', 'Water Access', 'Playground',
  'Pet-Friendly', 'ADA Accessible', 'Picnic Areas', 'Fishing',
  'Boat Launch', 'Campsites', 'RV Hookups', 'Showers', 'WiFi',
  // Food truck specific
  'Outdoor Seating', 'Card Accepted', 'Cash Only', 'Drive-Through',
] as const

export const PLACE_ACTIVITIES = [
  'Hiking', 'Swimming', 'Fishing', 'Camping', 'Biking',
  'Birdwatching', 'Kayaking / Canoeing', 'Rock Climbing',
  'Skiing / Snowshoeing', 'Disc Golf', 'Picnicking', 'Wildlife Viewing',
] as const
