# CercaYa

Marketplace de servicios locales on-demand. Clientes encuentran prestadores (jardín, plomería, electricidad, etc.) en su zona o publican pedidos abiertos.

**Stack:** Next.js 16 + Supabase + Tailwind CSS + Vercel

---

## Setup local

### 1. Crear proyecto en Supabase
- Ir a [supabase.com](https://supabase.com) → New Project
- Copiar `Project URL` y `anon public key` desde Settings → API

### 2. Variables de entorno
Copiar `.env.local.example` a `.env.local` y completar:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Ejecutar schema en Supabase
En Supabase Dashboard → SQL Editor, ejecutar en orden:
1. `supabase/migrations/001_schema.sql`
2. `supabase/seed.sql`
3. `supabase/002_admin_policies.sql` (después de crear el usuario admin)

### 4. Instalar y correr
```bash
npm install
npm run dev
```

La app corre en http://localhost:3000

---

## Crear usuario admin
1. Registrarse en la app con cualquier email
2. Copiar el UUID desde Supabase → Authentication → Users
3. En SQL Editor:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'TU_UUID';
```
4. Ejecutar `supabase/002_admin_policies.sql`

---

## Deploy en Vercel

### 1. Push a GitHub
```bash
git remote add origin https://github.com/TU_USUARIO/cercaya.git
git push -u origin main
```

### 2. Importar en Vercel
- vercel.com → New Project → importar repo
- Framework: Next.js (auto-detectado)

### 3. Variables de entorno en Vercel
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL=https://tu-dominio.vercel.app
```

### 4. Configurar Supabase redirect URLs
En Supabase → Authentication → URL Configuration:
- Site URL: `https://tu-dominio.vercel.app`
- Redirect URLs: `https://tu-dominio.vercel.app/auth/callback`

---

## Estructura

```
app/
├── page.tsx               # Home — categorías
├── auth/                  # Login, registro, OAuth callback
├── providers/             # Catálogo + perfiles de prestadores
├── request/new/           # Publicar pedido (clientes)
├── requests/              # Ver pedidos abiertos (prestadores)
├── dashboard/             # Panel cliente
├── dashboard/provider/    # Panel prestador
└── admin/                 # Panel admin

components/
├── Navbar.tsx
├── CategoryPicker.tsx
├── ProviderCard.tsx
├── WhatsAppButton.tsx
├── StarRating.tsx
└── forms/

lib/
├── supabase/client.ts     # Browser client
├── supabase/server.ts     # Server client (async cookies)
├── types.ts
└── utils.ts
```

## Tests
```bash
npm test   # 8 tests — distancia Haversine, WhatsApp URL, formateo
```
