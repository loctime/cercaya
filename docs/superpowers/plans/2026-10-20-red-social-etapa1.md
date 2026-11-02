# CercaYa red social — Etapa 1 (mapa, perfiles y contactos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario con cuenta vea en un mapa a sus contactos aceptados (ubicación aproximada, actualizada cada 10 minutos con la app abierta), administre contactos y tenga un perfil con currículum y oficios.

**Architecture:** Supabase (Postgres con RLS y funciones `security definer`, mismo patrón que `0002`–`0015`) guarda contactos, currículum y oficios. El servidor nunca manda coordenadas exactas: `mapa_contactos()` difumina con una grilla de 0,003° con desplazamiento estable por usuario. La app Expo (`movil/`) suma una pestaña Mapa y una pestaña Contactos, un perfil social y un refresco periódico de ubicación en primer plano.

**Tech Stack:** Postgres/PGlite para tests (`tests/db/`), Expo SDK 57 + expo-router, react-native-maps, expo-location, `node --test` con TypeScript para helpers puros.

**Spec:** `docs/superpowers/specs/2026-10-20-red-social-mapa-design.md`

**Fuera de esta etapa (planes aparte):** capa pública y búsqueda por oficio (etapa 2), ubicación en segundo plano / permiso "siempre" (etapa 2), modo encuentro con brújula y alarma (etapa 3).

## Global Constraints

- Trabajar en un worktree propio: `git worktree add ../CercaYa-red-social -b red-social v2-expo`. El árbol principal tiene cambios sin commitear de otra sesión (`movil/package.json`, `pedidos-cerca.tsx`, `tests/db/v2.test.mjs`); no tocarlos ni commitearlos.
- Migraciones nuevas numeradas `0100_*.sql` en adelante (deben correr DESPUÉS de `0090_permisos.sql`, que revoca todo y otorga una lista cerrada). Cada migración termina con `revoke ... from public, anon, authenticated` y `grant` explícito de lo que crea: en Supabase cada objeto nuevo nace con todos los permisos.
- Escrituras por funciones `security definer` con `set search_path = public`; tablas con RLS activado; grants por columna.
- Nunca se envía al cliente la coordenada exacta de otra persona. Solo el punto difuminado de `difuminar()`.
- Constantes del spec: celda de contactos `0.003` grados (~300 m); ubicación "desactualizada" pasados 30 minutos; deja de mostrarse pasadas 24 horas; refresco cada 10 minutos; edad mínima 18 (ya vigente); límite de solicitudes de contacto: 20 por día (decisión de este plan, el spec solo dice "límite por día").
- Español rioplatense en textos de UI; fechas DD/MM/AAAA; sin signo de apertura `¿` ni `¡`, solo los de cierre. Mensajes de error de funciones SQL sin tildes (como las migraciones existentes).
- Antes de tocar APIs de Expo, leer `movil/AGENTS.md` (docs versionadas para SDK 57). Correr `npm run typecheck` y `npx expo lint` en `movil/` antes de dar una tarea por terminada.
- No aplicar migraciones a la base de producción (`jmgoquaxvmzqjkrnfcwo`) ni publicar updates sin autorización explícita de Diego.

## Review Focus

- Usuario con `share_location = false` o sin ubicación nunca aparece en `mapa_contactos()` de nadie (Task 5).
- Un bloqueo en cualquier dirección esconde al otro del mapa y del buscador, y rechaza solicitudes (Tasks 3 y 5).
- Promediar muchas actualizaciones de una misma persona no revela su punto real: dos posiciones dentro de la misma celda dan el mismo punto difuminado (Task 1).
- `anon` y `authenticated` ya no pueden leer `profiles.approx_lat/approx_lng` (hoy cualquiera lee la zona de ~1 km de todos, aunque no comparta) (Task 2).
- Solicitud mutua cruzada (A→B y B→A) termina en un único contacto aceptado, no en dos filas (Task 3).
- Ubicación con más de 24 horas no se muestra; con más de 30 minutos se marca desactualizada (Task 5 y Task 6).
- Invitado (sin cuenta) en la pestaña Mapa o Contactos ve la invitación a entrar, no un error (Tasks 8 y 9).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0100_difuminar.sql` | `difuminar()` |
| `supabase/migrations/0101_compartir_ubicacion.sql` | `share_location` + cerrar lectura de `approx_*` |
| `supabase/migrations/0102_contactos.sql` | tabla `contacts` y funciones de contactos |
| `supabase/migrations/0103_curriculum.sql` | `cv_entries`, `oficios` |
| `supabase/migrations/0104_mapa_contactos.sql` | `mapa_contactos()` |
| `tests/db/social.test.mjs` | tests de todo lo anterior |
| `movil/src/lib/tiempo.ts` + `tiempo.test.ts` | helpers puros de "hace X" y de cuándo refrescar |
| `movil/src/lib/compartirUbicacion.tsx` | refresco periódico + interruptor de compartir |
| `movil/src/lib/contactos.ts` | tipos y llamadas RPC de contactos |
| `movil/src/app/(tabs)/mapa.tsx` | pestaña Mapa |
| `movil/src/app/(tabs)/contactos.tsx` | pestaña Contactos |
| `movil/src/app/persona/[id].tsx` | perfil social de otra persona |
| `movil/src/app/editar-curriculum.tsx` | editar currículum y oficios propios |

---

### Task 0: Worktree y base de pruebas

**Files:**
- Modify: `package.json` (raíz) — scripts `test` y `test:db` pasan a `node --test tests/db/*.test.mjs`

- [ ] **Step 1:** Crear el worktree (ver Global Constraints), `npm install` en la raíz y en `movil/`.
- [ ] **Step 2:** Cambiar los scripts de test de la raíz para que corran todos los `tests/db/*.test.mjs`.
- [ ] **Step 3:** Correr `npm test` en la raíz. Expected: los tests existentes de `v2.test.mjs` pasan (línea base).
- [ ] **Step 4: Commit** `chore: tests de base corren todos los archivos de tests/db`

### Task 1: `difuminar()`

**Files:**
- Create: `supabase/migrations/0100_difuminar.sql`
- Create: `tests/db/social.test.mjs`

**Interfaces:**
- Produces: `public.difuminar(p_lat float8, p_lng float8, p_user uuid, p_celda float8) returns table (lat float8, lng float8)`, `immutable`.

- [ ] **Step 1: Escribir tests en `social.test.mjs`** (con `crearDb` y `RAMALLO` de `harness.mjs`, mismo `before/after` que `v2.test.mjs`):
  - `difuminar es determinista`: dos llamadas con los mismos argumentos devuelven lo mismo.
  - `difuminar queda a menos de media celda por eje`: para 50 puntos aleatorios alrededor de `RAMALLO`, `abs(lat_out - lat_in) <= 0.0015 + 1e-9` y lo mismo en `lng`, con `p_celda = 0.003`.
  - `dos puntos dentro de la misma celda dan el mismo punto`: desplazar 0,0005° dentro de una celda no cambia el resultado (buscar un punto base cuyo desplazamiento no cruce borde; si cruza, probar con el opuesto).
  - `usuarios distintos en el mismo lugar no coinciden siempre`: con 20 uuids distintos hay al menos 2 resultados distintos.
- [ ] **Step 2:** Correr `node --test tests/db/social.test.mjs`. Expected: FAIL `function difuminar does not exist`.
- [ ] **Step 3:** Implementar `difuminar` en SQL. Algoritmo: `off_lat = (mod(abs(hashtext(p_user::text || 'lat')::bigint), 10000) / 10000.0) * p_celda` (ídem `off_lng` con `'lng'`); `lat = (floor((p_lat + off_lat) / p_celda) + 0.5) * p_celda - off_lat` (ídem lng). Al final: `revoke execute ... from public, anon, authenticated; grant execute ... to authenticated`.
- [ ] **Step 4:** Correr el test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): difuminar ubicaciones en grilla con desplazamiento estable`

### Task 2: Compartir ubicación y cerrar `approx_*`

**Files:**
- Create: `supabase/migrations/0101_compartir_ubicacion.sql`
- Modify: `tests/db/social.test.mjs`

**Interfaces:**
- Produces: columna `profile_private.share_location boolean not null default false`, editable por su dueño.

- [ ] **Step 1: Tests:**
  - `share_location arranca apagado y solo lo edita su dueño`: el dueño hace `update profile_private set share_location = true where user_id = $1` y funciona; otro usuario afecta 0 filas.
  - `nadie lee approx_lat de profiles`: `db.como(null, ...)` y `db.como(usuario, ...)` con `select approx_lat from profiles` rechazan con `/permission denied/`; `select id, full_name, avatar_url, zone_label from profiles` sigue funcionando.
- [ ] **Step 2:** Correr. Expected: FAIL.
- [ ] **Step 3:** Migración: `alter table profile_private add column share_location ...`; `grant update (share_location) on profile_private to authenticated`; `revoke select on public.profiles from anon, authenticated` y `grant select (id, full_name, avatar_url, zone_label, is_admin, created_at) on public.profiles to anon, authenticated`.
- [ ] **Step 4:** Verificar que nada en la app o la web lee esas columnas: `grep -rn "approx_l" movil/src app lib` (solo debe aparecer lo de `jobs`, que es otra tabla). Correr `npm test` completo. Expected: PASS, incluidos los tests viejos.
- [ ] **Step 5: Commit** `feat(db): interruptor de compartir ubicacion y cierre de approx en profiles`

### Task 3: Contactos

**Files:**
- Create: `supabase/migrations/0102_contactos.sql`
- Modify: `tests/db/social.test.mjs`

**Interfaces:**
- Produces (todas `security definer`, ejecutables por `authenticated`):
  - `es_contacto(a uuid, b uuid) returns boolean` (también ejecutable por `anon`, se usa en policies)
  - `solicitar_contacto(p_destino uuid) returns uuid`
  - `responder_contacto(p_solicitud uuid, p_acepta boolean) returns void`
  - `quitar_contacto(p_otro uuid) returns void`
  - `mis_contactos() returns table (contact_id uuid, user_id uuid, full_name text, avatar_url text, estado text)` con `estado in ('aceptado','recibida','enviada')`
  - `buscar_usuarios(p_texto text) returns table (user_id uuid, full_name text, avatar_url text, estado text)` — por nombre (mínimo 3 caracteres, `ilike`, máx. 20) o por teléfono (si `p_texto` tiene 8 o más dígitos, coincide con los últimos 8 dígitos de `profile_private.phone`). Excluye al propio usuario y bloqueados. `estado` es null si no hay relación. Nota: no existe campo "usuario" en la base; el "por usuario" del spec se resuelve por nombre.
- Tabla `contacts(id uuid pk, requester_id, addressee_id, status text check in ('pendiente','aceptado'), created_at, responded_at)` con `check (requester_id <> addressee_id)` e índice único `(least(requester_id, addressee_id), greatest(requester_id, addressee_id))`. RLS activado, sin grants directos (todo por funciones).

- [ ] **Step 1: Tests** (cada uno con usuarios creados por `db.usuario`):
  - `solicitar y aceptar deja a los dos como contactos`: A solicita a B; `mis_contactos()` de B muestra `recibida`, el de A `enviada`; B acepta; ambos ven `aceptado` y `es_contacto(A,B)` y `es_contacto(B,A)` son true.
  - `rechazar borra la solicitud`: B rechaza; ya no hay fila; A puede volver a solicitar.
  - `solicitudes cruzadas se unifican`: A→B y luego B→A termina con una sola fila `aceptado`.
  - `no podes agregarte a vos mismo` rechaza con `/vos mismo/`.
  - `solicitud duplicada` rechaza con `/Ya son contactos o hay una solicitud/`.
  - `bloqueo en cualquier direccion`: con una fila en `blocks`, `solicitar_contacto` rechaza con `/No se puede enviar la solicitud/` y `buscar_usuarios` no devuelve a esa persona.
  - `limite de 20 solicitudes por dia`: la solicitud 21 en 24 horas rechaza con `/Limite diario/`.
  - `solo el destinatario responde`: el solicitante llamando `responder_contacto` rechaza con `/No podes responder/`.
  - `buscar_usuarios por telefono`: encuentra por los últimos 8 dígitos y no devuelve el teléfono en las columnas.
  - `invitado no puede` usar ninguna de las funciones: `db.como(null, ...)` rechaza con `/permission denied/`.
- [ ] **Step 2:** Correr. Expected: FAIL.
- [ ] **Step 3:** Implementar migración. Mensajes de error exactamente los de los tests. `solicitar_contacto`: si ya existe fila inversa `pendiente`, la acepta y devuelve su id.
- [ ] **Step 4:** Correr tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): contactos con aceptacion mutua, busqueda y limite diario`

### Task 4: Currículum y oficios

**Files:**
- Create: `supabase/migrations/0103_curriculum.sql`
- Modify: `tests/db/social.test.mjs`

**Interfaces:**
- Consumes: `es_contacto(uuid, uuid)` de Task 3.
- Produces tablas:
  - `cv_entries(id uuid pk default gen_random_uuid(), user_id uuid fk profiles on delete cascade, titulo text 1..80, lugar text <=80 null, desde_anio int 1950..2100, hasta_anio int null check (hasta_anio >= desde_anio), descripcion text <=500 null, created_at)`
  - `oficios(user_id uuid fk profiles on delete cascade, label text 2..40, category_id int null fk categories, primary key (user_id, label))`
- Límites por trigger: máx. 20 filas de `cv_entries` y 15 de `oficios` por usuario.
- RLS: `select` si `user_id = auth.uid()` o `es_contacto(auth.uid(), user_id)`; `insert/update/delete` solo del dueño. Grants por columna (sin `user_id` editable en update).

- [ ] **Step 1: Tests:**
  - `el dueño crea y edita su currículum`; otro usuario no contacto lee 0 filas; un contacto aceptado sí las lee.
  - `no se puede escribir en el currículum de otro` (insert con `user_id` ajeno rechaza).
  - `hasta_anio menor que desde_anio` rechaza.
  - `limite de 15 oficios` rechaza el 16.º con `/hasta 15/`.
  - `oficio con categoria de CercaYa` guarda `category_id`; `label` libre sin categoría también.
- [ ] **Step 2:** Correr. Expected: FAIL.
- [ ] **Step 3:** Implementar migración con RLS, grants y triggers de límite (mismo estilo que `limitar_fotos_galeria` en `0003`).
- [ ] **Step 4:** Correr tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): curriculum y oficios visibles para contactos`

### Task 5: `mapa_contactos()`

**Files:**
- Create: `supabase/migrations/0104_mapa_contactos.sql`
- Modify: `tests/db/social.test.mjs`

**Interfaces:**
- Consumes: `es_contacto`, `difuminar`, `bloqueado`.
- Produces: `mapa_contactos() returns table (user_id uuid, full_name text, avatar_url text, lat float8, lng float8, actualizada_at timestamptz, desactualizada boolean)`; `security definer`, `stable`, ejecutable por `authenticated`. Incluye solo contactos `aceptado`, con `share_location = true`, `lat/lng` no nulos, `location_updated_at > now() - interval '24 hours'` y sin bloqueo. `desactualizada = location_updated_at < now() - interval '30 minutes'`. Usa celda `0.003`.

- [ ] **Step 1: Tests:**
  - `un contacto que comparte aparece, con punto difuminado distinto al exacto` y diferencia dentro de media celda por eje.
  - `no aparece si share_location es false` (el caso por defecto).
  - `no aparece un no contacto ni una solicitud pendiente`.
  - `no aparece si esta bloqueado`.
  - `no aparece con mas de 24 horas` y `desactualizada` verdadero entre 30 minutos y 24 horas (fijar `location_updated_at` con `db.sql` directo).
  - `no se ve a uno mismo`.
  - `la respuesta no tiene columnas de coordenadas exactas ni telefono`: `Object.keys(fila)` es exactamente la lista de columnas del contrato.
- [ ] **Step 2:** Correr. Expected: FAIL.
- [ ] **Step 3:** Implementar y otorgar `execute` solo a `authenticated`.
- [ ] **Step 4:** `npm test` completo en la raíz. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): mapa_contactos con ubicacion difuminada y vencimiento`

### Task 6: Helpers de tiempo (app)

**Files:**
- Create: `movil/src/lib/tiempo.ts`, `movil/src/lib/tiempo.test.ts`

**Interfaces:**
- Produces: `textoHace(iso: string, ahora: Date): string` y `debeActualizar(ultimaIso: string | null, ahora: Date, minutos?: number): boolean` (default 10).

- [ ] **Step 1: Tests** (`node:test`, import con `.ts`, como `telefono.test.ts`):
  - `textoHace`: 20 segundos → `'recién'`; 5 minutos → `'hace 5 min'`; 59 minutos → `'hace 59 min'`; 60 minutos → `'hace 1 h'`; 5 horas → `'hace 5 h'`; 23 h 59 min → `'hace 23 h'`; 24 horas o más → `'hace más de un día'`; fecha en el futuro → `'recién'`.
  - `debeActualizar`: `null` → true; hace 9 min → false; hace 10 min → true; con `minutos = 5` hace 6 min → true.
- [ ] **Step 2:** `cd movil && npm test`. Expected: FAIL (módulo no existe).
- [ ] **Step 3:** Implementar ambas funciones puras.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(movil): helpers de tiempo para ubicacion`

### Task 7: Refresco de ubicación e interruptor de compartir

**Files:**
- Create: `movil/src/lib/compartirUbicacion.tsx`
- Modify: `movil/src/app/_layout.tsx` (montar el provider dentro de `SesionProvider`/`UbicacionProvider`), `movil/src/app/(tabs)/perfil.tsx` (agregar el interruptor)

**Interfaces:**
- Consumes: `debeActualizar` (Task 6), RPC `set_mi_ubicacion(p_lat, p_lng)` existente, `useSesion`.
- Produces: `CompartirUbicacionProvider` y `useCompartirUbicacion(): { compartiendo: boolean; cargando: boolean; activar(): Promise<'ok' | 'denegado' | 'error'>; desactivar(): Promise<void> }`.

- [ ] **Step 1:** Implementar el provider. `activar`: pide permiso en primer plano (`Location.requestForegroundPermissionsAsync`), toma posición con `Accuracy.Balanced`, llama `set_mi_ubicacion` y pone `share_location = true` en `profile_private` del usuario. `desactivar` pone `false`. Mientras `compartiendo` y la app está activa (`AppState`), un intervalo de 60 s revisa `debeActualizar(ultimaIso, new Date())` y, si corresponde, repite toma de posición + `set_mi_ubicacion` (efectivo cada 10 min). Al volver a primer plano, actualiza de inmediato si corresponde. Cuidado existente: `UbicacionProvider` (`movil/src/lib/ubicacion.tsx`) llama `set_mi_ubicacion` al iniciar sesión con el `origen` guardado, que por defecto es el centro de Ramallo y no el GPS. Con `share_location = true`, los contactos verían ese punto falso hasta el primer refresco: hacer que esa llamada se omita cuando `origen.fuente === 'manual'` y el usuario está compartiendo, y que el provider nuevo tome el GPS apenas hay sesión.
- [ ] **Step 2:** En la pantalla de perfil, un interruptor "Compartir mi ubicación con mis contactos" con texto de explicación en criollo (aproximada, solo contactos, se actualiza cada unos 10 minutos con la app abierta, se puede apagar cuando quieras). Si el permiso fue denegado, mostrar el aviso y el atajo a Ajustes.
- [ ] **Step 3:** `npm run typecheck` y `npx expo lint` en `movil/`. Expected: sin errores.
- [ ] **Step 4:** Probar a mano en el celular con Expo Go o el build de desarrollo, contra una base de pruebas (no producción): activar, ver que `location_updated_at` avanza; apagar.
- [ ] **Step 5: Commit** `feat(movil): compartir ubicacion aproximada cada 10 minutos con la app abierta`

### Task 8: Pestaña Mapa

**Files:**
- Create: `movil/src/lib/contactos.ts` (tipos `ContactoMapa`, `Contacto`, `ResultadoBusqueda` y funciones `cargarMapa()`, `cargarContactos()`, `buscar(texto)`, `solicitar(id)`, `responder(id, acepta)`, `quitar(id)` que llaman a las RPC de los Tasks 3 y 5)
- Create: `movil/src/app/(tabs)/mapa.tsx`
- Modify: `movil/src/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: RPC `mapa_contactos`, `textoHace`, `useUbicacion().origen`, `RequiereLogin`.

- [ ] **Step 1:** `mapa.tsx`: `MapView` centrado en `origen`, un `Marker` por contacto; los `desactualizada` se muestran atenuados; el `Callout` dice nombre y "Actualizado {textoHace(actualizada_at, new Date())}" y lleva a `/persona/[id]`. Se recarga con `useFocusEffect` y cada 60 s en primer plano. Si hay cero contactos con ubicación, tarjeta vacía con botón a la pestaña Contactos y nota de cómo compartir la propia. Texto fijo: "Las ubicaciones son aproximadas." Envolver en `RequiereLogin`.
- [ ] **Step 2:** `_layout.tsx` de tabs: orden Mapa, Contactos, Mensajes, Perfil. Las pestañas Inicio, Pedidos y el botón central Pedir pasan a `options={{ href: null }}` (sin borrar archivos: el spec deja pedidos y reseñas intactos pero sin pantalla en la etapa 1). Mapa es la ruta inicial.
- [ ] **Step 3:** `npm run typecheck`, `npx expo lint`. Verificación manual con dos cuentas de prueba contactadas entre sí y compartiendo: cada una ve a la otra; al apagar el interruptor desaparece en la recarga siguiente.
- [ ] **Step 4: Commit** `feat(movil): pestana Mapa con contactos aproximados`

### Task 9: Pestaña Contactos

**Files:**
- Create: `movil/src/app/(tabs)/contactos.tsx`
- Modify: `movil/src/app/(tabs)/_layout.tsx` (ícono `Users` de lucide)

- [ ] **Step 1:** Pantalla con tres bloques: "Solicitudes" (recibidas, botones Aceptar/Rechazar vía `responder`), "Mis contactos" (toca → `/persona/[id]`; menú → `quitar` con confirmación) y buscador ("Buscar por nombre o teléfono", mínimo 3 caracteres, resultados con botón Agregar / Pendiente / Contacto). Los errores del servidor se muestran con `Alert` con el texto que devuelve la función. Envolver en `RequiereLogin`.
- [ ] **Step 2:** `npm run typecheck`, `npx expo lint`. Verificación manual con dos cuentas: solicitar, aceptar, rechazar, quitar; probar solicitud a alguien que te bloqueó (usar `bloquear` de `moderacion.ts`) y ver el mensaje.
- [ ] **Step 3: Commit** `feat(movil): pestana Contactos con solicitudes y busqueda`

### Task 10: Perfil social y edición de currículum

**Files:**
- Create: `movil/src/app/persona/[id].tsx`, `movil/src/app/editar-curriculum.tsx`
- Modify: `movil/src/app/(tabs)/perfil.tsx` (enlace "Mi currículum y oficios")

- [ ] **Step 1:** `persona/[id].tsx`: avatar, nombre y zona (de `profiles`); si es contacto aceptado (o es uno mismo) muestra currículum (`cv_entries` ordenado por `desde_anio` descendente) y oficios; si no, solo nombre y foto, con botón Agregar / Pendiente / Quitar según `estado`. Menú con Bloquear y Denunciar reutilizando `lib/moderacion.ts` y `denunciar.tsx`. Las fechas del currículum se muestran como años.
- [ ] **Step 2:** `editar-curriculum.tsx`: lista editable de experiencias (título, lugar, desde, hasta, descripción) con altas y bajas, y oficios como etiquetas: chips sugeridos desde `useCategorias()` más un campo para escribir uno propio (2 a 40 caracteres). Mostrar el error de límite del servidor.
- [ ] **Step 3:** `npm run typecheck`, `npx expo lint`. Verificación manual con dos cuentas: el currículum de A es invisible para B hasta que son contactos.
- [ ] **Step 4: Commit** `feat(movil): perfil social con curriculum y oficios`

### Task 11: Cierre de etapa

- [ ] **Step 1:** `npm test` en la raíz y en `movil/`, más `npm run typecheck` y `npx expo lint`. Expected: todo verde.
- [ ] **Step 2:** Pedir a Diego autorización para aplicar `0100`–`0104` a la base de producción (`jmgoquaxvmzqjkrnfcwo`) y, con su OK, aplicarlas en orden. Verificar con `select proname from pg_proc where proname in ('difuminar','mapa_contactos','solicitar_contacto')`.
- [ ] **Step 3:** Con autorización de Diego, publicar a prueba con `npm run actualizar:prueba -- "Etapa 1 red social"` en `movil/` (canal `preview`). Si se agregó alguna librería nativa hace falta un build nuevo, no alcanza el update.
- [ ] **Step 4:** Actualizar `CLAUDE.local.md` de CercaYa con el estado de la etapa 1 y la nueva visión.
