# CercaYa — Design Spec
_Date: 2026-06-15_

## Concept

CercaYa is an on-demand local services marketplace. Clients find nearby providers for home and outdoor services (lawn mowing, tree trimming, garden cleaning, plumbing, electrical, etc.) and can either hire directly from a provider catalog or post an open job request.

**Initial market:** Ramallo, Buenos Aires (~35k inhabitants)  
**Design principle:** Architecture supports multiple service categories and multiple cities from day one, even if launched with garden/outdoor services only.

---

## Business Model (MVP)

- Free for all users (clients and providers)
- No in-app payments — clients and providers settle directly (cash, bank transfer, Mercadopago)
- Monetization deferred to after validation (future: provider subscriptions or job commissions)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 14 (App Router) |
| Database + Auth + Storage | Supabase |
| Hosting | Vercel |
| Styling | Tailwind CSS |
| Maps | Mapbox GL JS (or Leaflet) |

Single codebase, responsive web app. No native mobile app for MVP.

---

## User Types

### Client
- Discover and browse nearby providers by category
- View provider profiles (photo, name, description, services offered, coverage zone, estimated price range, reviews)
- Contact a provider directly via WhatsApp link
- Post an open job request specifying service type, location, and preferred date
- Leave a review after a completed job

### Provider
- Create a public profile with: name, photo, description, services offered, coverage zone (polygon or radius), estimated price range
- Browse open job requests in their area
- Apply to job requests
- Receive direct contact from clients

### Admin
- Approve new provider registrations
- View all users
- Deactivate accounts flagged for abuse

---

## Core Flows

### Flow 1: Client finds a provider
1. Client lands on home → selects service category
2. Sees list/map of providers in their zone
3. Taps provider → views profile
4. Taps "Contactar" → opens WhatsApp with pre-filled message
5. After the job: client can leave a review

### Flow 2: Client posts a job request
1. Client creates account / logs in
2. Fills out job request form: service type, description, preferred date, location
3. Request is published and visible to providers in range
4. Providers apply → client receives email notification
5. Client reviews applicants and contacts chosen provider via WhatsApp

### Flow 3: Provider onboarding
1. Provider registers → fills profile
2. Admin receives notification → approves or rejects
3. Provider appears in catalog after approval

---

## Database Schema

```sql
-- Users (Supabase Auth handles identity)
profiles (
  id uuid PK,
  full_name text,
  avatar_url text,
  role text CHECK (role IN ('client', 'provider', 'admin')),
  phone text,
  whatsapp_link text,
  created_at timestamptz
)

-- Provider profiles
providers (
  id uuid PK references profiles(id),
  bio text,
  coverage_lat float,
  coverage_lng float,
  coverage_radius_km float,
  price_range text,           -- e.g. "$1.500 - $3.000"
  is_approved boolean DEFAULT false,
  city text DEFAULT 'Ramallo',
  created_at timestamptz
)

-- Service categories
categories (
  id serial PK,
  name text,                  -- "Corte de pasto", "Plomería", etc.
  icon text,
  is_active boolean
)

-- Services a provider offers
provider_services (
  provider_id uuid references providers(id),
  category_id int references categories(id),
  PRIMARY KEY (provider_id, category_id)
)

-- Open job requests
job_requests (
  id uuid PK,
  client_id uuid references profiles(id),
  category_id int references categories(id),
  description text,
  location_lat float,
  location_lng float,
  location_label text,
  preferred_date date,
  status text CHECK (status IN ('open', 'assigned', 'closed')),
  created_at timestamptz
)

-- Provider applications to job requests
applications (
  id uuid PK,
  job_id uuid references job_requests(id),
  provider_id uuid references providers(id),
  message text,
  created_at timestamptz
)

-- Reviews (client → provider)
reviews (
  id uuid PK,
  provider_id uuid references providers(id),
  client_id uuid references profiles(id),
  rating int CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz
)
```

---

## Pages / Routes

| Route | Description |
|---|---|
| `/` | Home — category picker + hero |
| `/providers?category=X&city=Y` | Provider catalog with map + list |
| `/providers/[id]` | Provider profile detail |
| `/request/new` | Post a job request form |
| `/requests` | Browse open requests (for providers) |
| `/dashboard` | Client: my requests + reviews given |
| `/dashboard/provider` | Provider: my profile + applications + reviews |
| `/admin` | Admin panel: pending approvals, user list |
| `/auth/login` | Login / Register |

---

## Key Design Decisions

1. **No real-time needed for MVP** — Supabase polling + email notifications are enough. No WebSockets.
2. **WhatsApp as contact channel** — eliminates need for in-app messaging. Providers set their WhatsApp number; clients tap to open a pre-filled chat.
3. **Geography** — providers set a coverage radius (km). Clients see providers within range of their location. Simple distance calculation, no complex polygon routing.
4. **Multi-city ready** — `city` field on providers and requests; home page defaults to Ramallo but can expand.
5. **Provider approval gate** — manual admin approval before appearing in catalog, to ensure quality and trust in a small-town context where reputation matters.

---

## Out of Scope (MVP)

- In-app payments
- In-app chat/messaging
- Push notifications (email only)
- Mobile native app
- Provider analytics dashboard
- Scheduling / calendar integration
- Multi-language

---

## Success Criteria (MVP)

- A client in Ramallo can find a nearby lawn mower and contact them in under 2 minutes
- A provider can create a profile and start receiving requests within 24h of registration
- At least 5 providers onboarded and 10 job requests posted in first month
