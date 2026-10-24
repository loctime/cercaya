# Modo Trabajo en el mapa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un interruptor Amigos | Trabajo en el mapa; en Trabajo, un buscador libre muestra solo a quienes activaron "Ofrezco servicios" y coinciden, con botón "Escribirle" (chat directo).

**Architecture:** Una migración aditiva (0111) agrega la columna `ofrece_servicios`, la función `buscar_servicio` (reusa el catálogo con sinónimos de 0110 y la ubicación difuminada) y un tope de chats nuevos con desconocidos. En la app, un componente nuevo `MapaTrabajo` lleva su propio mapa y buscador; `mapa.tsx` solo suma el selector de modo y decide cuál mostrar.

**Tech Stack:** Postgres/Supabase (PGlite para tests, `node --test`), Expo SDK 57 + Expo Router, react-native-maps, TypeScript (tests con `node --test --experimental-strip-types`).

**Spec:** `docs/superpowers/specs/2026-10-24-modo-trabajo-design.md`

## Global Constraints

- Migración aditiva, número **0111**; cada tabla/función nueva revoca todo y otorga explícito (gotcha de `0090_permisos.sql`).
- Ubicación de quien ofrece: **celda difuminada ~1,6 km** vía `difuminar(lat, lng, user_id, 0.015)`; nunca el punto real.
- Solo ubicaciones con `location_updated_at` de los últimos 7 días; sin bloqueos en ningún sentido (`bloqueado()`); nunca uno mismo.
- Solo aparece quien tiene `ofrece_servicios = true`, sea o no `es_publico`; incluye contactos, marcados con `es_contacto`.
- Búsqueda: desde 2 letras (normalizadas), sin importar tildes ni mayúsculas; hasta 30 resultados, más cercanos primero; radio por defecto 15 km, máximo 50.
- Tope de chats: **10 por día** por persona hacia **no contactos**; no se aplica a contactos ni a reabrir una conversación existente.
- Textos en español rioplatense, sin `¿` ni `¡` de apertura; letra mínima 14; naranja de marca con texto oscuro (`colores.naranja` / `colores.tinta`).
- Sin cambios nativos ni subir `version` de `movil/app.json` (la actualización llega por EAS Update al runtime 1.2.0).
- Nada de contraseñas en archivos versionados (el repo es público).

## Review Focus

0. Las frases de Diego ("Canilla rota", "Reparación canilla", "Arreglar canilla") encuentran a quien ofrece arreglar canillas; hoy las dos primeras no. → Task 1.
1. Texto que normaliza a vacío (`"   "`, `"¿?"`, `"%"`) → devuelve 0 filas sin error (hoy `buscar_habilidades_cerca` trae a todos con un texto así). → Task 1.
2. Quien quita su última habilidad con "Ofrezco servicios" activo → se apaga solo y desaparece de las búsquedas. → Task 1.
3. Activar "Ofrezco servicios" sin ninguna habilidad cargada → rechazado también desde el servidor, no solo desde la app. → Task 1.
4. Tipear rápido: la respuesta lenta de una búsqueda vieja no pisa a la nueva. → Task 2.
5. Buscador sin ubicación propia guardada → lista vacía sin error, y la app lo explica en vez de decir "nadie cerca". → Tasks 1 y 4.

---

## File Structure

- Create `supabase/migrations/0111_modo_trabajo.sql` — columna, triggers, `buscar_servicio`, tope de chats.
- Create `tests/db/trabajo.test.mjs` — pruebas de base de las tres piezas.
- Create `movil/src/lib/trabajo.ts` — tipos, RPC, `consultaValida`, `nuevaSecuencia`.
- Create `movil/src/lib/trabajo.test.ts` — pruebas de las dos funciones puras.
- Create `movil/src/components/SelectorModo.tsx` — interruptor Amigos | Trabajo.
- Create `movil/src/components/MapaTrabajo.tsx` — mapa + buscador + tarjeta + vacío.
- Modify `movil/src/app/(tabs)/mapa.tsx` — monta el selector y alterna modos.
- Modify `movil/src/app/editar-curriculum.tsx` — interruptor "Ofrezco servicios".
- Modify `scripts/bots.mjs` — bots con habilidades y servicio activo.
- Modify `docs/actualizar-app.md` y `CLAUDE.local.md` — estado.

---

### Task 1: Base de datos — ofrece_servicios, buscar_servicio y tope de chats

**Files:**
- Create: `supabase/migrations/0111_modo_trabajo.sql`
- Test: `tests/db/trabajo.test.mjs`

**Interfaces:**
- Consumes: `normalizar_busqueda(text)`, `difuminar(float8,float8,uuid,float8)`, `zona_de(float8,float8,text)`, `distancia_publica(float8)`, `dist_km`, `bloqueado(uuid,uuid)`, `es_contacto(uuid,uuid)`, tablas `oficios`, `habilidades_catalogo` (0110), `abrir_chat(uuid, uuid)` (0004).
- Produces:
  - `profile_private.ofrece_servicios boolean not null default false`, `update` otorgado a `authenticated`.
  - `buscar_servicio(p_texto text, p_radio_km int default 15) returns table (user_id uuid, full_name text, avatar_url text, zona text, distancia_km numeric, oficios text[], coincide text, es_contacto boolean, lat float8, lng float8)` ejecutable por `authenticated`. `coincide` = el `label` de la habilidad que coincidió.
  - `abrir_chat` reemplazada: agrega el tope diario.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/db/trabajo.test.mjs` (mismo arranque que `social.test.mjs`: `crearDb`, `como`, `RAMALLO`, `CERCA`, `VILLA`, `ROSARIO`). Helper de prueba `ofrece(nombre, pos, habilidades = [['Plomero', 'plomero']])`: crea usuario con ubicación, inserta cada habilidad en `oficios (user_id, label, catalog_id, tipo)` y recién después hace `update profile_private set ofrece_servicios = true, location_updated_at = now()`. Pruebas, con estos nombres y aserciones:
  - `buscar_servicio: encuentra por sinónimo y sin tildes` — alguien con `['Arreglar una canilla','arreglar-canilla']`; cada una de estas búsquedas devuelve a esa persona con `coincide === 'Arreglar una canilla'`: `'Canilla rota'`, `'Reparación canilla'`, `'ARREGLAR CANILLA'`, `'canilla pierde'` (los dos primeros son ejemplos reales de Diego y hoy **no** coinciden: ver Step 3, punto 6).
  - `buscar_servicio: no muestra a quien no activó, aunque sea público y tenga oficios` — `es_publico = true`, oficios cargados, `ofrece_servicios = false` → 0 filas.
  - `buscar_servicio: incluye contactos que ofrecen y los marca` — contacto aceptado con servicio activo → aparece con `es_contacto === true`; un desconocido con servicio → `es_contacto === false`.
  - `buscar_servicio: nunca devuelve la ubicación exacta` — `lat/lng` devueltos ≠ los reales y a ≤ 0,03° de ellos.
  - `buscar_servicio: respeta bloqueos, radio y frescura` — bloqueado en cualquier sentido: 0 filas; en `ROSARIO` con radio 15: 0 filas, con radio 50: sigue 0 (≈80 km); con `location_updated_at` de hace 8 días: 0 filas; uno mismo nunca aparece.
  - `buscar_servicio: texto que normaliza a vacío no devuelve nada ni falla` — para `'   '`, `'¿?'`, `'%'`, `'_'`, `''`: `[]`, sin excepción, aunque haya gente activa.
  - `buscar_servicio: sin ubicación propia devuelve vacío sin error` — usuario sin `lat/lng`.
  - `ofrece_servicios: no se puede activar sin habilidades` — `update ... set ofrece_servicios = true` como el propio usuario sin `oficios` → rechaza con `/habilidad/i`.
  - `ofrece_servicios: se apaga solo al borrar la última habilidad` — con 2 oficios: borrar uno deja `true`; borrar el segundo deja `false`; y `buscar_servicio` ya no lo devuelve.
  - `ofrece_servicios: solo el dueño lo edita` — otro usuario intentando `update ... where user_id = <otro>` afecta 0 filas.
  - `abrir_chat: tope de 10 chats nuevos por día con no contactos` — 10 chats con 10 desconocidos distintos funcionan; el 11° falla con `/limite de chats/i` (mensaje de la función: `'Llegaste al limite de chats nuevos de hoy'`).
  - `abrir_chat: el tope no cuenta reabrir ni contactos` — con 10 chats ya abiertos: reabrir uno existente funciona; abrir chat con un contacto nuevo funciona.

- [ ] **Step 2: Correr y ver que fallan** — `node --test tests/db/trabajo.test.mjs` → FAIL (la función y la columna no existen).

- [ ] **Step 3: Escribir `0111_modo_trabajo.sql`**:
  1. `alter table public.profile_private add column ofrece_servicios boolean not null default false;` + `grant update (ofrece_servicios) on public.profile_private to authenticated;`
  2. Trigger `before update` en `profile_private` (función `validar_ofrece_servicios()`): si `new.ofrece_servicios` y no existe fila en `oficios` de ese usuario → `raise exception 'Cargá al menos una habilidad para ofrecer servicios'`.
  3. Trigger `after delete` en `oficios`, por fila (función `apagar_ofrece_si_sin_habilidades()`, `security definer`): si el usuario ya no tiene `oficios`, `update profile_private set ofrece_servicios = false`.
  4. `buscar_servicio(...)`: partir de la lógica de `buscar_habilidades_cerca` (0110) con estas diferencias — filtra `pv.ofrece_servicios` en vez de `es_publico`; **no** excluye contactos y devuelve `es_contacto(auth.uid(), c.id)`; devuelve `coincide` (el `o.label` de la primera habilidad que coincide); y exige `char_length(trim(normalizar_busqueda(p_texto))) >= 2` antes de buscar (si no, 0 filas).
  5. `create or replace function public.abrir_chat(...)` copiando la definición de `0004_pedidos_y_chat.sql` y agregando, **después** del bloque que busca una conversación existente y **antes** del tope por hora: si `not es_contacto(yo, p_other)` y hay `>= 10` conversaciones con `created_by = yo` creadas en las últimas 24 h hacia no contactos → `raise exception 'Llegaste al limite de chats nuevos de hoy'`. Para saber si cada conversación previa fue con un no contacto, contar sobre `conversations` con `created_by = yo` y `not es_contacto(yo, case when user_a = yo then user_b else user_a end)`.
  6. Sinónimos que faltan para los ejemplos de Diego: `update public.habilidades_catalogo set aliases = aliases || array['canilla rota','reparar canilla','reparacion canilla','reparacion de canilla'] where id = 'arreglar-canilla';` (la búsqueda exige que **todas** las palabras estén en la etiqueta o los sinónimos; sin esto "reparación canilla" y "canilla rota" no encuentran nada). Repasar el resto de `habilidades_catalogo` y agregar de la misma forma "arreglar/reparar/rota/roto" donde falte para las otras tareas de plomería, electricidad y pintura.
  7. Permisos: `revoke all on function buscar_servicio(text,int) from public, anon, authenticated; grant execute ... to authenticated;` y repetir el `revoke/grant` de `abrir_chat(uuid, uuid)` como en `0090_permisos.sql`.

- [ ] **Step 4: Correr y ver que pasan** — `node --test tests/db/*.test.mjs` → todas en verde (las 68 anteriores más las nuevas).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0111_modo_trabajo.sql tests/db/trabajo.test.mjs
git commit -m "feat(db): modo Trabajo - ofrece_servicios, buscar_servicio y tope de chats (0111)"
```

---

### Task 2: Lógica de la app — `lib/trabajo.ts`

**Files:**
- Create: `movil/src/lib/trabajo.ts`
- Test: `movil/src/lib/trabajo.test.ts`

**Interfaces:**
- Consumes: `supabase` de `./supabase`; `PersonaCerca` de `./contactos` como referencia de forma.
- Produces:
  - `type ResultadoServicio = { user_id: string; full_name: string; avatar_url: string | null; zona: string | null; distancia_km: number | string | null; oficios: string[]; coincide: string; es_contacto: boolean; lat: number; lng: number }`
  - `buscarServicio(texto: string, radioKm?: number): Promise<ResultadoServicio[]>` — llama `rpc('buscar_servicio', { p_texto, p_radio_km })`, radio por defecto 15.
  - `consultaValida(texto: string): boolean` — `true` si tras recortar y sacar tildes/símbolos quedan al menos 2 letras o números.
  - `nuevaSecuencia(): () => () => boolean` — cada llamada a la función externa devuelve un `vigente()` que es `true` solo mientras no se haya pedido una secuencia más nueva.
  - `RADIO_BASE = 15`, `RADIO_MAX = 50`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `trabajo.test.ts` (cabecera `// node --test --experimental-strip-types src/lib/trabajo.test.ts`, import con `.ts`):
  - `consultaValida: exige 2 letras reales` — `'ca'` → true; `'  c '` → false; `''`, `'   '`, `'¿?'`, `'%'`, `'_'` → false; `'Cañilla'` → true; `'a1'` → true.
  - `nuevaSecuencia: la consulta vieja deja de ser vigente` — `const n = nuevaSecuencia(); const a = n(); const b = n();` → `a() === false`, `b() === true`; una tercera llamada deja a `b()` en `false`.
  - **Review Focus 4:** `nuevaSecuencia: una respuesta lenta no pisa a la nueva` — simular dos promesas que resuelven en orden inverso y aplicar el resultado solo si `vigente()`: el estado final es el de la segunda consulta.

- [ ] **Step 2: Correr y ver que fallan** — `cd movil && npm test` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `trabajo.ts`.** `consultaValida` normaliza con `normalize('NFD')` quitando diacríticos y todo lo que no sea `[a-z0-9]`, y compara largo ≥ 2. `buscarServicio` sigue el patrón de `rpc<T>` de `lib/contactos.ts` (lanza el error de Supabase). Sin dependencias nuevas.

- [ ] **Step 4: Correr y ver que pasan** — `cd movil && npm test && npx tsc --noEmit` → verde, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add movil/src/lib/trabajo.ts movil/src/lib/trabajo.test.ts
git commit -m "feat(app): logica del buscador de servicios (consulta valida, secuencia, rpc)"
```

---

### Task 3: Interruptor "Ofrezco servicios" en el perfil

**Files:**
- Modify: `movil/src/app/editar-curriculum.tsx` (pantalla "Qué sabés hacer?")

**Interfaces:**
- Consumes: tabla `profile_private.ofrece_servicios` (Task 1) vía `supabase.from('profile_private')`; el estado `oficios` ya presente en la pantalla (lista de habilidades del usuario); `Switch` de react-native y los componentes `Texto`/`Titulo` de `components/ui`.
- Produces: el usuario puede activar/desactivar su aparición en Trabajo.

- [ ] **Step 1: Leer el estado** — al cargar la pantalla (donde ya se cargan `oficios` y `cv_entries`) leer `ofrece_servicios` de `profile_private` del usuario y guardarlo en estado local.

- [ ] **Step 2: Agregar la fila** arriba de "Tu profesión u oficio": título **"Ofrezco servicios"**, detalle **"Aparecés cuando alguien busca lo que sabés hacer. Se ve tu nombre, tus habilidades y tu barrio, nunca tu punto exacto."**, y un `Switch`. Si `oficios.length === 0` el switch queda deshabilitado y el detalle pasa a **"Sumá al menos una habilidad para poder activarlo."**.

- [ ] **Step 3: Escribir el cambio** — al activar, `update({ ofrece_servicios: true })` sobre la fila propia; si el servidor rechaza, mostrar el mensaje con `Alert`. Al quitar la última habilidad el servidor lo apaga: después de cada alta/baja de habilidad, volver a leer `ofrece_servicios` para que el switch refleje el estado real.

- [ ] **Step 4: Verificar** — `cd movil && npx tsc --noEmit` sin errores; en el celular: sin habilidades el switch está deshabilitado; con una, activa y persiste al reabrir; al borrar la última se apaga solo.

- [ ] **Step 5: Commit**

```bash
git add movil/src/app/editar-curriculum.tsx
git commit -m "feat(app): interruptor Ofrezco servicios en Que sabes hacer"
```

---

### Task 4: Mapa Trabajo — selector, buscador, pines y tarjeta

**Files:**
- Create: `movil/src/components/SelectorModo.tsx`
- Create: `movil/src/components/MapaTrabajo.tsx`
- Modify: `movil/src/app/(tabs)/mapa.tsx`

**Interfaces:**
- Consumes: `buscarServicio`, `consultaValida`, `nuevaSecuencia`, `RADIO_BASE`, `RADIO_MAX`, `ResultadoServicio` (Task 2); `abrirChat(userId: string)` de `lib/contacto.ts`; `useUbicacion().origen` para centrar; `MapView`/`Marker` de `react-native-maps` y el pin circular ya usado en `mapa.tsx`; `habilidades_catalogo` (consulta `select label order by tipo, label limit 6`) para sugerencias.
- Produces:
  - `SelectorModo({ modo, onCambiar }: { modo: 'amigos' | 'trabajo'; onCambiar: (m: 'amigos' | 'trabajo') => void })`.
  - `MapaTrabajo()` sin props.
  - Modo recordado en `localStorage` (clave `cercaya.modoMapa`, valores `'amigos' | 'trabajo'`, por defecto `'amigos'`).

- [ ] **Step 1: `SelectorModo`** — dos botones tipo segmentado sobre el mapa ("Amigos" | "Trabajo"), con `accessibilityRole="tab"`; activo en naranja con texto oscuro, igual que el segmentado actual del mapa (`itemSegmento` en `mapa.tsx`).

- [ ] **Step 2: `MapaTrabajo`** con estos comportamientos:
  - Campo de búsqueda con el texto guía `Qué necesitás?` (sin `¿` de apertura); busca con espera de ~400 ms tras la última tecla, solo si `consultaValida`; cada búsqueda toma un `vigente` de `nuevaSecuencia()` y descarta su resultado si ya no es vigente.
  - Con el campo vacío: 6 sugerencias tocables tomadas del catálogo; tocar una la escribe y busca.
  - Pines naranjas (`colores.naranja`, borde blanco) solo de los resultados; contactos con borde distinto y marca "Es tu contacto" en la tarjeta.
  - Tarjeta al tocar un pin: nombre, `coincide`, zona y distancia (`textoDistancia` de `lib/datos`), botones **Escribirle** (`abrirChat(user_id)`; el error del tope se muestra con el `Alert` que ya usa `abrirChat`) y **Ver perfil** (`router.push({ pathname: '/persona/[id]', params: { id } })`).
  - Sin resultados con texto válido: **"Todavía nadie cerca ofrece esto"**; si el radio actual es `RADIO_BASE`, botón **"Buscar más lejos"** que repite la búsqueda con `RADIO_MAX`; escribir otro texto vuelve a `RADIO_BASE`.
  - Error de red: mensaje **"No pudimos buscar. Probá de nuevo."** con botón de reintento.
  - **Review Focus 5:** si el usuario no tiene ubicación guardada, mostrar **"Activá tu ubicación para ver quién te puede ayudar"** en vez de "nadie cerca".

- [ ] **Step 3: Integrar en `mapa.tsx`** — estado `modo` leído de `localStorage` al montar y guardado al cambiar; renderizar `SelectorModo` encima del contenido (fila propia sobre el mapa, sin tapar el segmentado actual: en modo `amigos` se desplaza hacia abajo lo necesario); si `modo === 'trabajo'` renderizar `MapaTrabajo` en lugar del mapa actual. En `amigos` todo queda como hoy.

- [ ] **Step 4: Verificar** — `cd movil && npx tsc --noEmit && npm test` en verde. En el celular (con los bots de Task 5): el selector aparece y recuerda el modo al reabrir; "canilla rota" muestra pines; "lamparita" muestra a quien la ofrece; un texto absurdo muestra el vacío con "Buscar más lejos"; **Escribirle** abre el chat.

- [ ] **Step 5: Commit**

```bash
git add movil/src/components/SelectorModo.tsx movil/src/components/MapaTrabajo.tsx "movil/src/app/(tabs)/mapa.tsx"
git commit -m "feat(app): modo Trabajo en el mapa - selector, buscador, pines y tarjeta"
```

---

### Task 5: Bots con servicios, publicación y documentación

**Files:**
- Modify: `scripts/bots.mjs`
- Modify: `docs/actualizar-app.md`, `CLAUDE.local.md` (del repo principal en `C:\Users\User\Desktop\Proyectos\CercaYa`)

**Interfaces:**
- Consumes: migración 0111 (Task 1); `habilidades_catalogo.id` para los `catalog_id`.
- Produces: bots de prueba que aparecen en Trabajo; migración y actualización en producción.

- [ ] **Step 1: Bots** — en `BOTS` agregar `ofrece: boolean` y `habilidades: [label, catalog_id][]`; en `sembrar()`, insertar esas habilidades en `oficios` (con `catalog_id` y `tipo`) **antes** de poner `ofrece_servicios`. Reparto: Lucía (Peluquera → sin catálogo, `catalog_id` nulo), Mateo (Carpintero → `armar-muebles`), Nicolás (Electricista → `electricista`, `cambiar-lamparita`), Camila (Diseñadora, sin catálogo), Tomás (Plomero → `plomero`, `arreglar-canilla`, `destapar-desague`), Sofía y Valentina sin servicio, Bruno sin servicio (control). Activan `ofrece_servicios`: Mateo, Nicolás, Camila, Tomás, Lucía.

- [ ] **Step 2: Aplicar 0111 en producción** — `node ../CercaYa/.tmp/q.mjs supabase/migrations/0111_modo_trabajo.sql` (aditiva) y verificar con `select count(*) from information_schema.columns where table_name='profile_private' and column_name='ofrece_servicios'` → 1; correr `node scripts/bots.mjs sembrar` y `estado`.

- [ ] **Step 3: Verificar contra producción** (solo lectura con la sesión de un bot): iniciar sesión como un bot sin servicio (Bruno) y llamar `buscar_servicio('canilla')` → incluye a Tomás con `coincide = 'Arreglar una canilla'`; `buscar_servicio('  ')` → `[]`.

- [ ] **Step 4: Publicar la actualización** — `cd movil && npx tsc --noEmit && npm test`, y luego `EXPO_TOKEN=... npm run actualizar:prueba -- "Modo Trabajo en el mapa"` desde la rama `encuentro`. Confirmar en Perfil el id de la actualización nueva.

- [ ] **Step 5: Documentar y limpiar** — agregar a `docs/actualizar-app.md` una línea de estado (migración 0111, update publicada); agregar a `CLAUDE.local.md` la sección "Modo Trabajo" (qué hay, cómo se prueba con los bots, pendientes: pregunta de habilidades al registrarse, oficios de Marcelo como 0112); borrar el proyecto de Vercel de maquetas (`cercaya-maquetas`) y la carpeta `.superpowers/` local.

- [ ] **Step 6: Commit y push**

```bash
git add scripts/bots.mjs docs/actualizar-app.md
git commit -m "feat: bots con servicios, doc de actualizacion y estado del modo Trabajo"
env -u GITHUB_TOKEN git push
```
