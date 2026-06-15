export type UserRole = 'client' | 'provider' | 'admin'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  phone: string | null
  whatsapp_link: string | null
  created_at: string
}

export interface Provider {
  id: string
  bio: string | null
  coverage_lat: number | null
  coverage_lng: number | null
  coverage_radius_km: number
  price_range: string | null
  is_approved: boolean
  city: string
  created_at: string
}

export interface Category {
  id: number
  name: string
  icon: string
  is_active: boolean
}

export interface ProviderNear {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  price_range: string | null
  city: string
  coverage_lat: number
  coverage_lng: number
  coverage_radius_km: number
  whatsapp_link: string | null
  distance_km: number
  avg_rating: number | null
  review_count: number
  categories?: Category[]
}

export interface JobRequest {
  id: string
  client_id: string
  category_id: number
  description: string
  location_lat: number | null
  location_lng: number | null
  location_label: string | null
  preferred_date: string | null
  status: 'open' | 'assigned' | 'closed'
  created_at: string
  category?: Category
  client?: Profile
}

export interface Application {
  id: string
  job_id: string
  provider_id: string
  message: string | null
  created_at: string
  provider?: ProviderNear
  job?: JobRequest
}

export interface Review {
  id: string
  provider_id: string
  client_id: string
  rating: number
  comment: string | null
  created_at: string
  client?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}
