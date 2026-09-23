# CercaYa v2 — Pantallas y flujos (app Expo)

Fecha: 23/09/2026 · Autor: agy (Antigravity), revisado contra la base v2 · Estado: **aprobado para construir**.
Base de datos: `2026-09-23-cercaya-v2-datos.md` (aplicada en producción).

## Sistema visual

- **Tipografías:** Nunito (títulos, botones principales, badges, números de métricas) + Inter (texto, formularios, labels, metadatos).
- **Colores:** fondo `#FFFFFF`, agrupadores `#F8FAFC`. Naranja de marca `#FF7A00` para acentos, FAB y chips activos, **con texto/íconos `#1E1E1E`**. Botones sólidos con texto blanco: `#C2410C`. Verde `#25D366` (WhatsApp) / `#16A34A` (éxito), solo para eso.
- **Ubicación:** solo las 6 localidades (Ramallo, Villa Ramallo, Pérez Millán, Villa General Savio, El Paraíso, San Nicolás). Siempre `[Localidad], a ~X km`; nunca coordenadas ni dirección.
- **Fechas:** DD/MM/AAAA.
- Íconos vectoriales (lucide), nunca emojis.

## Navegación

- **TopBar:** selector de localidad `Ramallo ▾` (lista de 6 + reintentar GPS) a la izquierda; campanita con punto de no leídas a la derecha.
- **5 tabs:** Inicio · Pedidos (login) · **[+] Pedir** (FAB naranja) · Mensajes (login) · Perfil.

## Pantallas

1. **Inicio** (invitados ven solo prestadores): buscador ("Buscar plomero, pintor, corte de pasto..."), grilla de 8 categorías que filtra la lista en el acto (chip "✕ Quitar filtro"), orden `Más cercanos | Mejor calificados`, tarjetas (avatar, nombre, rubros en pills, `Localidad, a ~X km`, estrellas + cantidad, botón de contacto). Vacío: "Todavía no hay prestadores de [rubro] en esta zona" + `Ver todas las localidades` / `+ Ofrecer este servicio`. → `buscar_prestadores`
2. **Notificaciones** (campanita): lista agrupada Hoy / Anteriores, `Marcar todas como leídas`. Tipos: pedido nuevo de mi rubro, mensaje, cambio de estado, reseña. Vacío con texto explicativo. → tabla `notifications`, `marcar_notificaciones_leidas`
3. **Ficha del prestador:** menú `Denunciar perfil` / `Bloquear usuario`; cabecera (foto, nombre, rubros, `Localidad, a ~X km de vos`); métricas `Trabajos realizados | Contactos recibidos | ★ (N reseñas)`; galería con visor pantalla completa; reseñas con fecha, estrellas, comentario y badge `✓ Trabajo verificado`. Barra de contacto: invitado → `Contactar` abre login; logueado → `obtener_contacto`: si ok, `Contactar por WhatsApp` (verde) + `Enviar mensaje`; si no (oculto / lejos / sin ubicación), solo `Enviar mensaje`. → `perfil_prestador`, `registrar_evento`
4. **Publicar pedido** (modal, pide login): categoría → descripción + hasta 3 fotos → localidad (autocompleta con GPS), urgencia `hoy / semana / a_coordinar`, fecha preferida opcional → `Publicar pedido` (`#C2410C`). → `publicar_pedido`, `job_photos`
5. **Detalle del pedido:** cabecera (categoría, localidad + distancia, urgencia, fecha); el prestador ve la calificación del cliente. Según estado:
   - `abierto`: cliente ve interesados; prestador ve `Me interesa / Chatear`. → `me_interesa`
   - `en_conversacion`: cliente ve `Asignar a este prestador`. → `asignar_prestador`
   - `asignado`: deja de ser público; el teléfono NO se revela solo (sigue por chat salvo "Compartir mi contacto").
   - Opcional: prestador `Llegué` y `Me voy` (verificado si <150 m y ≥10 min). → `checkin`, `checkout`
   - `realizado`: prestador tocó `Marcar trabajo realizado`; cliente recibe aviso. → `marcar_realizado`
   - `cerrado`: cliente tocó `Pago recibido / Trabajo conforme`; se habilita la calificación mutua. → `confirmar_trabajo`
   - `cancelado`. → `cancelar_pedido`
6. **Mis pedidos** (login): pestaña "Mis pedidos" (badges de estado, acción pendiente destacada) y "Mis trabajos" (postulaciones y asignados, botones rápidos `Abrir chat / Llegué / Me voy / Marcar realizado`). Vacíos con CTA. → `pedidos_cerca` para explorar
7. **Mensajes** (login): chats por último mensaje, badge no leído, avatar, nombre, título del pedido, último mensaje. Vacío con texto. → `conversations`
8. **Conversación:** menú `Ver perfil / Bloquear / Denunciar`; burbujas con hora y leído; botón `Compartir mi contacto` (tarjeta "X compartió su WhatsApp: [Abrir en WhatsApp]"). → `messages`, `compartir_contacto`, `marcar_leidos`
9. **Calificar** (solo `cerrado`): A) cliente → prestador (estrellas + comentario; aviso si llevará "✓ Trabajo verificado"); B) prestador → cliente (claridad, trato, pago). → `calificar`
10. **Perfil:** avatar editable, nombre, fecha de alta. "Mis servicios": si no ofrece, tarjeta `+ Sumar mis servicios`; si ofrece, badge `⏳ En revisión / ✓ Aprobado / ⛔ Suspendido`, `Editar datos de prestador`, métricas. Menú: Privacidad, Notificaciones, Ayuda, Términos, Cerrar sesión, **`Eliminar mi cuenta`** (rojo). → `borrar_mi_cuenta`
11. **Alta/edición de servicios:** aviso "pasa a En revisión", 8 categorías, bio, precios, galería (hasta 6), radio de cobertura, `Enviar para revisión`. **Ojo: la base admite radio 1–30 km, no 50** (el diseño decía 5–50).
12. **Privacidad:** switch `Mostrar mi número` (apagado por defecto) + tarjeta que sugiere activarlo; `Quién puede ver mi número: vecinos hasta [30] km` (15 / 30 / 50); precisión de ubicación; lista de bloqueados con desbloquear.
13. **Notificaciones (ajustes):** 4 toggles (pedidos de mis rubros, mensajes, cambios de estado, reseñas). → `notification_prefs`

## Flujos

1. **Contacto:** Inicio → ficha → Contactar → (login si hace falta) → `obtener_contacto` → WhatsApp si ok, si no chat → opcional compartir contacto.
2. **Ciclo del pedido:** publicar (`abierto`) → prestadores chatean (`en_conversacion`) → asignar (`asignado`) → opcional Llegué/Me voy → `Marcar realizado` (`realizado`) → `Pago recibido / Trabajo conforme` (`cerrado`) → calificación mutua.
3. **Alta de servicios:** Perfil → Sumar servicios → datos → teléfono (oculto por defecto) → enviar → `En revisión` → admin aprueba → aparece en el catálogo y recibe avisos.
