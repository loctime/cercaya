# CercaYa MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive web marketplace where clients in Ramallo can find and contact local service providers (garden, plumbing, electrical, etc.) or post open job requests.

**Architecture:** Next.js 14 App Router + Supabase (auth, DB, storage) + Tailwind CSS. No in-app payments — WhatsApp handles client-provider contact. Provider approval is manual via admin panel.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase, react-leaflet, Vercel

---

## File Map

```
cercaya/
├── app/
│   ├── globals.css
│   ├── layout.tsx               # Root layout with Navbar
│   ├── page.tsx                 # Home: hero + category picker
│   ├── auth/
│   │   ├── login/page.tsx       # Sign in / Sign up
│   │   └── callback/route.ts   # OAuth callback handler
│   ├── providers/
│   │   ├── page.tsx             # Provider catalog (list + map)
│   │   └── [id]/page.tsx        # Provider profile detail
│   ├── request/new/page.tsx     # Post a job request (clients)
│   ├── requests/page.tsx        # Browse open requests (providers)
│   ├── dashboard/
│   │   ├── page.tsx             # Client dashboard
│   │   └── provider/page.tsx   # Provider dashboard
│   └── admin/page.tsx           # Admin panel
├── components/
│   ├── Navbar.tsx
│   ├── CategoryPicker.tsx
│   ├── ProviderCard.tsx
│   ├── ProviderMapClient.tsx    # Leaflet map (client-only, dynamic import)
│   ├── WhatsAppButton.tsx
│   ├── StarRating.tsx
│   └── forms/
│       ├── AuthForm.tsx
│       ├── JobRequestForm.tsx
│       ├── ProviderProfileForm.tsx
│       └── ReviewForm.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client
│   ├── types.ts                 # All TypeScript types
│   └── utils.ts                 # haversineDistance, buildWhatsAppUrl, etc.
├── middleware.ts                 # Session refresh
├── supabase/
│   ├── migrations/001_schema.sql
│   └── seed.sql
└── __tests__/
    └── utils.test.ts
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `cercaya/` (project root)
- Create: `.env.local`
- Create: `.env.local.example`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd "C:\Users\User\Desktop\Proyectos"
npx create-next-app@latest cercaya --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
cd cercaya
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr leaflet @types/leaflet react-leaflet
```

- [ ] **Step 3: Create .env.local.example**

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 4: Create .env.local** with real credentials from Supabase dashboard (Settings → API)

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: bootstrap Next.js 14 + Supabase + Tailwind"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/001_schema.sql`:

```sql
create extension if not exists "uuid-ossp";

create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  role text not null check (role in ('client', 'provider', 'admin')),
  phone text,
  whatsapp_link text,
  created_at timestamptz default now()
);

create table providers (
  id uuid references profiles(id) on delete cascade primary key,
  bio text,
  coverage_lat float,
  coverage_lng float,
  coverage_radius_km float default 10,
  price_range text,
  is_approved boolean default false,
  city text default 'Ramallo',
  created_at timestamptz default now()
);

create table categories (
  id serial primary key,
  name text not null,
  icon text not null,
  is_active boolean default true
);

create table provider_services (
  provider_id uuid references providers(id) on delete cascade,
  category_id int references categories(id) on delete cascade,
  primary key (provider_id, category_id)
);

create table job_requests (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references profiles(id) on delete cascade,
  category_id int references categories(id),
  description text not null,
  location_lat float,
  location_lng float,
  location_label text,
  preferred_date date,
  status text default 'open' check (status in ('open', 'assigned', 'closed')),
  created_at timestamptz default now()
);

create table applications (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references job_requests(id) on delete cascade,
  provider_id uuid references providers(id) on delete cascade,
  message text,
  created_at timestamptz default now(),
  unique(job_id, provider_id)
);

create table reviews (
  id uuid default uuid_generate_v4() primary key,
  provider_id uuid references providers(id) on delete cascade,
  client_id uuid references profiles(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(provider_id, client_id)
);

-- Haversine distance function for provider search
create or replace function providers_near(
  lat float,
  lng float,
  radius_km float default 50,
  cat_id int default null
)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  price_range text,
  city text,
  coverage_lat float,
  coverage_lng float,
  coverage_radius_km float,
  whatsapp_link text,
  distance_km float,
  avg_rating numeric,
  review_count bigint
)
language sql stable
as $$
  select
    p.id,
    pr.full_name,
    pr.avatar_url,
    p.bio,
    p.price_range,
    p.city,
    p.coverage_lat,
    p.coverage_lng,
    p.coverage_radius_km,
    pr.whatsapp_link,
    round((6371 * acos(
      least(1.0, cos(radians(lat)) * cos(radians(p.coverage_lat)) *
      cos(radians(p.coverage_lng) - radians(lng)) +
      sin(radians(lat)) * sin(radians(p.coverage_lat)))
    ))::numeric, 1) as distance_km,
    round(avg(r.rating)::numeric, 1) as avg_rating,
    count(r.id) as review_count
  from providers p
  join profiles pr on pr.id = p.id
  left join reviews r on r.provider_id = p.id
  left join provider_services ps on ps.provider_id = p.id
  where p.is_approved = true
    and p.coverage_lat is not null
    and (cat_id is null or ps.category_id = cat_id)
  group by p.id, pr.full_name, pr.avatar_url, p.bio, p.price_range,
           p.city, p.coverage_lat, p.coverage_lng, p.coverage_radius_km, pr.whatsapp_link
  having (6371 * acos(
    least(1.0, cos(radians(lat)) * cos(radians(p.coverage_lat)) *
    cos(radians(p.coverage_lng) - radians(lng)) +
    sin(radians(lat)) * sin(radians(p.coverage_lat)))
  )) <= least(p.coverage_radius_km, radius_km)
  order by distance_km asc
$$;

-- RLS
alter table profiles enable row level security;
alter table providers enable row level security;
alter table categories enable row level security;
alter table provider_services enable row level security;
alter table job_requests enable row level security;
alter table applications enable row level security;
alter table reviews enable row level security;

create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "providers_select" on providers for select using (is_approved = true or auth.uid() = id);
create policy "providers_insert_own" on providers for insert with check (auth.uid() = id);
create policy "providers_update_own" on providers for update using (auth.uid() = id);

create policy "categories_public" on categories for select using (is_active = true);

create policy "provider_services_select" on provider_services for select using (true);
create policy "provider_services_own" on provider_services for all using (auth.uid() = provider_id);

create policy "job_requests_select" on job_requests for select using (auth.uid() = client_id or status = 'open');
create policy "job_requests_insert" on job_requests for insert with check (auth.uid() = client_id);
create policy "job_requests_update" on job_requests for update using (auth.uid() = client_id);

create policy "applications_insert" on applications for insert with check (auth.uid() = provider_id);
create policy "applications_select" on applications for select using (
  auth.uid() = provider_id or
  auth.uid() = (select client_id from job_requests where id = job_id)
);

create policy "reviews_select" on reviews for select using (true);
create policy "reviews_insert" on reviews for insert with check (auth.uid() = client_id);
```

- [ ] **Step 2: Write seed data**

Create `supabase/seed.sql`:

```sql
insert into categories (name, icon) values
  ('Corte de pasto', '🌿'),
  ('Poda de árboles', '🌳'),
  ('Limpieza de jardín', '🧹'),
  ('Plomería', '🔧'),
  ('Electricidad', '⚡'),
  ('Pintura', '🖌️'),
  ('Albañilería', '🧱'),
  ('Limpieza del hogar', '🏠');
```

- [ ] **Step 3: Run in Supabase SQL Editor**

Open Supabase Dashboard → SQL Editor → paste and run `001_schema.sql`, then `seed.sql`.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: database schema + RLS + distance function + seed categories"
```

---

## Task 3: Supabase Clients + Middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create browser client** (`lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client** (`lib/supabase/server.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create middleware** (`middleware.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/ middleware.ts
git commit -m "feat: Supabase client + server + middleware setup"
```

---

## Task 4: TypeScript Types + Utilities

**Files:**
- Create: `lib/types.ts`
- Create: `lib/utils.ts`
- Create: `__tests__/utils.test.ts`

- [ ] **Step 1: Write failing tests** (`__tests__/utils.test.ts`)

```typescript
import { haversineDistance, buildWhatsAppUrl, formatDistance, formatRating } from '@/lib/utils'

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(-33.48, -60.03, -33.48, -60.03)).toBe(0)
  })

  it('calculates distance between Ramallo and San Nicolás (~22km)', () => {
    const dist = haversineDistance(-33.48, -60.03, -33.33, -60.22)
    expect(dist).toBeGreaterThan(20)
    expect(dist).toBeLessThan(30)
  })
})

describe('buildWhatsAppUrl', () => {
  it('strips non-digits from phone', () => {
    const url = buildWhatsAppUrl('+54 911 2345-6789', 'Hola')
    expect(url).toBe('https://wa.me/5491123456789?text=Hola')
  })

  it('encodes message with spaces', () => {
    const url = buildWhatsAppUrl('5491112345678', 'Me interesa tu servicio')
    expect(url).toContain('Me%20interesa%20tu%20servicio')
  })
})

describe('formatDistance', () => {
  it('shows meters for distances under 1km', () => {
    expect(formatDistance(0.5)).toBe('500m')
  })
  it('shows km for distances 1km+', () => {
    expect(formatDistance(3.7)).toBe('3.7km')
  })
})

describe('formatRating', () => {
  it('shows "Sin reseñas" for null', () => {
    expect(formatRating(null)).toBe('Sin reseñas')
  })
  it('shows one decimal', () => {
    expect(formatRating(4.666)).toBe('4.7')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=utils
```
Expected: FAIL (utils module not found)

- [ ] **Step 3: Write types** (`lib/types.ts`)

```typescript
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
```

- [ ] **Step 4: Write utilities** (`lib/utils.ts`)

```typescript
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '')
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

export function formatRating(rating: number | null): string {
  if (rating === null || rating === undefined) return 'Sin reseñas'
  return rating.toFixed(1)
}

export function defaultProviderMessage(providerName: string, category: string): string {
  return `Hola ${providerName}, vi tu perfil en CercaYa y me interesa tu servicio de ${category}. ¿Podemos coordinar?`
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=utils
```
Expected: PASS (4 suites, all green)

- [ ] **Step 6: Commit**

```bash
git add lib/ __tests__/
git commit -m "feat: TypeScript types + utility functions + tests"
```

---

## Task 5: Auth System

**Files:**
- Create: `app/auth/login/page.tsx`
- Create: `app/auth/callback/route.ts`
- Create: `components/forms/AuthForm.tsx`

- [ ] **Step 1: Create OAuth callback handler** (`app/auth/callback/route.ts`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Step 2: Create AuthForm component** (`components/forms/AuthForm.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'register'

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'client' | 'provider'>('client')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/')
      router.refresh()
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }

      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          role,
        })
        if (role === 'provider') {
          await supabase.from('providers').insert({ id: data.user.id, city: 'Ramallo' })
          router.push('/dashboard/provider')
        } else {
          router.push('/')
        }
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <>
            <input
              type="text"
              placeholder="Nombre completo"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRole('client')}
                className={`flex-1 py-2 rounded-lg border-2 transition ${role === 'client' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
              >
                Soy cliente
              </button>
              <button
                type="button"
                onClick={() => setRole('provider')}
                className={`flex-1 py-2 rounded-lg border-2 transition ${role === 'provider' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
              >
                Soy prestador
              </button>
            </div>
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full border rounded-lg px-4 py-2"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-4 py-2"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Registrarse'}
        </button>
      </form>

      <p className="text-center mt-4 text-sm text-gray-600">
        {mode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="text-green-600 font-semibold"
        >
          {mode === 'login' ? 'Registrate' : 'Iniciá sesión'}
        </button>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create login page** (`app/auth/login/page.tsx`)

```typescript
import AuthForm from '@/components/forms/AuthForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <AuthForm />
    </main>
  )
}
```

- [ ] **Step 4: Test manually**
  - Run `npm run dev`
  - Navigate to `/auth/login`
  - Register as client → should redirect to `/`
  - Register as provider → should redirect to `/dashboard/provider`
  - Log out (via Supabase dashboard or add signOut later) and log back in

- [ ] **Step 5: Commit**

```bash
git add app/auth/ components/forms/AuthForm.tsx
git commit -m "feat: auth flow — sign in, sign up with role selection"
```

---

## Task 6: Layout + Navbar

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/Navbar.tsx`

- [ ] **Step 1: Create Navbar** (`components/Navbar.tsx`)

```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold text-green-600">
        CercaYa
      </Link>

      <div className="flex items-center gap-4 text-sm">
        <Link href="/providers" className="text-gray-600 hover:text-green-600">
          Buscar prestadores
        </Link>

        {user ? (
          <>
            {profile?.role === 'provider' && (
              <Link href="/requests" className="text-gray-600 hover:text-green-600">
                Pedidos
              </Link>
            )}
            <Link
              href={profile?.role === 'provider' ? '/dashboard/provider' : '/dashboard'}
              className="text-gray-600 hover:text-green-600"
            >
              Mi perfil
            </Link>
            <form action="/auth/signout" method="post">
              <button className="text-gray-400 hover:text-red-500">Salir</button>
            </form>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700"
          >
            Entrar
          </Link>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create sign-out route** (`app/auth/signout/route.ts`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
}
```

- [ ] **Step 3: Update root layout** (`app/layout.tsx`)

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CercaYa — Servicios cerca tuyo',
  description: 'Encontrá prestadores de servicios locales en tu zona',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Test manually** — navbar shows login link when logged out, profile links when logged in

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/auth/signout/ components/Navbar.tsx
git commit -m "feat: Navbar with auth state + sign out"
```

---

## Task 7: Home Page

**Files:**
- Modify: `app/page.tsx`
- Create: `components/CategoryPicker.tsx`

- [ ] **Step 1: Create CategoryPicker** (`components/CategoryPicker.tsx`)

```typescript
import Link from 'next/link'
import { Category } from '@/lib/types'

export default function CategoryPicker({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {categories.map(cat => (
        <Link
          key={cat.id}
          href={`/providers?category=${cat.id}`}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-green-400 border-2 border-transparent transition"
        >
          <span className="text-3xl">{cat.icon}</span>
          <span className="text-sm font-medium text-center text-gray-700">{cat.name}</span>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Build home page** (`app/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import CategoryPicker from '@/components/CategoryPicker'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Servicios cerca tuyo, <span className="text-green-600">ahora</span>
        </h1>
        <p className="text-lg text-gray-500 mb-8">
          Encontrá prestadores de confianza en Ramallo y zona
        </p>
        <Link
          href="/request/new"
          className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition"
        >
          Publicar un pedido
        </Link>
      </div>

      <h2 className="text-xl font-semibold text-gray-800 mb-4">¿Qué necesitás?</h2>
      <CategoryPicker categories={categories ?? []} />
    </main>
  )
}
```

- [ ] **Step 3: Test manually** — home shows categories as cards linking to `/providers?category=X`

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/CategoryPicker.tsx
git commit -m "feat: home page with category picker"
```

---

## Task 8: Provider Catalog

**Files:**
- Create: `app/providers/page.tsx`
- Create: `components/ProviderCard.tsx`
- Create: `components/StarRating.tsx`

- [ ] **Step 1: Create StarRating** (`components/StarRating.tsx`)

```typescript
export default function StarRating({ rating, count }: { rating: number | null; count: number }) {
  const stars = rating ? Math.round(rating) : 0
  return (
    <div className="flex items-center gap-1 text-sm">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= stars ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
      <span className="text-gray-500 ml-1">
        {rating ? `${rating.toFixed(1)} (${count})` : 'Sin reseñas'}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create ProviderCard** (`components/ProviderCard.tsx`)

```typescript
import Link from 'next/link'
import Image from 'next/image'
import StarRating from './StarRating'
import { ProviderNear } from '@/lib/types'
import { formatDistance } from '@/lib/utils'

export default function ProviderCard({ provider }: { provider: ProviderNear }) {
  return (
    <Link
      href={`/providers/${provider.id}`}
      className="flex gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md border border-transparent hover:border-green-200 transition"
    >
      <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
        {provider.avatar_url ? (
          <Image src={provider.avatar_url} alt={provider.full_name} width={64} height={64} className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
            {provider.full_name[0]}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 truncate">{provider.full_name}</h3>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {formatDistance(provider.distance_km)}
          </span>
        </div>
        <StarRating rating={provider.avg_rating} count={provider.review_count} />
        {provider.price_range && (
          <p className="text-sm text-green-600 mt-1">{provider.price_range}</p>
        )}
        {provider.bio && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{provider.bio}</p>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Create provider catalog page** (`app/providers/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import ProviderCard from '@/components/ProviderCard'
import { Category, ProviderNear } from '@/lib/types'

// Ramallo coordinates as default
const RAMALLO_LAT = -33.4833
const RAMALLO_LNG = -60.0167

interface Props {
  searchParams: { category?: string; city?: string }
}

export default async function ProvidersPage({ searchParams }: Props) {
  const supabase = createClient()
  const catId = searchParams.category ? parseInt(searchParams.category) : null

  const { data: providers } = await supabase.rpc('providers_near', {
    lat: RAMALLO_LAT,
    lng: RAMALLO_LNG,
    radius_km: 50,
    ...(catId ? { cat_id: catId } : {}),
  })

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)

  const selectedCategory = categories?.find(c => c.id === catId)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : 'Todos los prestadores'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Zona Ramallo y alrededores</p>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
        <a
          href="/providers"
          className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition ${!catId ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}
        >
          Todos
        </a>
        {categories?.map(cat => (
          <a
            key={cat.id}
            href={`/providers?category=${cat.id}`}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition ${catId === cat.id ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}
          >
            {cat.icon} {cat.name}
          </a>
        ))}
      </div>

      {providers && providers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {(providers as ProviderNear[]).map(p => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">🌿</p>
          <p>No hay prestadores en esta zona aún.</p>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Test manually** — `/providers` shows all providers, `/providers?category=1` filters to lawn mowing

- [ ] **Step 5: Commit**

```bash
git add app/providers/page.tsx components/ProviderCard.tsx components/StarRating.tsx
git commit -m "feat: provider catalog with category filter"
```

---

## Task 9: Provider Profile Page + WhatsApp Button

**Files:**
- Create: `app/providers/[id]/page.tsx`
- Create: `components/WhatsAppButton.tsx`

- [ ] **Step 1: Create WhatsAppButton** (`components/WhatsAppButton.tsx`)

```typescript
'use client'
import { buildWhatsAppUrl, defaultProviderMessage } from '@/lib/utils'

interface Props {
  phone: string
  providerName: string
  categoryName?: string
}

export default function WhatsAppButton({ phone, providerName, categoryName = 'servicios' }: Props) {
  const url = buildWhatsAppUrl(phone, defaultProviderMessage(providerName, categoryName))
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-3 rounded-xl font-semibold hover:bg-[#20BA5A] transition"
    >
      <span>💬</span> Contactar por WhatsApp
    </a>
  )
}
```

- [ ] **Step 2: Create provider profile page** (`app/providers/[id]/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import WhatsAppButton from '@/components/WhatsAppButton'
import StarRating from '@/components/StarRating'
import { Review } from '@/lib/types'

export default async function ProviderProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, whatsapp_link, phone')
    .eq('id', params.id)
    .single()

  const { data: provider } = await supabase
    .from('providers')
    .select('bio, price_range, city, coverage_radius_km, is_approved')
    .eq('id', params.id)
    .single()

  if (!profile || !provider || !provider.is_approved) notFound()

  const { data: services } = await supabase
    .from('provider_services')
    .select('categories(id, name, icon)')
    .eq('provider_id', params.id)

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, client:profiles(full_name, avatar_url)')
    .eq('provider_id', params.id)
    .order('created_at', { ascending: false })

  const avgRating = reviews?.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  const contactPhone = profile.whatsapp_link || profile.phone || ''
  const categories = services?.flatMap(s => s.categories ? [s.categories] : []) as any[]

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex gap-4 items-start mb-4">
          <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.full_name} width={80} height={80} className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400">
                {profile.full_name[0]}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
            <p className="text-gray-500 text-sm">{provider.city}</p>
            <StarRating rating={avgRating} count={reviews?.length ?? 0} />
          </div>
        </div>

        {provider.bio && <p className="text-gray-700 mb-4">{provider.bio}</p>}

        {provider.price_range && (
          <p className="text-green-700 font-medium mb-4">💰 {provider.price_range}</p>
        )}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat: any) => (
              <span key={cat.id} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                {cat.icon} {cat.name}
              </span>
            ))}
          </div>
        )}

        {contactPhone && (
          <WhatsAppButton
            phone={contactPhone}
            providerName={profile.full_name}
            categoryName={categories[0]?.name}
          />
        )}
      </div>

      {/* Reviews */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Reseñas ({reviews?.length ?? 0})</h2>
        {reviews && reviews.length > 0 ? (
          <div className="flex flex-col gap-4">
            {(reviews as any[]).map(r => (
              <div key={r.id} className="border-b last:border-0 pb-4 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{r.client?.full_name ?? 'Cliente'}</span>
                  <StarRating rating={r.rating} count={0} />
                </div>
                {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Aún no hay reseñas.</p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Test manually**
  - Create a test provider in Supabase (set `is_approved = true` manually)
  - Navigate to `/providers/<id>` — should show full profile + WhatsApp button

- [ ] **Step 4: Commit**

```bash
git add app/providers/[id]/ components/WhatsAppButton.tsx
git commit -m "feat: provider profile page with WhatsApp contact"
```

---

## Task 10: Post a Job Request (Client)

**Files:**
- Create: `app/request/new/page.tsx`
- Create: `components/forms/JobRequestForm.tsx`

- [ ] **Step 1: Create JobRequestForm** (`components/forms/JobRequestForm.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types'

export default function JobRequestForm({ categories, userId }: { categories: Category[]; userId: string }) {
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) { setError('Seleccioná una categoría'); return }
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('job_requests').insert({
      client_id: userId,
      category_id: categoryId,
      description,
      location_label: locationLabel || 'Ramallo',
      location_lat: -33.4833,
      location_lng: -60.0167,
      preferred_date: preferredDate || null,
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">¿Qué necesitás?</label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                categoryId === cat.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="block text-sm mt-1">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Contanos qué necesitás con el mayor detalle posible..."
          className="w-full border rounded-lg px-4 py-2 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección o barrio</label>
        <input
          type="text"
          value={locationLabel}
          onChange={e => setLocationLabel(e.target.value)}
          placeholder="Ej: Barrio Norte, Ramallo"
          className="w-full border rounded-lg px-4 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha preferida (opcional)</label>
        <input
          type="date"
          value={preferredDate}
          onChange={e => setPreferredDate(e.target.value)}
          className="w-full border rounded-lg px-4 py-2"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Publicando...' : 'Publicar pedido'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create new request page** (`app/request/new/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JobRequestForm from '@/components/forms/JobRequestForm'

export default async function NewRequestPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Publicar un pedido</h1>
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <JobRequestForm categories={categories ?? []} userId={user.id} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Test manually** — log in as client, go to `/request/new`, fill and submit → should appear in Supabase `job_requests` table

- [ ] **Step 4: Commit**

```bash
git add app/request/ components/forms/JobRequestForm.tsx
git commit -m "feat: job request form for clients"
```

---

## Task 11: Browse Requests + Apply (Provider)

**Files:**
- Create: `app/requests/page.tsx`

- [ ] **Step 1: Create requests page** (`app/requests/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplyButton from './ApplyButton'

export default async function RequestsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'provider') redirect('/')

  const { data: requests } = await supabase
    .from('job_requests')
    .select('*, category:categories(name, icon), client:profiles(full_name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  const { data: myApplications } = await supabase
    .from('applications')
    .select('job_id')
    .eq('provider_id', user.id)

  const appliedJobIds = new Set(myApplications?.map(a => a.job_id))

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pedidos abiertos</h1>
      {requests && requests.length > 0 ? (
        <div className="flex flex-col gap-4">
          {(requests as any[]).map(req => (
            <div key={req.id} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="text-lg">{req.category?.icon}</span>{' '}
                  <span className="font-semibold">{req.category?.name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(req.created_at).toLocaleDateString('es-AR')}
                </span>
              </div>
              <p className="text-gray-700 text-sm mb-3">{req.description}</p>
              {req.location_label && (
                <p className="text-xs text-gray-400 mb-3">📍 {req.location_label}</p>
              )}
              {req.preferred_date && (
                <p className="text-xs text-gray-400 mb-3">
                  📅 {new Date(req.preferred_date).toLocaleDateString('es-AR')}
                </p>
              )}
              <ApplyButton
                jobId={req.id}
                providerId={user.id}
                alreadyApplied={appliedJobIds.has(req.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-400 py-16">No hay pedidos abiertos por ahora.</p>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Create ApplyButton client component** (`app/requests/ApplyButton.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  jobId: string
  providerId: string
  alreadyApplied: boolean
}

export default function ApplyButton({ jobId, providerId, alreadyApplied }: Props) {
  const [applied, setApplied] = useState(alreadyApplied)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleApply() {
    setLoading(true)
    await supabase.from('applications').insert({ job_id: jobId, provider_id: providerId, message })
    setApplied(true)
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  if (applied) {
    return <p className="text-sm text-green-600 font-medium">✓ Ya te postulaste</p>
  }

  return showForm ? (
    <div className="space-y-2">
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Mensaje opcional para el cliente..."
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={handleApply}
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Confirmar postulación'}
        </button>
        <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">
          Cancelar
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setShowForm(true)}
      className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
    >
      Postularme
    </button>
  )
}
```

- [ ] **Step 3: Test manually** — log in as provider → `/requests` shows open requests, apply → confirmation shows

- [ ] **Step 4: Commit**

```bash
git add app/requests/
git commit -m "feat: open job requests browse + apply for providers"
```

---

## Task 12: Provider Dashboard + Profile Editor

**Files:**
- Create: `app/dashboard/provider/page.tsx`
- Create: `components/forms/ProviderProfileForm.tsx`

- [ ] **Step 1: Create ProviderProfileForm** (`components/forms/ProviderProfileForm.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Category } from '@/lib/types'

interface Props {
  userId: string
  initialProfile: {
    full_name: string
    phone: string | null
    whatsapp_link: string | null
    bio: string | null
    price_range: string | null
    city: string
  }
  categories: Category[]
  selectedCategoryIds: number[]
}

export default function ProviderProfileForm({ userId, initialProfile, categories, selectedCategoryIds }: Props) {
  const [fullName, setFullName] = useState(initialProfile.full_name)
  const [phone, setPhone] = useState(initialProfile.phone ?? '')
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const [priceRange, setPriceRange] = useState(initialProfile.price_range ?? '')
  const [city, setCity] = useState(initialProfile.city)
  const [selectedCats, setSelectedCats] = useState<Set<number>>(new Set(selectedCategoryIds))
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function toggleCat(id: number) {
    setSelectedCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await supabase.from('profiles').update({
      full_name: fullName,
      phone,
      whatsapp_link: phone,
    }).eq('id', userId)

    await supabase.from('providers').update({
      bio,
      price_range: priceRange,
      city,
    }).eq('id', userId)

    await supabase.from('provider_services').delete().eq('provider_id', userId)
    if (selectedCats.size > 0) {
      await supabase.from('provider_services').insert(
        Array.from(selectedCats).map(catId => ({ provider_id: userId, category_id: catId }))
      )
    }

    setSaved(true)
    setLoading(false)
    router.refresh()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full border rounded-lg px-4 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp / Teléfono</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54911..." className="w-full border rounded-lg px-4 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Bio</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full border rounded-lg px-4 py-2 resize-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Precio estimado</label>
        <input value={priceRange} onChange={e => setPriceRange(e.target.value)} placeholder="Ej: $2.000 - $5.000" className="w-full border rounded-lg px-4 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Servicios que ofrecés</label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCat(cat.id)}
              className={`p-2 rounded-lg border-2 text-left text-sm transition ${
                selectedCats.has(cat.id) ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar perfil'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create provider dashboard** (`app/dashboard/provider/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProviderProfileForm from '@/components/forms/ProviderProfileForm'

export default async function ProviderDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, whatsapp_link, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'provider') redirect('/dashboard')

  const { data: provider } = await supabase
    .from('providers')
    .select('bio, price_range, city, is_approved')
    .eq('id', user.id)
    .single()

  const { data: categories } = await supabase
    .from('categories').select('*').eq('is_active', true)

  const { data: myServices } = await supabase
    .from('provider_services')
    .select('category_id')
    .eq('provider_id', user.id)

  const { data: applications } = await supabase
    .from('applications')
    .select('id, message, created_at, job:job_requests(description, location_label, category:categories(name, icon), client:profiles(full_name))')
    .eq('provider_id', user.id)
    .order('created_at', { ascending: false })

  const { data: myReviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, client:profiles(full_name)')
    .eq('provider_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi panel de prestador</h1>
        {!provider?.is_approved && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
            Pendiente de aprobación
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Mi perfil</h2>
        <ProviderProfileForm
          userId={user.id}
          initialProfile={{
            full_name: profile?.full_name ?? '',
            phone: profile?.phone,
            whatsapp_link: profile?.whatsapp_link,
            bio: provider?.bio,
            price_range: provider?.price_range,
            city: provider?.city ?? 'Ramallo',
          }}
          categories={categories ?? []}
          selectedCategoryIds={myServices?.map(s => s.category_id) ?? []}
        />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Mis postulaciones ({applications?.length ?? 0})</h2>
        {applications && applications.length > 0 ? (
          <div className="flex flex-col gap-3">
            {(applications as any[]).map(app => (
              <div key={app.id} className="border rounded-lg p-3">
                <p className="font-medium text-sm">{(app.job as any)?.category?.icon} {(app.job as any)?.category?.name}</p>
                <p className="text-sm text-gray-600">{(app.job as any)?.description}</p>
                <p className="text-xs text-gray-400 mt-1">📍 {(app.job as any)?.location_label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Todavía no te postulaste a ningún pedido.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Mis reseñas ({myReviews?.length ?? 0})</h2>
        {myReviews && myReviews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {(myReviews as any[]).map(r => (
              <div key={r.id} className="border-b last:border-0 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{r.client?.full_name}</span>
                  <span className="text-yellow-400">{'★'.repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aún no tenés reseñas.</p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Test manually** — log in as provider → complete profile → save → see changes in Supabase

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/provider/ components/forms/ProviderProfileForm.tsx
git commit -m "feat: provider dashboard with profile editor + applications + reviews"
```

---

## Task 13: Client Dashboard + Reviews

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `components/forms/ReviewForm.tsx`

- [ ] **Step 1: Create ReviewForm** (`components/forms/ReviewForm.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  providerId: string
  clientId: string
  providerName: string
}

export default function ReviewForm({ providerId, clientId, providerName }: Props) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return
    setLoading(true)
    await supabase.from('reviews').upsert({
      provider_id: providerId,
      client_id: clientId,
      rating,
      comment,
    }, { onConflict: 'provider_id,client_id' })
    setDone(true)
    setLoading(false)
    router.refresh()
  }

  if (done) return <p className="text-green-600 text-sm">✓ Reseña enviada. ¡Gracias!</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-xl bg-gray-50">
      <p className="font-medium text-sm">Dejá una reseña para {providerName}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            className={`text-2xl ${i <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
          >★</button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Comentario (opcional)"
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
      />
      <button
        type="submit"
        disabled={!rating || loading}
        className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        Enviar reseña
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create client dashboard** (`app/dashboard/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReviewForm from '@/components/forms/ReviewForm'

export default async function ClientDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'provider') redirect('/dashboard/provider')

  const { data: requests } = await supabase
    .from('job_requests')
    .select('*, category:categories(name, icon)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  const { data: givenReviews } = await supabase
    .from('reviews')
    .select('provider_id')
    .eq('client_id', user.id)

  const reviewedProviders = new Set(givenReviews?.map(r => r.provider_id))

  const { data: closedApplications } = await supabase
    .from('applications')
    .select('provider_id, provider:profiles(full_name), job:job_requests(client_id)')
    .filter('job.client_id', 'eq', user.id)

  const contactedProviders = (closedApplications as any[])?.filter(
    a => !reviewedProviders.has(a.provider_id)
  ) ?? []

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Mis pedidos</h1>

      <Link
        href="/request/new"
        className="block text-center bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700"
      >
        + Nuevo pedido
      </Link>

      {requests && requests.length > 0 ? (
        <div className="flex flex-col gap-3">
          {(requests as any[]).map(req => (
            <div key={req.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{req.category?.icon} {req.category?.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  req.status === 'open' ? 'bg-green-100 text-green-700' :
                  req.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{req.status}</span>
              </div>
              <p className="text-sm text-gray-600">{req.description}</p>
              {req.location_label && <p className="text-xs text-gray-400 mt-1">📍 {req.location_label}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <p>Todavía no publicaste ningún pedido.</p>
        </div>
      )}

      {contactedProviders.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Dejá una reseña</h2>
          <div className="space-y-4">
            {contactedProviders.map((a: any) => (
              <ReviewForm
                key={a.provider_id}
                providerId={a.provider_id}
                clientId={user.id}
                providerName={a.provider?.full_name ?? 'Prestador'}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Test manually** — log in as client → dashboard shows requests → review form appears for providers who applied

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx components/forms/ReviewForm.tsx
git commit -m "feat: client dashboard + review form"
```

---

## Task 14: Admin Panel

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Add admin RLS bypass** in Supabase SQL Editor

```sql
-- Allow admins to read/update all providers
create policy "admins_full_providers" on providers
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admins_read_profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
```

- [ ] **Step 2: Manually create your admin user** in Supabase SQL Editor

```sql
update profiles set role = 'admin' where id = 'YOUR_USER_UUID';
```

- [ ] **Step 3: Create admin page** (`app/admin/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApproveButton from './ApproveButton'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/')

  const { data: pending } = await supabase
    .from('providers')
    .select('id, city, created_at, profile:profiles(full_name, phone)')
    .eq('is_approved', false)
    .order('created_at')

  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Panel Admin</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">
          Prestadores pendientes de aprobación ({pending?.length ?? 0})
        </h2>
        {pending && pending.length > 0 ? (
          <div className="flex flex-col gap-3">
            {(pending as any[]).map(p => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium">{p.profile?.full_name}</p>
                  <p className="text-sm text-gray-500">{p.profile?.phone} · {p.city}</p>
                </div>
                <ApproveButton providerId={p.id} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay prestadores pendientes.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Usuarios recientes</h2>
        <div className="flex flex-col gap-2">
          {(allUsers as any[])?.map(u => (
            <div key={u.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
              <span>{u.full_name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                u.role === 'provider' ? 'bg-green-100 text-green-700' :
                u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>{u.role}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Create ApproveButton** (`app/admin/ApproveButton.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ApproveButton({ providerId }: { providerId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function approve() {
    setLoading(true)
    await supabase.from('providers').update({ is_approved: true }).eq('id', providerId)
    setDone(true)
    setLoading(false)
    router.refresh()
  }

  if (done) return <span className="text-green-600 text-sm font-medium">✓ Aprobado</span>

  return (
    <button
      onClick={approve}
      disabled={loading}
      className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? '...' : 'Aprobar'}
    </button>
  )
}
```

- [ ] **Step 5: Test manually** — log in as admin → `/admin` shows pending providers → click Aprobar → provider appears in catalog

- [ ] **Step 6: Commit**

```bash
git add app/admin/
git commit -m "feat: admin panel — approve providers + user list"
```

---

## Task 15: Polish + Error States

**Files:**
- Modify: `app/globals.css`
- Various pages for 404 / loading states

- [ ] **Step 1: Add not-found page** (`app/not-found.tsx`)

```typescript
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="max-w-md mx-auto text-center py-24 px-4">
      <p className="text-6xl mb-4">🌿</p>
      <h1 className="text-2xl font-bold mb-2">Página no encontrada</h1>
      <p className="text-gray-500 mb-6">El contenido que buscás no existe o fue removido.</p>
      <Link href="/" className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700">
        Volver al inicio
      </Link>
    </main>
  )
}
```

- [ ] **Step 2: Update globals.css** for Leaflet compatibility

Add to `app/globals.css`:
```css
@import 'leaflet/dist/leaflet.css';
```

- [ ] **Step 3: Verify all pages have redirect guards**
  - `/request/new` → redirect to login if no session ✓
  - `/requests` → redirect if not provider ✓
  - `/dashboard` → redirect if not logged in ✓
  - `/admin` → redirect if not admin ✓

- [ ] **Step 4: Commit**

```bash
git add app/not-found.tsx app/globals.css
git commit -m "feat: 404 page + polish"
```

---

## Task 16: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USER/cercaya.git
git push -u origin main
```

- [ ] **Step 2: Import project in Vercel**
  - Go to vercel.com → New Project → Import from GitHub
  - Select `cercaya` repo
  - Framework: Next.js (auto-detected)

- [ ] **Step 3: Set environment variables in Vercel**

In Vercel project settings → Environment Variables, add:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://cercaya.vercel.app
```

- [ ] **Step 4: Set Supabase redirect URL**

In Supabase Dashboard → Authentication → URL Configuration:
```
Site URL: https://cercaya.vercel.app
Redirect URLs: https://cercaya.vercel.app/auth/callback
```

- [ ] **Step 5: Deploy**
  - Click Deploy in Vercel
  - Wait for build to complete
  - Open production URL and test full flow:
    1. Register as client → post a job request
    2. Register as provider → fill profile
    3. Approve provider via admin
    4. Client finds provider in catalog → WhatsApp button works
    5. Provider applies to job request → shows in dashboard

- [ ] **Step 6: Commit deploy config**

```bash
git add .
git commit -m "chore: deploy config + env example"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Client flow: browse catalog → view profile → WhatsApp contact (Tasks 8-9)
- ✅ Client flow: post job request (Task 10)
- ✅ Provider flow: register → profile → browse/apply requests (Tasks 5, 11-12)
- ✅ Admin flow: approve providers (Task 14)
- ✅ Reviews: client leaves review for provider (Task 13)
- ✅ Categories: seeded and filterable (Tasks 2, 7-8)
- ✅ Multi-city ready: city field on providers table
- ✅ WhatsApp as contact: no in-app messaging needed
- ✅ No payments: explicitly excluded

**No placeholders found.** All steps have concrete code.

**Type consistency:** `ProviderNear` used in catalog (Task 8) matches the SQL function return type (Task 2). `Category`, `Profile`, `JobRequest` types defined in Task 4 and used consistently throughout.
