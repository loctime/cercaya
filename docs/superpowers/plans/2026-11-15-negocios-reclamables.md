# Negocios reclamables en el mapa — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el modo Trabajo del mapa muestre negocios cargados por nosotros desde Instagram, que su dueño pueda reclamarlos (verificación manual por DM a @cercaya) y que cualquiera pueda pedir la baja de uno sin reclamar.

**Architecture:** Tabla nueva `negocios` (sin relación con `profiles` hasta que se reclama) más `negocio_reclamos` y `negocio_bajas`, todo detrás de funciones RPC con permisos explícitos (la app nunca lee ni escribe las tablas directo). El mapa de Trabajo hace una segunda consulta (`negocios_cerca`) en paralelo a `buscar_servicio` y dibuja los negocios con un pin distinto; `buscar_servicio` no se toca. El panel de Administración suma dos pestañas.

**Tech Stack:** Supabase/PostgreSQL (migraciones SQL, pruebas con PGlite vía `npm run test:db`), Expo SDK 57 + Expo Router + react-native-maps (`movil/`), Next.js 16 (solo textos legales en `app/`).

**Spec:** `docs/superpowers/specs/2026-11-15-negocios-reclamables-design.md`

**Dónde se trabaja:** rama nueva `negocios`, creada desde `encuentro` en un worktree `C:\Users\User\Desktop\Proyectos\CercaYa-negocios` (`git worktree add ../CercaYa-negocios -b negocios encuentro`). Copiar ahí el spec y este plan (hoy están sin commitear en el worktree de `v2-expo`). Un worktree no trae `movil/.env`: copiarlo desde el principal si hace falta correr la app. Push: `env -u GITHUB_TOKEN git push`.

## Global Constraints

- Migraciones nuevas: `0116` en adelante (la última en producción es `0115`). Cada una revoca todo y otorga explícito, como `0090_permisos.sql`: `revoke all on <tabla> from public, anon, authenticated;` y `revoke all on function ... from public, anon, authenticated; grant execute ... to authenticated;`.
- Toda función nueva es `security definer set search_path = public`. En cuerpos `$$` escribir expresiones regulares como `'\s+'` (no duplicar la barra).
- Las tablas nuevas no tienen ningún permiso para `anon`/`authenticated`: se lee y escribe solo por RPC.
- Estados de `negocios.estado`: `sin_reclamar` | `reclamado` | `oculto`. Tipos: `local` | `a_domicilio`.
- Privacidad: un negocio `a_domicilio` nunca devuelve teléfono ni coordenadas exactas (se usa `difuminar(lat, lng, id, 0.015)`, igual que `buscar_servicio`). Solo `local` devuelve teléfono y coordenadas reales.
- Solo usuarios con sesión ven negocios (`auth.uid() is not null`), igual que la capa pública.
- Límites: código de reclamo de 6 caracteres que vence a los 7 días; máximo 3 reclamos pendientes y vigentes por usuario; máximo 10 bajas por usuario por día.
- Cuenta oficial de Instagram: `cercaya` (`@cercaya`), una sola constante en la app.
- Textos de la app en español rioplatense con voseo y tildes; sin `¿` ni `¡` de apertura.
- Pruebas de lógica pura de la app: `cd movil && npm test` (`node --test --experimental-strip-types src/lib/*.test.ts`). Verificar tipos con `cd movil && npm run typecheck`.
- **Desvío del spec:** en esta primera versión los negocios no tienen foto (no hay `foto_path`). La foto llega con la sincronización de Instagram. El dueño edita nombre, bio, teléfono, tipo y ubicación; "borrar" su negocio es ocultarlo.
- No commitear `movil/.env`, `google-services.json` ni contraseñas (el repo es público).

## Review Focus

Cosas que el spec implica y que ningún test obvio cubre; cada una tiene su prueba en la tarea dueña del código:

1. Un negocio `a_domicilio` cargado con teléfono no lo expone, y sus coordenadas devueltas no son las guardadas (Task 1).
2. Buscar con texto vacío, solo relleno o de una letra no devuelve todos los negocios (Task 1).
3. Un invitado sin sesión no puede llamar a ninguna función ni leer las tablas (Tasks 1–4).
4. Dos usuarios reclaman el mismo negocio: al aprobar uno, el otro queda rechazado, y no se puede aprobar un reclamo vencido ni sobre un negocio ya reclamado (Task 2).
5. El dueño borra su cuenta: el negocio queda `oculto`, no `reclamado` sin dueño (Task 4).
6. `@Panaderia.Lopez` y `panaderia.lopez` son el mismo negocio (Task 1); una baja sobre un negocio ya reclamado se rechaza (Task 3).

---

### Task 1: Tablas, carga y búsqueda de negocios (migración 0116)

**Files:**
- Create: `supabase/migrations/0116_negocios.sql`
- Create: `tests/db/negocios.test.mjs`

**Interfaces:**
- Consumes: `habilidades_catalogo(id text, label, aliases text[])`, `palabras_busqueda(text) -> text[]`, `normalizar_busqueda(text)`, `difuminar(float8, float8, uuid, float8) -> (lat, lng)`, `dist_km`, `distancia_publica`, `es_admin()`, `profile_private(lat, lng)` de quien busca; del harness: `crearDb`, `RAMALLO`, `CERCA`, `ROSARIO`, `db.usuario(nombre, {lat, lng})`, `db.como(userId, fn)`.
- Produces (los usan las Tasks 2–8):
  - tabla `negocios(id uuid pk, nombre text, catalog_id text, bio text, instagram_usuario text unique, ig_user_id text, tipo text, lat float8, lng float8, telefono text, estado text default 'sin_reclamar', motivo_oculto text, owner_id uuid, cargado_por uuid, fuente text default 'instagram', created_at, updated_at)`; `motivo_oculto` ∈ `baja` | `dueno` | `admin` | `cuenta` | null.
  - `cargar_negocio(p_nombre text, p_catalog_id text, p_instagram text, p_tipo text, p_lat float8, p_lng float8, p_telefono text default null, p_bio text default null) returns uuid` — normaliza el usuario (sin `@`, minúscula, solo `[a-z0-9._]` hasta 30), rechaza duplicados con `raise exception 'Ya existe un negocio con ese Instagram'`; si `auth.uid()` no es nulo exige `es_admin()`.
  - `negocios_cerca(p_texto text, p_radio_km int default 15) returns table (id uuid, nombre text, rubro text, bio text, instagram_usuario text, tipo text, telefono text, estado text, distancia_km numeric, lat float8, lng float8, es_mio boolean)`; devuelve negocios con `estado in ('sin_reclamar','reclamado')`, hasta 30, ordenados por distancia.

- [ ] **Step 1: Write the failing tests** en `tests/db/negocios.test.mjs` (mismo esquema `before/after` y helpers `como`/`rechaza` que `tests/db/trabajo.test.mjs`). Helpers: `buscador(pos)` (usuario con ubicación y `location_updated_at = now()`), `admin()` (usuario con `is_admin = true`), `cargar(admin, datos)` (llama `select cargar_negocio(...)` como ese admin). Pruebas, con las catalog ids reales `'plomero'`/`'arreglar-canilla'` (usar los que existan en el catálogo):
  - `cargar_negocio: normaliza el usuario de Instagram` — cargar `'@Panaderia.Lopez'` y comprobar `instagram_usuario = 'panaderia.lopez'`; cargar `'panaderia.lopez'` de nuevo rechaza con `/Ya existe/`.
  - `cargar_negocio: un usuario común no puede cargar` — `como(usuarioComun, ...)` rechaza; y llamarla como superusuario (sin `auth.uid()`) funciona.
  - `negocios_cerca: local muestra telefono y coordenadas reales` — cargar `local` con teléfono `'3407555555'` en `CERCA`; el buscador lo ve con ese teléfono y `lat/lng` iguales a los cargados.
  - `negocios_cerca: a_domicilio no expone telefono ni coordenadas exactas` (Review Focus 1) — cargar `a_domicilio` con teléfono; `telefono` es `null` y `lat/lng` difieren de los guardados pero quedan a menos de 2 km.
  - `negocios_cerca: encuentra por sinonimo del rubro y por nombre` — "canilla rota" encuentra al de rubro plomero; el nombre `'Plomería Don Raúl'` se encuentra con "don raul".
  - `negocios_cerca: texto vacio, relleno o de una letra no devuelve nada` (Review Focus 2) — `''`, `'   '`, `'de una'`, `'a'` → 0 filas aunque haya negocios.
  - `negocios_cerca: respeta el radio y no muestra ocultos` — uno en `ROSARIO` no aparece con radio 15; uno con `estado = 'oculto'` (update directo como superusuario) no aparece.
  - `negocios_cerca: invitados y tablas cerradas` (Review Focus 3) — `como(null, ...)` llamando `negocios_cerca` rechaza con `/permission denied/`; `como(usuarioComun, 'select * from negocios')` rechaza con `/permission denied/`.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/db/negocios.test.mjs`
Expected: FAIL (`Fallo la migracion` no, sino "function cargar_negocio does not exist" / la relación `negocios` no existe).

- [ ] **Step 3: Write `supabase/migrations/0116_negocios.sql`** con la tabla `negocios` (checks: `nombre` 2–80 caracteres, `bio` ≤ 300, `tipo`, `estado`, `motivo_oculto`, `instagram_usuario ~ '^[a-z0-9._]{1,30}$'`; `catalog_id` con FK a `habilidades_catalogo(id)`; `owner_id` y `cargado_por` con FK a `profiles(id) on delete set null`), RLS activado sin policies, `revoke all` para `public, anon, authenticated`, y las dos funciones de Interfaces. `negocios_cerca` sigue la estructura de `buscar_servicio` en `0114_disponibilidad.sql` (CTE `q` con `palabras_busqueda`, CTE `yo` con la ubicación guardada de quien busca, mismo filtro de radio `least(greatest(coalesce(p_radio_km, 15), 1), 50)`): un negocio coincide si todas las palabras aparecen en `normalizar_busqueda(nombre || ' ' || label_del_catalogo || ' ' || aliases)`. `local` devuelve `telefono`, `lat`, `lng` reales; `a_domicilio` devuelve `null` y las coordenadas de `difuminar(lat, lng, id, 0.015)`; `es_mio = (owner_id = auth.uid())`. `rubro` es el `label` del catálogo.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/db/negocios.test.mjs`
Expected: PASS (8 pruebas).

- [ ] **Step 5: Run the whole DB suite** — `npm run test:db`. Expected: todo PASS (las migraciones viejas no se tocan).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0116_negocios.sql tests/db/negocios.test.mjs docs/superpowers/specs/2026-11-15-negocios-reclamables-design.md docs/superpowers/plans/2026-11-15-negocios-reclamables.md
git commit -m "feat(negocios): tabla, carga y busqueda de negocios sin dueno"
```

---

### Task 2: Reclamo de negocios (migración 0117)

**Files:**
- Create: `supabase/migrations/0117_negocio_reclamos.sql`
- Modify: `tests/db/negocios.test.mjs` (agregar pruebas)

**Interfaces:**
- Consumes: `negocios`, `es_admin()`, `encolar_notificacion(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb)` (usar `p_kind = 'sistema'`).
- Produces:
  - tabla `negocio_reclamos(id uuid pk, negocio_id uuid, user_id uuid, email text, codigo text, estado text default 'pendiente', created_at, vence_at default now() + interval '7 days', resuelto_por uuid, resuelto_en timestamptz)`; `estado` ∈ `pendiente` | `aprobado` | `rechazado`. "Vencido" = `pendiente` con `vence_at <= now()` (no es un estado guardado). Índice único parcial `(negocio_id, user_id) where estado = 'pendiente'`.
  - `reclamar_negocio(p_negocio uuid, p_email text) returns text` — devuelve el código (6 caracteres en mayúscula, hexadecimal de `md5(random()::text || clock_timestamp()::text)`). Si el usuario ya tiene un reclamo vigente para ese negocio, devuelve el mismo código sin crear otro. Errores: negocio que no está `sin_reclamar` → `'Este negocio ya no se puede reclamar'`; mail inválido → `'Revisá el mail'`; más de 3 vigentes → `'Tenés 3 reclamos pendientes. Esperá a que los revisemos'`.
  - `mi_reclamo(p_negocio uuid) returns table (codigo text, vence_at timestamptz)` — el reclamo vigente del usuario para ese negocio, o 0 filas.
  - `admin_reclamos_pendientes() returns table (id uuid, negocio_id uuid, negocio_nombre text, instagram_usuario text, user_id uuid, user_nombre text, email text, codigo text, created_at timestamptz, vence_at timestamptz)` — solo vigentes, más viejos primero; exige `es_admin()`.
  - `admin_resolver_reclamo(p_reclamo uuid, p_aprueba boolean) returns void` — exige `es_admin()`; solo reclamos vigentes (vencido → `'El reclamo venció'`). Aprobar: el negocio debe estar `sin_reclamar`, queda `reclamado` con `owner_id = user_id`, los demás reclamos pendientes de ese negocio pasan a `rechazado`, y el usuario recibe una notificación `'sistema'` ("Tu negocio ya es tuyo"); rechazar: estado `rechazado` y notificación `'sistema'`.

- [ ] **Step 1: Write the failing tests** (agregar a `tests/db/negocios.test.mjs`):
  - `reclamar_negocio: devuelve un codigo de 6 caracteres y es idempotente` — dos llamadas seguidas devuelven el mismo código y `select count(*) from negocio_reclamos` (como superusuario) da 1.
  - `reclamar_negocio: mail invalido y negocio oculto o ya reclamado rechazan`.
  - `reclamar_negocio: tope de 3 reclamos vigentes` — el cuarto rechaza; si uno de los tres está vencido (update de `vence_at` al pasado) el cuarto entra.
  - `admin_resolver_reclamo: aprobar da el negocio, rechaza a los otros y avisa` (Review Focus 4) — dos usuarios reclaman el mismo negocio; el admin aprueba el primero; `negocios.owner_id` = ese usuario, `estado = 'reclamado'`, el segundo reclamo queda `rechazado`, existe una fila en `notifications` con `kind = 'sistema'` para el primero.
  - `admin_resolver_reclamo: no aprueba reclamos vencidos ni sobre un negocio ya reclamado` y `un usuario comun no puede resolver ni listar`.
  - `admin_reclamos_pendientes: no lista los vencidos`.
  - `invitado: reclamar_negocio y mi_reclamo rechazan con permission denied`.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/db/negocios.test.mjs`
Expected: FAIL, "function reclamar_negocio does not exist".

- [ ] **Step 3: Write `supabase/migrations/0117_negocio_reclamos.sql`** con la tabla (FK a `negocios` y a `profiles` con `on delete cascade`; check del mail `~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'`), RLS sin policies, `revoke all` y las cuatro funciones de Interfaces con `grant execute ... to authenticated`.

- [ ] **Step 4: Run to verify it passes** — `node --test tests/db/negocios.test.mjs`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0117_negocio_reclamos.sql tests/db/negocios.test.mjs
git commit -m "feat(negocios): reclamo con codigo y aprobacion de admin"
```

---

### Task 3: Bajas (migración 0118)

**Files:**
- Create: `supabase/migrations/0118_negocio_bajas.sql`
- Modify: `tests/db/negocios.test.mjs`

**Interfaces:**
- Consumes: `negocios` (`estado`, `motivo_oculto`), `es_admin()`.
- Produces:
  - tabla `negocio_bajas(id uuid pk, negocio_id uuid, user_id uuid null, motivo text, estado text default 'pendiente', created_at, resuelto_por uuid, resuelto_en timestamptz)`; `estado` ∈ `pendiente` | `confirmada` | `revertida`; `motivo` ≤ 300 caracteres; FK a `negocios` con `on delete cascade`, a `profiles` con `on delete set null`.
  - `pedir_baja_negocio(p_negocio uuid, p_motivo text default null) returns void` — solo si el negocio está `sin_reclamar` (si no: `'Este negocio tiene dueño: pedile que lo saque'`); pasa a `oculto` con `motivo_oculto = 'baja'` en el momento; error `'Llegaste al máximo de bajas de hoy'` a la baja 11 del día del mismo usuario.
  - `admin_bajas(p_estado text) returns table (id uuid, negocio_id uuid, negocio_nombre text, instagram_usuario text, user_nombre text, motivo text, created_at timestamptz)` — `p_estado` ∈ `pendiente` | `confirmada`; exige `es_admin()`.
  - `admin_resolver_baja(p_baja uuid, p_confirma boolean) returns void` — confirmar: la baja queda `confirmada` y el negocio sigue `oculto`; revertir: la baja queda `revertida` y el negocio vuelve a `sin_reclamar` con `motivo_oculto = null` (sirve también para restaurar una `confirmada`). Exige `es_admin()`.
  - `admin_ocultar_negocio(p_negocio uuid, p_motivo text default null) returns void` — para pedidos por mail o DM: inserta una baja `confirmada` sin usuario y oculta el negocio con `motivo_oculto = 'admin'`. Exige `es_admin()`.

- [ ] **Step 1: Write the failing tests:**
  - `pedir_baja_negocio: oculta en el momento y queda pendiente de revision` — el negocio deja de aparecer en `negocios_cerca` y hay una baja `pendiente`.
  - `pedir_baja_negocio: no se puede sobre un negocio reclamado` (Review Focus 6) y no sobre uno ya oculto.
  - `pedir_baja_negocio: tope de 10 por dia` — la baja 11 del mismo usuario rechaza; otro usuario puede.
  - `admin_resolver_baja: revertir restaura el negocio y confirmar lo deja oculto`.
  - `admin_resolver_baja: restaurar una baja confirmada` — confirmar y luego revertir devuelve `sin_reclamar`.
  - `admin_ocultar_negocio: oculta y queda en admin_bajas('confirmada')`.
  - `un usuario comun no puede usar las funciones admin_*` e `invitado rechaza con permission denied`.

- [ ] **Step 2: Run to verify it fails** — `node --test tests/db/negocios.test.mjs`. Expected: FAIL, "function pedir_baja_negocio does not exist".

- [ ] **Step 3: Write `supabase/migrations/0118_negocio_bajas.sql`** con la tabla (RLS sin policies, `revoke all`) y las cuatro funciones con `grant execute ... to authenticated`.

- [ ] **Step 4: Run to verify it passes** — `node --test tests/db/negocios.test.mjs`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0118_negocio_bajas.sql tests/db/negocios.test.mjs
git commit -m "feat(negocios): pedido de baja inmediata con revision de admin"
```

---

### Task 4: El dueño edita u oculta su negocio (migración 0119)

**Files:**
- Create: `supabase/migrations/0119_negocio_dueno.sql`
- Modify: `tests/db/negocios.test.mjs`

**Interfaces:**
- Consumes: `negocios`, `negocios_cerca` (la Task 1 ya devuelve `es_mio`).
- Produces:
  - `editar_mi_negocio(p_negocio uuid, p_nombre text default null, p_bio text default null, p_telefono text default null, p_tipo text default null, p_lat float8 default null, p_lng float8 default null) returns void` — solo el `owner_id`; cada parámetro no nulo reemplaza el valor (para borrar el teléfono o la bio se manda cadena vacía, que se guarda como `null`); lat y lng tienen que venir juntas; los mismos checks de la tabla. Error `'Este negocio no es tuyo'`.
  - `ocultar_mi_negocio(p_negocio uuid, p_oculto boolean) returns void` — solo el dueño. Ocultar: `estado = 'oculto'`, `motivo_oculto = 'dueno'`. Volver a mostrar: solo si `motivo_oculto = 'dueno'` (si lo ocultó un admin o una baja: `'Lo ocultó el equipo de CercaYa. Escribinos a cercaya@controlapps.ar'`), y vuelve a `reclamado`.
  - Trigger `negocios_owner_borrado` (antes de actualizar `negocios`): si `owner_id` pasa de no nulo a nulo y el estado era `reclamado`, el negocio queda `oculto` con `motivo_oculto = 'cuenta'`.
  - Un negocio oculto no aparece en `negocios_cerca` para nadie, ni para su dueño. El dueño lo vuelve a mostrar desde "Mis negocios" (Task 7), que se alimenta de `mis_negocios() returns table (id uuid, nombre text, bio text, telefono text, tipo text, lat float8, lng float8, estado text, motivo_oculto text)`: los negocios cuyo `owner_id = auth.uid()`, incluidos los ocultos.

- [ ] **Step 1: Write the failing tests:**
  - `editar_mi_negocio: el dueño cambia nombre, bio, telefono y tipo` y `un tercero no puede editar` (rechaza `/no es tuyo/`).
  - `editar_mi_negocio: cadena vacia borra el telefono; lat sin lng rechaza`.
  - `ocultar_mi_negocio: oculta, desaparece de negocios_cerca y vuelve a mostrarse`.
  - `ocultar_mi_negocio: no vuelve a mostrar uno ocultado por el equipo`.
  - `borrar la cuenta del dueño deja el negocio oculto, no reclamado sin dueño` (Review Focus 5) — borrar el `profiles` (o el `auth.users`) del dueño como superusuario; `estado = 'oculto'`, `motivo_oculto = 'cuenta'`, `owner_id is null`.
  - `mis_negocios: lista los propios, incluidos los ocultos, y no los ajenos`.
  - `invitado rechaza con permission denied`.

- [ ] **Step 2: Run to verify it fails** — `node --test tests/db/negocios.test.mjs`. Expected: FAIL, "function editar_mi_negocio does not exist".

- [ ] **Step 3: Write `supabase/migrations/0119_negocio_dueno.sql`** con las tres funciones, el trigger y los `grant execute ... to authenticated`.

- [ ] **Step 4: Run to verify it passes** — `node --test tests/db/negocios.test.mjs`, y después `npm run test:db` completo. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0119_negocio_dueno.sql tests/db/negocios.test.mjs
git commit -m "feat(negocios): el dueno edita u oculta su negocio"
```

---

### Task 5: Script de carga desde planilla

**Files:**
- Create: `scripts/negocios-csv.mjs` (lógica pura: parsear y validar filas)
- Create: `scripts/cargar_negocios.mjs` (comando)
- Create: `tests/db/negocios-csv.test.mjs`
- Create: `scripts/negocios-ejemplo.csv`

**Interfaces:**
- Consumes: `cargar_negocio(...)` (Task 1); el patrón de acceso a la base de `.tmp/q.mjs` (Management API: `POST https://api.supabase.com/v1/projects/jmgoquaxvmzqjkrnfcwo/database/query` con `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`, cuerpo `{ query }`).
- Produces: `parsearCsv(texto: string, catalogoIds: Set<string>): { filas: FilaNegocio[]; errores: { linea: number; motivo: string }[] }` con `FilaNegocio = { instagram: string; nombre: string; rubro: string; tipo: 'local' | 'a_domicilio'; lat: number; lng: number; telefono: string | null; bio: string | null }`. Columnas del CSV: `instagram,nombre,rubro,tipo,lat,lng,telefono,bio` (con encabezado, separador coma, campos entre comillas dobles permitidos). Validaciones: rubro en `catalogoIds`; tipo válido; lat/lng numéricos y dentro de la zona (`lat` entre -34.0 y -33.5, `lng` entre -60.2 y -59.7, el entorno de Ramallo); instagram normalizado igual que `cargar_negocio`; duplicados dentro del mismo archivo. `node scripts/cargar_negocios.mjs <archivo.csv> [--aplicar]` sin `--aplicar` solo valida e imprime un resumen (modo prueba); con `--aplicar` ejecuta `select cargar_negocio(...)` por fila, con parámetros escapados, e informa cuáles ya existían.

- [ ] **Step 1: Write the failing tests** en `tests/db/negocios-csv.test.mjs` (corren con `node --test`, entran en `npm run test:db`):
  - `parsearCsv: lee una fila valida` con el `scripts/negocios-ejemplo.csv` (2 filas de ejemplo: un `local` con teléfono y un `a_domicilio` sin teléfono).
  - `parsearCsv: normaliza @Instagram y acepta comillas con comas`.
  - `parsearCsv: rechaza rubro desconocido, tipo invalido, coordenadas fuera de zona o no numericas, e Instagram repetido` — cada error trae `linea` (contando el encabezado como línea 1) y `motivo` en castellano.
  - `parsearCsv: una fila mala no impide leer las buenas`.

- [ ] **Step 2: Run to verify it fails** — `node --test tests/db/negocios-csv.test.mjs`. Expected: FAIL, no existe `scripts/negocios-csv.mjs`.

- [ ] **Step 3: Implement `parsearCsv` en `scripts/negocios-csv.mjs`** (sin dependencias nuevas; un parser de CSV simple con comillas dobles alcanza), y `scripts/cargar_negocios.mjs` que lee los ids del catálogo con `select id from habilidades_catalogo`, valida con `parsearCsv`, y en modo `--aplicar` carga fila por fila (los errores de una fila no frenan el resto). El token sale de la variable de entorno `SUPABASE_ACCESS_TOKEN`, nunca del repo.

- [ ] **Step 4: Run to verify it passes** — `node --test tests/db/negocios-csv.test.mjs`. Expected: PASS. Después, modo prueba real contra producción (solo lectura): `node scripts/cargar_negocios.mjs scripts/negocios-ejemplo.csv` debe imprimir "2 filas válidas, 0 errores" sin escribir nada.

- [ ] **Step 5: Commit**

```bash
git add scripts/negocios-csv.mjs scripts/cargar_negocios.mjs scripts/negocios-ejemplo.csv tests/db/negocios-csv.test.mjs
git commit -m "feat(negocios): script de carga desde planilla CSV"
```

---

### Task 6: Capa de la app (tipos, llamadas y textos)

**Files:**
- Create: `movil/src/lib/negocios.ts`
- Create: `movil/src/lib/negocios.test.ts`

**Interfaces:**
- Consumes: `supabase` de `./supabase`; las funciones de las Tasks 1–4.
- Produces (las usa la Task 7 y la 8):
  - `export const INSTAGRAM_OFICIAL = 'cercaya'`
  - `export type Negocio = { id: string; nombre: string; rubro: string; bio: string | null; instagram_usuario: string; tipo: 'local' | 'a_domicilio'; telefono: string | null; estado: 'sin_reclamar' | 'reclamado'; distancia_km: number | string | null; lat: number; lng: number; es_mio: boolean }`
  - `export const buscarNegocios = (texto: string, radioKm = 15) => Promise<Negocio[]>` (rpc `negocios_cerca`)
  - `export const reclamarNegocio = (id: string, email: string) => Promise<string>`; `export const miReclamo = (id: string) => Promise<{ codigo: string; vence_at: string } | null>`; `export const pedirBajaNegocio = (id: string, motivo?: string) => Promise<void>`
  - `export const misNegocios`, `editarMiNegocio`, `ocultarMiNegocio` (rpc `mis_negocios`, `editar_mi_negocio`, `ocultar_mi_negocio`)
  - Puros (con prueba): `urlInstagram(usuario: string): string` → `https://instagram.com/<usuario>`; `urlInstagramOficial(): string`; `textoMensajeCodigo(codigo: string): string` → el texto que el dueño manda por DM (`Hola! Quiero reclamar mi negocio en CercaYa. Mi código es <CODIGO>`); `diasRestantes(vence: string, ahora?: Date): number` (redondea para arriba, mínimo 0); `urlWhatsApp(telefono: string): string | null` reutilizando `./telefono` si ya tiene un normalizador (leerlo antes de escribir uno nuevo).

- [ ] **Step 1: Write the failing test** en `movil/src/lib/negocios.test.ts` (mismo estilo que `trabajo.test.ts`, import con `.ts`): `urlInstagram` y `urlInstagramOficial` (`'https://instagram.com/cercaya'`); `textoMensajeCodigo('A3F9C2')` contiene el código y `@cercaya` no hace falta; `diasRestantes` con 6 días y 1 hora → 7, con fecha pasada → 0; `urlWhatsApp` devuelve `null` para vacío o basura.

- [ ] **Step 2: Run to verify it fails** — `cd movil && npm test`. Expected: FAIL, falta `./negocios.ts`.

- [ ] **Step 3: Implement `movil/src/lib/negocios.ts`** con las firmas de Interfaces. Las funciones que llaman a la base usan el mismo ayudante `rpc` que `contactos.ts` (copiar su forma: lanza el error de Supabase si lo hay). Los puros no importan Supabase, para poder probarlos con `node --test` (poner los puros arriba y el import de `supabase` solo en las funciones de red, o separar en un archivo `negociosTexto.ts` si el import rompe la prueba).

- [ ] **Step 4: Run to verify it passes** — `cd movil && npm test && npm run typecheck`. Expected: PASS y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add movil/src/lib/negocios.ts movil/src/lib/negocios.test.ts
git commit -m "feat(negocios): capa de la app para negocios"
```

---

### Task 7: Negocios en el mapa de Trabajo y pantalla del negocio

**Files:**
- Modify: `movil/src/components/MapaTrabajo.tsx` (segunda búsqueda, pines, tarjeta)
- Create: `movil/src/components/PinNegocio.tsx`
- Create: `movil/src/app/negocio/[id].tsx` (ficha + reclamar + pedir baja)
- Create: `movil/src/app/mis-negocios.tsx` (editar, ocultar/mostrar)
- Modify: `movil/src/app/(tabs)/perfil.tsx` (o el archivo de Perfil que corresponda): entrada "Mis negocios" solo si `misNegocios()` devuelve algo
- Modify: `movil/src/lib/trabajo.ts` si hace falta un tipo/ayuda compartida (no cambiar `consultaValida` ni `nuevaSecuencia`)

**Interfaces:**
- Consumes: Task 6 completa; `consultaValida`, `nuevaSecuencia`, `RADIO_BASE`, `RADIO_MAX`, `textoDistancia`, componentes `Boton`, `Texto`, `Titulo`, `Chip`, `colores`.
- Produces: la experiencia de usuario; sin interfaces para otras tareas.

- [ ] **Step 1: Leer antes de tocar.** Abrir `MapaTrabajo.tsx` completo (el efecto de búsqueda con espera, `elegir`, la tarjeta inferior, `estilosPin`) y `movil/src/app/persona/[id].tsx` (patrón de pantalla con ficha). Anotar cómo se maneja el estado `vacio`/`buscando` para sumar los negocios sin romperlo.

- [ ] **Step 2: En `MapaTrabajo.tsx`**, dentro del mismo efecto de búsqueda, pedir `buscarNegocios(texto, radioKm)` en paralelo a `buscarServicio(...)` (`Promise.all`; si la de negocios falla, mostrar igual a las personas y no marcar error). Guardar en un estado `negocios: Negocio[]`; con "Solo disponibles" activo no se muestran negocios (no tienen disponibilidad). El estado "vacío" y el mensaje "Buscar más lejos" tienen que contar personas + negocios. Los negocios se dibujan con `<PinNegocio>` (un `Marker` por negocio, `key = negocio.id`); al tocarlos se abre una tarjeta propia (`seleccionadoNegocio`) que se excluye mutuamente con la de personas. Tarjeta: nombre, rubro, "Perfil sin reclamar" si corresponde, distancia, y botones según los datos: **WhatsApp** (solo si `urlWhatsApp(telefono)` no es nulo), **Instagram** (abre `urlInstagram`), **Ver negocio** (navega a `/negocio/[id]`). Sin botón de chat.

- [ ] **Step 3: `PinNegocio.tsx`** — pin distinto al de las personas: forma de pin cuadrado redondeado (no círculo) con ícono de tienda (`Store` de `lucide-react-native`, ya instalada en el proyecto); relleno naranja si está reclamado, blanco con borde naranja si está sin reclamar. Letra mínima 13 si lleva texto.

- [ ] **Step 4: `negocio/[id].tsx`** — no hay una función para pedir un negocio por id, así que la pantalla recibe los datos por parámetros de ruta desde la tarjeta del mapa (`id`, `nombre`, `rubro`, `bio`, `instagram_usuario`, `estado`, `es_mio`, `telefono`, `tipo`). Muestra los datos y, según el caso:
  - `sin_reclamar`: botón **"Es mío"** → pide el mail (precargado con el de la sesión), llama `reclamarNegocio`, y muestra el código grande con las instrucciones: "Mandanos este código por mensaje directo a @cercaya desde la cuenta de Instagram del negocio. Vence en N días" y un botón que abre `urlInstagramOficial()`. Si ya hay reclamo vigente (`miReclamo`) lo muestra directamente. Y el botón **"Esto no es mío / sacalo"** → confirmación con motivo opcional → `pedirBajaNegocio` → vuelve al mapa con el mensaje "Listo, lo sacamos del mapa".
  - `reclamado` y `es_mio`: botón "Editar mi negocio" (lleva a `/mis-negocios`).
  - `reclamado` y no es mío: solo ver datos y WhatsApp/Instagram.
  - Los errores de las funciones (tope de reclamos, etc.) se muestran con `Alert.alert('No se pudo', error.message)` como en `admin.tsx`.

- [ ] **Step 5: `mis-negocios.tsx`** — lista de `misNegocios()`; por cada uno, formulario de edición (nombre, bio, teléfono, tipo `local`/`a_domicilio` con `Chip`, y "Usar mi ubicación actual" que toma `useUbicacion().origen`) que llama `editarMiNegocio`, más el interruptor "Mostrar en el mapa" que llama `ocultarMiNegocio`; si el negocio está oculto por el equipo, el interruptor queda deshabilitado con el texto del error del servidor. Entrada desde Perfil solo cuando hay negocios propios.

- [ ] **Step 6: Verificar tipos y pruebas** — `cd movil && npm run typecheck && npm test`. Expected: sin errores. Después `npx expo export --platform android` para comprobar que compila el paquete.

- [ ] **Step 7: Probar en pantalla contra producción** (después de aplicar las migraciones 0116–0120, Task 9): cargar 3 negocios de prueba con el script (un `local` con teléfono, un `a_domicilio`, uno con rubro distinto), abrir la app, modo Trabajo, buscar el rubro, comprobar: pin distinto, el `a_domicilio` no muestra teléfono, "Es mío" muestra el código, "sacalo" lo hace desaparecer. Capturas de pantalla para Diego.

- [ ] **Step 8: Commit**

```bash
git add movil/src
git commit -m "feat(negocios): negocios en el mapa de Trabajo, ficha, reclamo y baja"
```

---

### Task 8: Pestañas de Reclamos y Bajas en Administración

**Files:**
- Modify: `movil/src/app/admin.tsx`
- Modify: `movil/src/lib/negocios.ts` (llamadas de admin)

**Interfaces:**
- Consumes: `admin_reclamos_pendientes`, `admin_resolver_reclamo`, `admin_bajas`, `admin_resolver_baja`, `admin_ocultar_negocio` (Tasks 2–3).
- Produces: en `negocios.ts`, `adminReclamos()`, `adminResolverReclamo(id: string, aprueba: boolean)`, `adminBajas(estado: 'pendiente' | 'confirmada')`, `adminResolverBaja(id: string, confirma: boolean)`.

- [ ] **Step 1: Agregar al tipo `Vista` de `admin.tsx`** `'reclamos' | 'bajas'` y a la fila de `Chip` ("Reclamos", "Bajas"). `cargar()` ya ramifica por `vista`: sumar las dos ramas con sus estados (`reclamos`, `bajas`) y limpiarlos al cambiar de pestaña como hacen los existentes.

- [ ] **Step 2: Tarjeta de reclamo** — muestra nombre del negocio, `@instagram_usuario` (toque abre `urlInstagram`), quién reclama, su mail, el **código en grande** y "vence en N días". Botones "Aprobar" y "Rechazar" con confirmación (`Alert.alert`), que llaman `adminResolverReclamo` y recargan.

- [ ] **Step 3: Tarjeta de baja** — negocio, quién la pidió, motivo, fecha. En la pestaña Bajas, un selector chico "Pendientes | Ocultos" (usa `adminBajas('pendiente')` / `adminBajas('confirmada')`): pendientes con "Confirmar" y "Devolver al mapa"; ocultos con "Devolver al mapa".

- [ ] **Step 4: Verificar** — `cd movil && npm run typecheck`. Probar en pantalla con la cuenta admin (`basebalbuss@gmail.com`): reclamar un negocio de prueba con una cuenta demo, ver el código en la pestaña, aprobar, comprobar que el demo ve "Mis negocios".

- [ ] **Step 5: Commit**

```bash
git add movil/src/app/admin.tsx movil/src/lib/negocios.ts
git commit -m "feat(negocios): pestañas de reclamos y bajas en administracion"
```

---

### Task 9: Textos legales, producción y entrega

**Files:**
- Modify: `app/privacidad/page.tsx`
- Modify: `app/soporte/page.tsx`
- Modify: `CLAUDE.local.md` (sección nueva "NEGOCIOS RECLAMABLES")

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: producción actualizada. **Los pasos 3 a 6 publican cosas hacia afuera: pedir el ok de Diego antes de cada uno.**

- [ ] **Step 1: `app/privacidad/page.tsx`** — agregar la sección "Negocios en el mapa": qué mostramos (nombre, rubro, Instagram y datos públicos del negocio; los que trabajan desde su casa aparecen con ubicación aproximada y sin teléfono), de dónde sale (la cuenta pública de Instagram), y que se puede pedir la baja en cualquier momento desde la app o escribiendo a `cercaya@controlapps.ar` o por mensaje a `@cercaya`. Seguir el estilo y los componentes de la página actual; leer `node_modules/next/dist/docs/` si se toca algo de Next que no sea texto (aviso de `AGENTS.md`: esta versión de Next tiene cambios).

- [ ] **Step 2: `app/soporte/page.tsx`** — agregar "Quiero sacar o reclamar mi negocio": los dos caminos (en la app: botón en la ficha; sin cuenta: mail o DM a `@cercaya`) y que sacarlo es inmediato apenas lo recibimos. Verificar con `npm run build` en la raíz (o `npx tsc --noEmit`) que la web compila.

- [ ] **Step 3 (pedir ok): Aplicar las migraciones 0116–0120 a producción** por la Management API (como se hizo con 0109–0115; helper `.tmp/q.mjs`), una por una, en orden, y comprobar con una consulta de solo lectura que existen las tablas y funciones, y que `anon` no tiene permisos (`select has_table_privilege('anon','public.negocios','select')` → `false`).

- [ ] **Step 4 (pedir ok): Cargar los primeros negocios** — Diego pasa la planilla; correr `node scripts/cargar_negocios.mjs <csv>` en modo prueba, mostrar el resumen, y con su ok `--aplicar`.

- [ ] **Step 5 (pedir ok): Publicar la app** — los cambios son solo JavaScript, así que alcanzan con una actualización por internet para los APK 1.2.0: `cd movil && npm run actualizar:prueba -- "negocios reclamables"` (desde la rama `negocios`: EAS Update publica lo que hay en disco). Verificar en Perfil que muestra el id nuevo de la actualización.

- [ ] **Step 6 (pedir ok): Publicar la web** — `npx vercel@latest deploy --prod --yes --token $VERCEL_TOKEN` desde la raíz del worktree, y abrir `/privacidad` y `/soporte` para comprobar el texto nuevo.

- [ ] **Step 7: Registrar en `CLAUDE.local.md`** una sección "NEGOCIOS RECLAMABLES (15/11/2026)": rama `negocios` y worktree, migraciones 0116–0120, cómo cargar con el script, cuenta `@cercaya`, qué queda para después (entrar con Instagram, enriquecer con Business Discovery, fotos), y el gotcha de que la rama sale de `encuentro`. Commit y push (`env -u GITHUB_TOKEN git push`).

```bash
git add app CLAUDE.local.md
git commit -m "docs(negocios): textos legales y registro del trabajo"
```
