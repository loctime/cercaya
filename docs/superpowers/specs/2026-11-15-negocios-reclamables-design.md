# Negocios reclamables en el mapa — diseño

Fecha: 15/11/2026. Estado: BORRADOR para aprobación de Diego. Nada de esto está construido.

## Intención y por qué

Empezar el mapa de CercaYa ya poblado: cargamos nosotros los perfiles de negocios y emprendedores de Ramallo (a partir de su Instagram) y después invitamos a cada dueño a **reclamar** su perfil con su mail. Pedirle a cada negocio que se registre y arme todo es más difícil que dárselo armado. Un mapa vacío no le sirve a nadie, así que sembrarlo es lo que permite que la app tenga algo que mostrar el día uno.

## Objetivos

- Mapa con negocios visibles desde el primer día, sin que ninguno haya hecho nada.
- Reclamo simple: el dueño toca "Es mío", deja su mail, y queda verificado.
- Baja inmediata y sin preguntas para cualquier perfil sin reclamar ("Esto no es mío / sacalo").
- Cuando el negocio se reclama, pasa a ser del dueño, que lo edita.

## No objetivos (por ahora)

- "Entrar con Instagram" y sincronización automática de fotos/bio. Requiere que Meta apruebe la app; va después, dejando los campos preparados.
- Exigir seguir la cuenta de Instagram de CercaYa. Los seguidores no se pueden verificar; el seguir es solo una invitación en nuestras redes.
- Levantar datos de Instagram de forma automática. No se hace scraping (rompe los términos de Instagram).
- Que los negocios se anoten solos sin que los carguemos nosotros.

## Anti-objetivos (sería un fracaso aunque funcione)

- Publicar el teléfono o la dirección exacta de alguien que trabaja desde su casa.
- Que un perfil que alguien pidió sacar siga visible.
- Que alguien reclame un negocio que no es suyo.

## Restricciones

- Se apoya en lo que ya existe: Supabase de producción, app Expo en `movil/`, mapa, categorías y habilidades (`habilidades_catalogo`), panel de admin dentro de la app, cola de `notifications`.
- Reglas de privacidad ya decididas: la ubicación exacta nunca se muestra salvo que el dueño lo elija; la capa pública se difumina a ~1,6 km y solo la ve gente con cuenta.
- Gotcha de permisos de Supabase: cada migración revoca todo y otorga explícito (como `0090_permisos.sql`). Toda escritura pasa por funciones RPC; la app no escribe las tablas directo.
- Gotcha de RLS: evitar policies que se consulten entre sí (usar helpers `security definer`).
- El repo `loctime/cercaya` es público: nada de contraseñas ni claves en archivos versionados.

## Enfoques considerados

**Cómo se verifica el reclamo**
1. *Entrar con Instagram.* Lo más prolijo, pero depende de que Meta apruebe la app (semanas). Bloquea el lanzamiento.
2. *Verificación manual por mensaje directo.* Funciona desde el día uno; cada reclamo requiere un paso nuestro.
3. *Primero la 2 y después sumar la 1.* **Elegida por Diego (15/11/2026).** No dependemos de Meta para arrancar y, cuando aprueben la app, el reclamo se vuelve automático.

**Dónde viven los negocios sin dueño**
- *Tabla nueva `negocios`.* **Elegida (mi llamada, explicada abajo).** Los perfiles actuales (`profiles`, `provider_profiles`) cuelgan de un usuario real con login (`profiles.id` referencia a `auth.users`). Un negocio sin dueño no puede existir ahí sin crear usuarios falsos. Con tabla propia, los usuarios actuales no se tocan.
- *Usuarios fantasma en `auth.users`.* Descartado: ensucia la tabla de autenticación y complica el borrado y el login.

## Diseño

### Datos

`negocios`
- `id`, `nombre`, `rubro` (referencia al catálogo de habilidades/categorías), `bio` corta, `foto_path` (opcional).
- `instagram_usuario` (único, en minúscula), `ig_user_id` (vacío por ahora, para la etapa de "Entrar con Instagram").
- `tipo`: `local` (local a la calle) o `a_domicilio` (trabaja desde su casa o va al cliente).
- `lat`, `lng` exactas (solo internas), `telefono` (opcional, solo se muestra si es `local`).
- `estado`: `sin_reclamar` | `reclamado` | `oculto`.
- `owner_id` (vacío hasta que se reclama, referencia a `profiles`), `cargado_por`, `fuente`, fechas.

`negocio_reclamos`: `id`, `negocio_id`, `user_id`, `email`, `codigo`, `estado` (`pendiente` | `aprobado` | `rechazado` | `vencido`), `creado`, `resuelto_por`, `resuelto_en`.

`negocio_bajas`: `id`, `negocio_id`, `user_id` (opcional), `motivo` (opcional), `creado`, `estado` (`pendiente de revisión` | `confirmada` | `revertida`).

### Qué se ve en el mapa

- `local`: pin con la ubicación del local y el teléfono si lo cargamos (es información pública del negocio).
- `a_domicilio`: sin teléfono y con la ubicación difuminada a la capa pública (~1,6 km). Nunca se muestra la dirección.
- Los negocios sin reclamar se distinguen de los reclamados con un pin distinto y la etiqueta "Perfil sin reclamar".
- Solo los ven usuarios con cuenta, igual que la capa pública actual (mi llamada, para ser coherentes con las reglas que ya hay).

### Dónde aparecen (encaje con lo que ya hay)

- Los negocios se muestran en el **modo Trabajo** del mapa (`MapaTrabajo.tsx`), junto a las personas que activaron "Ofrezco servicios". No en el modo Amigos, que es de contactos.
- La búsqueda de Trabajo (`buscar_servicio`) tiene que encontrarlos con las mismas palabras y sinónimos que ya usa (`habilidades_catalogo`, `palabras_busqueda()`), así que el rubro del negocio es una fila del catálogo. Se agregan en una función aparte (`negocios_cerca`) o se unen al resultado actual; lo decide quien lo construya, con la condición de que quien busca "canilla rota" vea tanto a Tomás como a la plomería del barrio.
- Un negocio sin reclamar no tiene chat (no hay nadie del otro lado). La tarjeta muestra, según lo que haya cargado: teléfono/WhatsApp si es `local`, y el enlace a su Instagram. Al reclamarse, pasa a tener "Escribirle" como cualquier prestador.
- Las migraciones siguen la numeración actual (la última en producción es 0115): estas serían 0116 en adelante, con su propio revoke/grant explícito.

### Reclamo

1. En la ficha de un negocio sin reclamar: botón "Es mío".
2. La app pide el mail de contacto y genera un código corto (6 caracteres, vence a los 7 días).
3. Se le indica que mande ese código por mensaje directo a la cuenta oficial de Instagram de CercaYa **desde la cuenta del negocio**.
4. Admin ve el reclamo en el panel, comprueba el mensaje y aprueba o rechaza.
5. Al aprobar: `estado = reclamado`, `owner_id` = ese usuario, y le llega una notificación (cola `notifications`). Desde ahí el dueño edita nombre, bio, fotos, teléfono y tipo, y puede pausar su perfil.

Límites: un usuario puede tener hasta 3 reclamos pendientes; un negocio acepta un solo reclamo pendiente por usuario.

### Baja

- Botón "Esto no es mío / sacalo" en la ficha de cualquier negocio **sin reclamar**. Al tocarlo, el negocio pasa a `oculto` en el momento y la baja queda para que la revise un admin (que puede confirmarla o revertirla).
- Si el negocio ya fue reclamado, solo el dueño puede ocultarlo o borrarlo.
- Quien no tiene cuenta puede pedir la baja escribiendo a `cercaya@controlapps.ar` o por DM de Instagram; un admin oculta el perfil a mano. Esto se aclara en la página de soporte de la web y en la política de privacidad (mi llamada).
- Tope de 10 bajas por usuario por día, para evitar que alguien esconda a la competencia en masa (un admin puede revertir).

### Carga inicial

- Script `scripts/cargar_negocios.mjs` que lee un CSV (`instagram`, `nombre`, `rubro`, `tipo`, `lat`, `lng`, `telefono` opcional, `bio` opcional) y lo inserta en `negocios` con `estado = sin_reclamar`.
- Los datos salen de lo público del Instagram de cada negocio, relevados por nosotros. La ubicación se completa a mano, porque Instagram casi nunca la da bien.
- Enriquecer automáticamente con la API Business Discovery de Meta (nombre, bio, foto a partir del usuario) queda como mejora posterior; requiere una cuenta profesional de CercaYa en Instagram.

### Panel de admin

Dos pestañas nuevas dentro de "Administración": **Reclamos** (aprobar/rechazar, con código y mail) y **Bajas** (confirmar/revertir, restaurar un negocio oculto).

### Servidor

Todo por funciones RPC con permisos explícitos:
- `negocios_cerca(lat, lng, radio)`: devuelve los negocios visibles aplicando las reglas de privacidad según `tipo`.
- `reclamar_negocio(negocio, email)`, `pedir_baja_negocio(negocio, motivo)`.
- Admin: `aprobar_reclamo`, `rechazar_reclamo`, `confirmar_baja`, `revertir_baja`, `cargar_negocio` (también lo usa el script).
- Dueño: `editar_mi_negocio`, `ocultar_mi_negocio`.
- Pruebas nuevas en `npm run test:db` (PGlite): privacidad según tipo, reclamo de punta a punta, baja inmediata, límites, un tercero no puede editar un negocio ajeno.

## Qué decidió Diego y qué elegí yo

Decidido por Diego:
- Sembrar el mapa con perfiles cargados por nosotros, a partir de Instagram.
- Reclamar con el mail del dueño; verificación manual por DM ahora y "Entrar con Instagram" después.
- Instagram solo para invitar; seguirnos no es requisito.
- Reclamar y eliminar perfiles tienen que existir.

Mis llamadas (se pueden cambiar):
- Tabla nueva `negocios`, separada de los perfiles de usuario.
- `a_domicilio` difuminado y sin teléfono; solo `local` muestra ubicación y teléfono.
- Visible solo para usuarios con cuenta.
- Código de 6 caracteres que vence en 7 días; máximo 3 reclamos pendientes por usuario.
- Baja inmediata con revisión posterior; tope de 10 bajas por usuario por día.
- Quien no tiene cuenta pide la baja por mail o por DM.

## Qué queda para quien lo construya

- Diseño visual del pin sin reclamar y de la ficha (tiene que encajar con el mapa actual).
- Mapeo exacto de rubros del CSV a `habilidades_catalogo` y `categories`.
- Textos de las pantallas y del DM de verificación (en criollo, con tildes).
- La cuenta oficial de Instagram a la que llegan los códigos es **@cercaya** (definido por Diego el 15/11/2026). Va como constante en la app, no escrita a mano en cada texto.
- Actualizar política de privacidad y soporte en la web.
- Rama sugerida: partir de `encuentro` (la que tiene todo lo último), en su propio worktree.
