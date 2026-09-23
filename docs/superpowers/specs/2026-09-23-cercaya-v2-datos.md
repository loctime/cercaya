# CercaYa v2 — Modelo de datos (app Expo)

Fecha: 23/09/2026 · Estado: **aplicado en producción 23/09/2026** (migraciones en `supabase/migrations/`, pruebas en `tests/db/` con `npm run test:db`) · Decisiones de origen: `CLAUDE.local.md` → "DECISIÓN: camino a las tiendas" y "Decisiones de producto de Diego".

Documento liviano: decisiones, tablas y reglas de acceso. El SQL real está en las migraciones.

---

## 0. Punto de partida (verificado en producción 23/09/2026)

- Base vacía: 0 perfiles, 0 prestadores, 0 pedidos, 0 reseñas. Sin buckets de storage.
- Las policies de admin (`supabase/002_admin_policies.sql`) **nunca se aplicaron** → hoy el panel `/admin` no puede aprobar prestadores.
- Como no hay datos, **v2 se arma limpio** (se reemplaza el esquema, no se migra nada).

## 1. Principios

1. **Nada sensible se lee directo de una tabla.** Teléfono y ubicación exacta viven en tablas privadas (solo el dueño las ve). Los demás acceden por funciones del servidor que deciden qué mostrar y dejan registro.
2. **Todos son usuarios.** Ser prestador = tener servicios cargados. Admin es un flag aparte.
3. **La confianza se gana con hechos registrados** (contacto, chat, check-in, confirmaciones), no con declaraciones.
4. Todo lo que Apple exige para contenido de usuarios (denunciar, bloquear, borrar cuenta) está en la base desde el día 1.

## 2. Tablas

### Usuarios
| Tabla | Qué guarda | Quién lee |
|---|---|---|
| `profiles` | nombre, avatar, bio corta, zona aproximada (lat/lng redondeados + nombre de zona), `is_admin`, fecha alta | Público |
| `profile_private` | teléfono, ubicación exacta, preferencias de privacidad (`show_phone`, `location_precision`) | Solo el dueño |
| `blocks` | quién bloqueó a quién | Solo el que bloqueó |

### Prestadores
| Tabla | Qué guarda | Quién lee |
|---|---|---|
| `provider_profiles` | bio de trabajo, rango de precios, radio de cobertura, estado (`pendiente` / `aprobado` / `suspendido`), activo sí/no | Público si aprobado y activo |
| `provider_services` | usuario ↔ categoría | Público |
| `provider_photos` | galería de trabajos (archivo en bucket `galeria`, epígrafe, orden) | Público |
| `categories` | igual que hoy | Público |

### Pedidos y ciclo del trabajo
| Tabla | Qué guarda | Quién lee |
|---|---|---|
| `jobs` | cliente, categoría, descripción, urgencia (`hoy` / `semana` / `a_coordinar`), fecha preferida, zona aproximada, estado, prestador asignado, confirmaciones (`provider_done_at`, `client_confirmed_at`) | Abiertos: cualquiera logueado. Asignados/cerrados: solo las dos partes |
| `job_private` | ubicación exacta del pedido | Solo el cliente (y el prestador asignado recibe la dirección por chat si el cliente la comparte) |
| `applications` | prestador se ofrece a un pedido, con mensaje | Las dos partes |
| `job_checkins` | "Llegué" / "Me voy" del prestador: hora + posición + distancia al pedido calculada en el servidor | Las dos partes (solo la distancia, nunca la posición) |

Estados del pedido: `abierto → en_conversacion → asignado → realizado → cerrado` (+ `cancelado`).
- `realizado`: el prestador marcó "trabajo realizado".
- `cerrado`: el cliente confirmó "pago recibido / trabajo conforme".

### Contacto y chat
| Tabla | Qué guarda | Quién lee |
|---|---|---|
| `conversations` | dos usuarios + pedido opcional | Las dos partes |
| `messages` | tipo (`texto` / `contacto` / `sistema`), contenido, leído | Las dos partes |
| `contact_events` | registro de: ver perfil, tocar WhatsApp, revelar teléfono, iniciar chat, compartir contacto | Solo el servidor (alimenta métricas y antifraude) |

"Enviar contacto" = mensaje tipo `contacto` que guarda una copia del teléfono en ese momento. Solo lo puede enviar el dueño del número.

### Reseñas
| Tabla | Qué guarda | Quién lee |
|---|---|---|
| `reviews` | pedido, quien califica, calificado, estrellas, comentario, `trabajo_verificado` (sí/no) | Público |

Reglas:
- Solo se puede reseñar un pedido en estado `cerrado`, una vez por persona y por pedido.
- `trabajo_verificado` = hubo check-in a menos de ~150 m del pedido durante ≥10 min. Se calcula en el servidor; el usuario no lo puede tocar.
- Si se borra la cuenta del que calificó, la reseña queda como "Usuario eliminado".

### Moderación, notificaciones, métricas
| Tabla | Qué guarda |
|---|---|
| `reports` | denuncias (tipo de objeto: perfil / reseña / pedido / mensaje; motivo; estado de revisión) |
| `notification_prefs` | por usuario: pedido nuevo de mi rubro cerca (con radio), mensaje nuevo, cambio de estado de mi pedido, reseña recibida |
| `push_tokens` | tokens de Expo Push por dispositivo |

Las métricas del prestador (contactos recibidos, trabajos realizados, calificación) se calculan desde `contact_events`, `jobs` y `reviews` — no hay tabla aparte.

## 3. Funciones del servidor (lo que la app llama)

| Función | Hace |
|---|---|
| `buscar_prestadores(categoría, orden)` | Usa la ubicación exacta del que busca (o centro de Ramallo si no dio permiso). Devuelve distancia **redondeada** ("menos de 1 km", "1,5 km"...), nunca coordenadas del prestador. Excluye bloqueados. |
| `obtener_contacto(prestador)` | Requiere sesión. Devuelve el teléfono solo si el prestador lo tiene visible, no hay bloqueo y el que pide está dentro del radio "cerca". Registra el evento. |
| `pedidos_cerca()` | Pedidos abiertos de mis rubros, con zona aproximada. |
| `checkin(pedido, lat, lng)` / `checkout(...)` | Solo el prestador asignado. Guarda la posición y calcula la distancia al pedido. |
| `marcar_realizado` / `confirmar_trabajo` | Avanzan el estado; habilitan reseñas. |
| `borrar_mi_cuenta()` | Borra usuario y datos privados; anonimiza reseñas y mensajes enviados. |

Notificaciones push: disparadas desde la base (pedido nuevo, mensaje, cambio de estado, reseña) → función en el servidor → Expo Push, respetando `notification_prefs`.

## 4. Ubicación — cómo se protege

- Exacta: solo en `profile_private` / `job_private` / `job_checkins`, nunca expuesta.
- Aproximada (pública): redondeada a una grilla de ~1 km + nombre de zona.
- Distancias que ve el usuario: calculadas en el servidor con las exactas y redondeadas, para que no se pueda triangular la casa de nadie.
- Declararlo en la política de privacidad (Apple y Google lo piden).

## 5. Antifraude — base del día 1

- Reseñas atadas a pedidos cerrados por ambas partes + marca de trabajo verificado.
- Registro de contactos y check-ins (evidencia si hay un reclamo).
- Denuncias + bloqueos + suspensión de prestadores por admin.
- Límites: cuentas nuevas con tope de pedidos por día y de chats nuevos por hora.
- Más adelante: verificación real (teléfono por SMS, DNI) → insignia "Verificado".

## 6. Respuestas de Diego (23/09/2026)

1. Aprobación manual de prestadores por admin: **sí, por ahora**.
2. Número: **oculto por defecto**; la app sugiere mostrarlo.
3. Radio "cerca" para ver el teléfono: **30 km por defecto, ajustable por el dueño del número**.
4. Reseñas en las dos direcciones: **sí**.
5. Check-in: **opcional** (solo suma "trabajo verificado").
6. Base v2: **armarla ya**.

Preguntas originales:

1. **Aprobación manual de prestadores:** sigue (el admin aprueba antes de aparecer) o aparecen al toque y se suspende si hay problemas?
2. **Número visible por defecto** (y cada uno lo oculta si quiere) u **oculto por defecto**?
3. **"Cerca" para ver el teléfono:** qué radio? Propuesta: 30 km (Ramallo, Villa Ramallo, Pérez Millán, San Nicolás).
4. **Reseñas en las dos direcciones** (el prestador también califica al cliente)? Propuesta: sí, protege al prestador de clientes problemáticos.
5. **Check-in obligatorio para reseñar** o solo suma la marca "trabajo verificado"? Propuesta: opcional, porque muchos trabajos no lo van a usar y no queremos frenar las reseñas.
6. **Rehacer la base limpia ya** (la web actual deja de funcionar en las partes de uso; tiene 0 usuarios) o **esperar** a que la app esté lista? Propuesta: armar v2 en la base ya y dejar la web solo con landing hasta achicarla.
