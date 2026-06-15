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
