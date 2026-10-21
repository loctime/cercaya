# Modo encuentro ("Voy para allá") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario le pida "Voy para allá" a un contacto y, si lo acepta, los dos compartan ubicación exacta en vivo (solo entre ellos) con distancia, flecha y aviso de llegada, también con la pantalla apagada y la app en segundo plano.

**Entregas:** (1) por actualización por internet, el encuentro completo con la app abierta (Tasks 0 a 6); (2) con el APK 1.2.0, el servicio de ubicación en segundo plano y el sonido de llegada (Tasks 7 y 8).

**Architecture:** Dos tablas nuevas (`encounters`, `encounter_positions`) sin acceso directo. Todo pasa por funciones `security definer`: `pedir_encuentro`, `responder_encuentro`, `terminar_encuentro`, `mis_encuentros` y `encuentro_sync`, que cada 5 s guarda mi posición y devuelve la del otro. Solo `encuentro_sync` entrega una posición exacta, y solo a un participante de un encuentro activo. La app (Expo, `movil/`) suma una pantalla `encuentro/[id]`, un botón en el perfil, avisos en el mapa y en Contactos, y el ruteo de la notificación push. En la entrega 2, una tarea de `expo-task-manager` con un servicio de ubicación de Android (aviso fijo) llama al mismo `encuentro_sync` cuando la app está en segundo plano.

**Tech Stack:** Postgres/PGlite (`tests/db/`), Expo SDK 57 + expo-router, expo-location (`watchPositionAsync`, `watchHeadingAsync`, `startLocationUpdatesAsync`), expo-task-manager (entrega 2), expo-notifications, react-native-maps, expo-keep-awake, `node --test` con TypeScript para helpers puros.

**Spec:** `docs/superpowers/specs/2026-10-21-encuentro-design.md` (y `2026-10-20-red-social-mapa-design.md`)

## Global Constraints

- Trabajar en un worktree propio sobre la rama `red-social`: `git worktree add ../CercaYa-encuentro -b encuentro red-social`.
- Migraciones nuevas desde `0107_*.sql`. Cada una revoca todo y otorga explícito (`revoke all ... from public, anon, authenticated`; `grant execute ... to authenticated`): en Supabase todo nace con permisos. Tablas con RLS activado y sin grants directos.
- Escrituras por funciones `security definer` con `set search_path = public`.
- Constantes: llegada `50` m; posición "fresca" `2` minutos; sync cada `5` s; duración por defecto `120` min (valores admitidos `60` y `120`); solicitud pendiente vence a los `15` min; tope `10` solicitudes de encuentro por día.
- La posición exacta de una persona solo la devuelve `encuentro_sync`, a su contraparte, mientras el encuentro está `activo`. Al pasar a cualquier otro estado se borran sus filas de `encounter_positions`.
- Mensajes de error de SQL sin tildes. Textos de la app en español rioplatense, sin `¿` ni `¡` de apertura.
- Antes de usar una API de Expo, leer `movil/AGENTS.md`. Correr `npm run typecheck` y `npm test` en `movil/` y `npm test` en la raíz antes de dar una tarea por terminada.
- **Entrega 1 (Tasks 0 a 6) no agrega módulos nativos**: `expo-keep-awake` ya está en el APK 1.1.0. Sale por `eas update` (canal `preview`, `runtimeVersion` 1.1.0, que sigue a `version` de `app.json` por `runtimeVersion.policy = appVersion`).
- **Entrega 2 (Tasks 7 y 8) sí es nativa**: sube `version` a `1.2.0`, agrega `expo-task-manager` y permisos de servicio de ubicación, y exige APK nuevo. Los celulares con el APK 1.1.0 **no reciben** actualizaciones publicadas para 1.2.0: hay que reinstalar. Por eso la entrega 1 se publica antes, para 1.1.0, y la entrega 2 se publica de nuevo para 1.2.0 cuando el APK esté listo.
- Leer la documentación de SDK 57 antes de tocar ubicación en segundo plano (`https://docs.expo.dev/versions/v57.0.0/sdk/location/` y `.../task-manager/`): `TaskManager.defineTask` va en el alcance global del bundle, no dentro de un componente; los servicios en segundo plano no existen en Expo Go.
- Producción (`jmgoquaxvmzqjkrnfcwo`): Diego autorizó el 21/10/2026 "trabajar en producción". Aun así cada migración se prueba primero con una corrida con rollback y recién después se aplica.

## Review Focus

- Un encuentro `pendiente` nunca entrega ni guarda posiciones (Task 1).
- Un tercero no puede leer ni escribir posiciones de un encuentro ajeno, ni por función ni por tabla (Task 1).
- Al terminar por cualquier vía (corte, vencimiento, bloqueo, contacto quitado) las posiciones desaparecen y un `sync` posterior no devuelve nada (Task 1).
- Dos celulares a 49 m con posiciones frescas llegan; a 51 m o con una posición vieja, no (Task 1).
- Pedir un encuentro mientras ya hay uno abierto entre los dos no crea un segundo (Task 1).
- La flecha apunta bien al cruzar 0°/360° y la distancia se muestra con coma decimal (Task 2).
- Perder señal del otro muestra su último punto con la hora, no una pantalla vacía (Task 4).
- Un invitado no ve el botón ni la pantalla; entra al login (Task 5).
- Al terminar el encuentro (por cualquier vía) el servicio de segundo plano se detiene y el aviso fijo desaparece; si la app se reabre con un encuentro ya terminado, no queda ningún servicio corriendo (Task 7).
- Un servicio huérfano (el encuentro terminó mientras la app estaba cerrada) se detiene solo en el siguiente `sync`, que devuelve un estado distinto de `activo` (Task 7).
- La notificación de llegada suena una sola vez por llegada, aunque el servidor siga devolviendo `llegaron = true` (Task 7).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0107_encuentros.sql` | tablas, funciones, kind de notificación, limpieza programada |
| `tests/db/encuentro.test.mjs` | pruebas de la base |
| `movil/src/lib/geo.ts` + `geo.test.ts` | distancia, rumbo, rotación de flecha, texto de distancia |
| `movil/src/lib/encuentros.ts` | tipos y llamadas RPC |
| `movil/src/lib/useEncuentro.ts` | hook: posición propia, brújula, sync cada 5 s, llegada |
| `movil/src/app/encuentro/[id].tsx` | pantalla del encuentro |
| `movil/src/components/AvisoEncuentro.tsx` | cartel "X va para allá" / "En camino con X" |
| `movil/src/app/persona/[id].tsx` (modificar) | botón "Voy para allá" |
| `movil/src/app/(tabs)/mapa.tsx`, `contactos.tsx` (modificar) | mostrar `AvisoEncuentro` |
| `movil/src/lib/push.ts` (modificar) | ruteo de la notificación |

---

### Task 0: Worktree

- [ ] **Step 1:** Crear el worktree (ver Global Constraints), `npm install` en la raíz y en `movil/`.
- [ ] **Step 2:** `npm test` en la raíz y en `movil/`. Expected: todo verde (línea base: 41 y 6).

### Task 1: Base de datos de encuentros

**Files:**
- Create: `supabase/migrations/0107_encuentros.sql`, `tests/db/encuentro.test.mjs`

**Interfaces:**
- Consumes: `es_contacto(uuid, uuid)`, `bloqueado(uuid, uuid)`, `dist_km(float8,float8,float8,float8)`, `encolar_notificacion(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb)`.
- Produces tablas:
  - `encounters(id uuid pk default gen_random_uuid(), requester_id uuid, addressee_id uuid, status text check in ('pendiente','activo','terminado','rechazado','vencido'), minutos int check in (60,120), created_at timestamptz default now(), accepted_at timestamptz, ends_at timestamptz, ended_at timestamptz, ended_by uuid)`, con `check (requester_id <> addressee_id)` e índice único parcial sobre `(least(requester_id, addressee_id), greatest(requester_id, addressee_id))` donde `status in ('pendiente','activo')`.
  - `encounter_positions(encounter_id uuid fk on delete cascade, user_id uuid, lat float8, lng float8, updated_at timestamptz default now(), primary key (encounter_id, user_id))`.
- Produces funciones (`authenticated`):
  - `pedir_encuentro(p_destino uuid, p_minutos int default 120) returns uuid`
  - `responder_encuentro(p_id uuid, p_acepta boolean) returns void`
  - `terminar_encuentro(p_id uuid) returns void`
  - `mis_encuentros() returns table (id uuid, estado text, soy_solicitante boolean, otro_id uuid, otro_nombre text, otro_avatar text, ends_at timestamptz)` — solo `pendiente` no vencida y `activo` no vencido.
  - `encuentro_sync(p_id uuid, p_lat float8, p_lng float8) returns table (estado text, ends_at timestamptz, otro_lat float8, otro_lng float8, otro_at timestamptz, distancia_m float8, llegaron boolean)`
- Cambia `notifications.kind` para admitir `'encuentro'`.

- [ ] **Step 1: Escribir `encuentro.test.mjs`** (mismo patrón que `social.test.mjs`: `crearDb`, `como`, `rechaza`, usuarios y pares de contactos). Un test por línea:
  - `pedir: solo a contactos`; a un desconocido rechaza con `/Solo podes pedirle a un contacto/`.
  - `pedir: un bloqueo lo frena` con `/No se puede pedir el encuentro/`.
  - `pedir: no duplica` mientras hay uno `pendiente` o `activo` entre los dos: `/Ya hay un encuentro abierto/`; en cualquier sentido.
  - `pedir: tope de 10 por dia` con `/Limite diario/`.
  - `pedir: minutos invalidos` (`45`) rechaza con `/60 o 120/`.
  - `pedir: avisa al otro`: queda una fila en `notifications` con `kind = 'encuentro'` y `data.encounter_id`.
  - `responder: solo el destinatario`, `/No podes responder/`; el solicitante y un tercero fallan.
  - `pendiente: sync no entrega ni guarda posiciones`: el solicitante llama `encuentro_sync` con su posición y recibe `estado = 'pendiente'`, `otro_lat` nulo; `encounter_positions` queda vacía.
  - `aceptado: cada uno ve la posicion exacta del otro` (comparar con los valores enviados, no difuminados) y `ends_at ≈ now() + 120 min`.
  - `tercero: no puede hacer sync` (`/No sos parte de este encuentro/`) ni leer tablas (`/permission denied/` sobre `encounters` y `encounter_positions`).
  - `terminar: cualquiera lo corta y se borran las posiciones`; un `sync` posterior devuelve `estado = 'terminado'` y posiciones nulas.
  - `vence: ends_at pasado` hace que `sync` devuelva `terminado` y borre posiciones; una solicitud `pendiente` de más de 15 minutos pasa a `vencido` y no aparece en `mis_encuentros`.
  - `bloqueo o contacto quitado durante el encuentro lo termina` en el siguiente `sync`.
  - `llegaron`: a 49 m con ambas posiciones frescas es `true`; a 51 m es `false`; con una posición de hace 3 minutos es `false` aunque estén a 10 m (fijar `updated_at` con `db.sql`).
  - `sync actualiza mi posicion` (segunda llamada reemplaza la fila).
  - `mis_encuentros` muestra la solicitud recibida con nombre y no muestra los terminados.
  - `invitado: ninguna funcion` rechaza con `/permission denied/`.
- [ ] **Step 2:** `node --test tests/db/encuentro.test.mjs`. Expected: FAIL (funciones inexistentes).
- [ ] **Step 3:** Implementar la migración. Los mensajes de error son exactamente los de los tests. `encuentro_sync` cierra el encuentro (pasa a `terminado` y borra posiciones) si venció, si ya no son contactos o si hay bloqueo, antes de guardar nada. Cuando el estado no es `activo`, borra las posiciones del encuentro y devuelve solo `estado` y `ends_at`. `pedir_encuentro` y `responder_encuentro` llaman `encolar_notificacion` (`'Diego va para allá'` / `'<nombre> aceptó, ya pueden verse'`; el texto lleva el nombre de quien actúa). Agregar la limpieza programada con `pg_cron` solo si `pg_available_extensions` la trae (mismo patrón que `pg_net` en `0011`): cada 10 minutos, pasar a `terminado` los activos vencidos y a `vencido` los pendientes de más de 15 minutos, y borrar sus posiciones.
- [ ] **Step 4:** `npm test` en la raíz. Expected: PASS, incluidos los 41 anteriores.
- [ ] **Step 5: Commit** `feat(db): encuentros con ubicacion exacta solo entre dos contactos`

### Task 2: Helpers geográficos (app)

**Files:**
- Create: `movil/src/lib/geo.ts`, `movil/src/lib/geo.test.ts`

**Interfaces:**
- Produces: `distanciaM(lat1, lng1, lat2, lng2): number`, `rumboGrados(lat1, lng1, lat2, lng2): number` (0 = norte, sentido horario, `[0, 360)`), `giroFlecha(rumbo: number, orientacion: number): number` (`[0, 360)`), `textoDistancia(m: number): string`, `textoCardinal(rumbo: number): string`.

- [ ] **Step 1: Tests** (`node:test`, import con `.ts`):
  - `distanciaM`: 0,001° de latitud ≈ 111 m (±2); mismo punto = 0.
  - `rumboGrados`: hacia el norte 0, este 90, sur 180, oeste 270 (±1).
  - `giroFlecha`: `(10, 350) → 20`, `(350, 10) → 340`, `(0, 0) → 0`, `(90, 180) → 270`.
  - `textoDistancia`: `850 → '850 m'`, `1000 → '1 km'`, `1530 → '1,5 km'`, `12000 → '12 km'`, `0 → '0 m'`.
  - `textoCardinal`: `0 → 'norte'`, `45 → 'noreste'`, `270 → 'oeste'`, `359 → 'norte'`.
- [ ] **Step 2:** `cd movil && npm test`. Expected: FAIL.
- [ ] **Step 3:** Implementar. Haversine y rumbo inicial: portar de `festival-compass/app/src/utils/geo.ts` (mismas fórmulas); decimales con coma.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(movil): helpers de distancia y rumbo`

### Task 3: Llamadas y hook del encuentro

**Files:**
- Create: `movil/src/lib/encuentros.ts`, `movil/src/lib/useEncuentro.ts`
- Modify: `movil/package.json` (`npx expo install expo-keep-awake`)

**Interfaces:**
- Consumes: RPC de Task 1, helpers de Task 2, `supabase`.
- Produces en `encuentros.ts`: tipos `EncuentroResumen` (campos de `mis_encuentros`) y `EstadoSync` (campos de `encuentro_sync`), y `pedirEncuentro(destino: string, minutos?: number): Promise<string>`, `responderEncuentro(id: string, acepta: boolean): Promise<void>`, `terminarEncuentro(id: string): Promise<void>`, `misEncuentros(): Promise<EncuentroResumen[]>`.
- Produces en `useEncuentro.ts`: `useEncuentro(id: string): { estado: EstadoSync | null; yo: { lat: number; lng: number } | null; rumbo: number | null; giro: number | null; distanciaM: number | null; llegaron: boolean; error: string }`.

- [ ] **Step 1:** `useEncuentro`: mientras la pantalla está enfocada, `Location.watchPositionAsync` (`Accuracy.High`, `timeInterval: 4000`, `distanceInterval: 2`) guarda mi última posición; cada 5 s llama `encuentro_sync(id, lat, lng)` con ella (también si no se movió, para refrescar `updated_at`); `Location.watchHeadingAsync` da la orientación (`trueHeading` si es ≥ 0, si no `magHeading`). Calcula `rumbo`, `giro` y `distanciaM` con Task 2 usando mi posición y la del otro. Si el permiso de ubicación no está dado, lo pide; si lo niegan, `error` explica cómo activarlo. `useKeepAwake()` de `expo-keep-awake` mientras `estado.estado === 'activo'`. Al desmontar, cancela suscripciones e intervalo. `llegaron` pasa a `true` una sola vez por transición (vibra con `Vibration.vibrate([0, 500, 200, 500, 200, 500])` y `Haptics.notificationAsync(Success)`).
- [ ] **Step 2:** `npm run typecheck`. Expected: sin errores.
- [ ] **Step 3: Commit** `feat(movil): llamadas y hook del encuentro`

### Task 4: Pantalla del encuentro

**Files:**
- Create: `movil/src/app/encuentro/[id].tsx`
- Modify: `movil/src/app/_layout.tsx` (registrar `encuentro/[id]` con título "En camino")

**Interfaces:**
- Consumes: `useEncuentro`, `responderEncuentro`, `terminarEncuentro`, `misEncuentros`, helpers de Task 2, `Avatar`, `Boton`, `Texto`, `Titulo`.

- [ ] **Step 1:** Cuatro estados, decididos por `estado.estado` y por si soy el solicitante (se obtiene de `misEncuentros()`):
  - `pendiente` y soy el destinatario: nombre y foto, "va para allá", botones **Aceptar** y **Rechazar**.
  - `pendiente` y soy el solicitante: "Esperando que {nombre} acepte", botón **Cancelar**.
  - `activo`: mapa (`MapView`) con mi punto y el del otro, `fitToCoordinates`; flecha rotada `giro` grados; distancia (`textoDistancia`) y cardinal; "Actualizado {textoHace}" del otro, y si `otro_at` tiene más de 2 minutos, "Sin señal de {nombre} desde hace X" con su último punto atenuado; cartel "Llegaron" cuando `llegaron`; botón **Cómo llegar** (`Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>')`); botón **Terminar**; texto fijo "Mantené la app abierta para que {nombre} te vea".
  - `terminado`, `rechazado` o `vencido`: mensaje corto y botón **Volver**.
- [ ] **Step 2:** `npm run typecheck`. Verificación manual con dos cuentas demo en dos celulares (o un celular y el emulador): pedir, aceptar, ver la flecha y la distancia, cortar desde uno y ver que el otro lo nota en menos de 10 s.
- [ ] **Step 3: Commit** `feat(movil): pantalla del encuentro`

### Task 5: Entrada, avisos y push

**Files:**
- Create: `movil/src/components/AvisoEncuentro.tsx`
- Modify: `movil/src/app/persona/[id].tsx`, `movil/src/app/(tabs)/mapa.tsx`, `movil/src/app/(tabs)/contactos.tsx`, `movil/src/lib/push.ts`

- [ ] **Step 1:** `persona/[id].tsx`: si `perfil.estado === 'aceptado'` y no soy yo, botón **Voy para allá** que llama `pedirEncuentro(id)` y navega a `/encuentro/[id]`; los errores del servidor se muestran con `Alert`. Si ya hay un encuentro abierto con esa persona, el botón se cambia por **Ver encuentro**.
- [ ] **Step 2:** `AvisoEncuentro`: usa `misEncuentros()` al enfocar la pantalla y cada 15 s; muestra un cartel por encuentro abierto ("{nombre} va para allá · Responder" si soy destinatario y está pendiente; "En camino con {nombre} · Abrir" si está activo) que lleva a `/encuentro/[id]`. Insertarlo en `mapa.tsx` (arriba del panel de interruptores) y en `contactos.tsx` (arriba del buscador).
- [ ] **Step 3:** `push.ts`: en `destino`, si `data.encounter_id` es string, devolver `{ pathname: '/encuentro/[id]', params: { id } }`.
- [ ] **Step 4:** `npm run typecheck`, `npm test`. Verificación manual: pedir desde una cuenta y comprobar que a la otra le llega la notificación, que al tocarla abre la pantalla de responder, y que el cartel aparece en Mapa y en Contactos.
- [ ] **Step 5: Commit** `feat(movil): Voy para alla desde el perfil, avisos y push`

### Task 6: Cierre de la entrega 1

- [ ] **Step 1:** `npm test` en la raíz y en `movil/`, `npm run typecheck`. Expected: todo verde.
- [ ] **Step 2:** Producción: corrida de `0107` con rollback (`do $$ begin raise exception 'DRYRUN_OK'; end $$;` al final, como en `0105`), aplicarla, y verificar permisos (`has_function_privilege` para `anon` y `authenticated` en las cinco funciones; `has_table_privilege` falso en las dos tablas) y una consulta como usuario demo.
- [ ] **Step 3:** `cd movil && npm run actualizar:prueba -- "Voy para alla: encuentros en vivo"`. Confirmar `Published`.
- [ ] **Step 4:** Actualizar `CLAUDE.local.md` de CercaYa (estado, constantes, que esta entrega funciona solo con la app abierta y que falta la entrega 2). Pushear la rama.

### Task 7: Segundo plano (código de la entrega 2)

**Files:**
- Create: `movil/src/lib/tareaEncuentro.ts`
- Modify: `movil/package.json` (`npx expo install expo-task-manager`), `movil/app.json` (plugin `expo-location` y `version`), `movil/src/app/_layout.tsx` (importar la tarea), `movil/src/lib/useEncuentro.ts`, `movil/src/lib/push.ts` (exportar el acceso perezoso a `expo-notifications` para reutilizarlo)

**Interfaces:**
- Consumes: `encuentro_sync` (Task 1), `supabase`, el módulo `expo-notifications` por el mismo carga perezosa de `push.ts` (no existe en Expo Go).
- Produces en `tareaEncuentro.ts`: `iniciarServicioEncuentro(encuentroId: string, nombreOtro: string): Promise<boolean>` (devuelve `false` si Android o el usuario lo impiden), `detenerServicioEncuentro(): Promise<void>`, `servicioActivo(): Promise<boolean>`.

- [ ] **Step 1: Tests** de lo puro, en `movil/src/lib/tareaEncuentro.test.ts` (`node:test`): extraer a una función `decidirTrasSync(estado: { estado: string; llegaron: boolean }, yaAvisado: boolean): { detener: boolean; avisarLlegada: boolean }` y probar: `activo` sin llegada → ni detener ni avisar; `activo` con llegada y `yaAvisado = false` → avisar; con `yaAvisado = true` → no avisar; `terminado`, `rechazado` y `vencido` → detener; llegada con estado `terminado` → no avisar.
- [ ] **Step 2:** `cd movil && npm test`. Expected: FAIL.
- [ ] **Step 3:** Implementar `tareaEncuentro.ts`. `TaskManager.defineTask('cercaya-encuentro', ...)` en el alcance global del archivo; el archivo se importa por efecto secundario desde `_layout.tsx` (arriba, antes de cualquier componente). El ejecutor toma la última ubicación de `data.locations`, lee el `encuentroId` guardado en `localStorage` (`cercaya.encuentro_activo`), llama `supabase.rpc('encuentro_sync', ...)`, y con el resultado aplica `decidirTrasSync`: si `detener`, llama `detenerServicioEncuentro` y borra la clave; si `avisarLlegada`, programa una notificación local inmediata con sonido (`"Llegaron"`, `"Ya estás con {nombre}"`) y marca la clave `cercaya.encuentro_avisado` para no repetirla. `iniciarServicioEncuentro` guarda `encuentroId` y el nombre en `localStorage` y llama `Location.startLocationUpdatesAsync('cercaya-encuentro', { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0, foregroundService: { notificationTitle: 'Compartiendo ubicación', notificationBody: 'Con {nombre}', notificationColor: '#FE6F14' } })`. `detenerServicioEncuentro` usa `Location.stopLocationUpdatesAsync` solo si `Location.hasStartedLocationUpdatesAsync('cercaya-encuentro')`.
- [ ] **Step 4:** `app.json`: subir `version` a `1.2.0` y configurar el plugin de `expo-location` con `isAndroidForegroundServiceEnabled: true`, `androidForegroundServiceIcon: "./assets/notification-icon.png"` y **`isAndroidBackgroundLocationEnabled: false`** para empezar (ver Step 7). Texto de `locationWhenInUsePermission` que mencione compartir ubicación en vivo durante un encuentro.
- [ ] **Step 5:** `useEncuentro` (Task 3): al pasar el estado a `activo`, o al pedirse el encuentro siendo el solicitante, llamar `iniciarServicioEncuentro`; al pasar a cualquier otro estado, `detenerServicioEncuentro`. Mientras el servicio corre, el `watchPositionAsync` de primer plano sigue funcionando para la pantalla; el servicio es el que sostiene la subida con la app en segundo plano. El texto de la pantalla (Task 4) pasa de "Mantené la app abierta" a "Podés guardar el celular: seguimos compartiendo hasta que termine". Agregar una pista visible, solo en Android de Xiaomi/Poco/Redmi (`Device.manufacturer`), para poner CercaYa en "Sin restricciones" en los ajustes de batería.
- [ ] **Step 6:** `npm run typecheck`, `npm test`. Expected: verde.
- [ ] **Step 7: Verificación en celular real** (no automatizable; se hace tras el build de Task 8): iniciar el servicio con la app en primer plano y confirmar que Android **lo acepta sin `ACCESS_BACKGROUND_LOCATION`**. **Si rechaza con un error de permiso de segundo plano**: poner `isAndroidBackgroundLocationEnabled: true`, pedir `Location.requestBackgroundPermissionsAsync()` antes de iniciar (en Android 11 o superior abre los ajustes del sistema, explicarlo en pantalla), volver a compilar y anotar la decisión en el diseño.
- [ ] **Step 8: Commit** `feat(movil): servicio de ubicacion en segundo plano para el encuentro`

### Task 8: APK 1.2.0 y prueba caminando

- [ ] **Step 1:** `cd movil && EXPO_TOKEN=<de settings.json> npx --yes eas-cli@latest build --profile preview --platform android --non-interactive --no-wait`. Seguir el estado con `eas build:view <id> --json` hasta `FINISHED` (la cola gratuita tarda 15 a 60 minutos) y guardar la URL del APK.
- [ ] **Step 2: Prueba con dos celulares reales**, uno con Xiaomi/Poco si es posible, instalando el APK encima del anterior:
  - Pedir, aceptar, bloquear la pantalla de ambos y caminar: la posición del otro sigue moviéndose en la pantalla de quien la mira al desbloquear, y el aviso fijo aparece mientras dura.
  - Cortar desde uno con el otro bloqueado: el aviso fijo del otro desaparece en menos de 10 s.
  - Matar la app de uno desde recientes: confirmar si el servicio sigue o se corta, y anotarlo.
  - Llegar a menos de 50 m con las pantallas bloqueadas: suena la notificación una sola vez.
- [ ] **Step 3:** Publicar para el runtime nuevo: `npm run actualizar:prueba -- "Encuentros con segundo plano"` (sale como 1.2.0). Confirmar `Runtime version 1.2.0`.
- [ ] **Step 4:** Pasar el link del APK a Diego y avisar que quienes tengan el APK 1.1.0 tienen que reinstalar. Actualizar `CLAUDE.local.md` con el APK, los hallazgos de la prueba (en particular el Step 7 de Task 7) y la lista de ajustes de batería por marca. Pushear y, con el OK de Diego, mergear a `v2-expo`.
