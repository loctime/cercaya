# Red social con mapa — diseño

Fecha: 20/10/2026. Autor de las decisiones: Diego. Las marcadas "(mi llamada)" las tomó Claude y Diego las revisa al leer.

## Intención

Una red social donde la pantalla principal es un mapa. Abrís la app y ves a tus contactos y a la gente que ofrece servicios cerca. Cada persona tiene un perfil con su currículum y sus oficios. Sirve para dos cosas:

1. **Ofrecer y encontrar servicios por zona.** "Cortador de pasto, cambiador de bombillas y plomero en el barrio Tal." Quien busca "plomero" ve quién hay cerca.
2. **Encontrarse con alguien.** Se toca "voy para allá" sobre un contacto; si el otro acepta, los dos comparten ubicación exacta en vivo y la app los guía hasta encontrarse.

Esto sale de combinar tres cosas que ya existen: festival-compass (brújula y ubicación en vivo entre amigos), alarma-gps (aviso al llegar) y CercaYa (servicios locales, perfiles, mapa).

## Objetivos

- Mapa como pantalla principal, con dos capas: contactos y público.
- Perfil con foto, currículum y oficios, visible según la privacidad elegida.
- Contactos por aceptación mutua. Opcionalmente, perfil público para conocer gente.
- Ubicación aproximada de cada usuario, actualizada cada 10 minutos.
- Modo encuentro: ubicación exacta en vivo solo entre dos personas que se aceptaron, con brújula, distancia y alarma al llegar.
- Para el trayecto, un botón "ver cómo llegar" que abre Google Maps con el destino cargado.

## No objetivos (por ahora)

- Rutas propias de transporte público (colectivos). Requiere datos de las líneas y una API paga. Queda para más adelante.
- Reemplazar a Google Maps como navegador.
- Pagos dentro de la app.
- Resolver el arranque en frío (mapa vacío con pocos usuarios). Diego pidió no preocuparse por eso ahora.

## Anti-objetivos (fallaría aunque funcione técnicamente)

- Que sirva para seguir o acosar a alguien: nunca se muestra la ubicación exacta a quien no es un contacto aceptado y en modo encuentro activo.
- Que se trabe o no funcione si el usuario rechaza el permiso de ubicación "siempre".
- Que drene la batería.

## Decisiones tomadas

**Privacidad y ubicación**
- Contactos: relación mutua, los dos tienen que aceptar. Ver a un contacto en el mapa requiere esa relación.
- Modo público: opcional, para que la gente se conozca. Muestra la persona en una **zona aproximada** (barrio, círculo de unas cuadras), nunca el punto exacto, con su perfil y oficios visibles. Por defecto está apagado (mi llamada).
- Ubicación en el mapa: siempre aproximada, actualizada cada 10 minutos, con la hora de la última actualización visible.
- Se pide el permiso de ubicación "siempre" (Diego: "lo pedimos y listo"). Si el usuario da solo "mientras uso la app", todo funciona igual pero se actualiza al abrirla. No se puede forzar el permiso.
- Técnica de bajo consumo: iPhone con cambio de ubicación significativo; Android con baja precisión y actualización periódica. Nada de GPS preciso encendido todo el día.
- Modo encuentro: el único momento con ubicación exacta. Requiere que el otro acepte, dura un tiempo limitado (1 hora, 2 horas o hasta que alguno corte) y se apaga solo (mi llamada en las duraciones). Reutiliza la lógica de festival-compass y alarma-gps.
- Se mantienen las decisiones de CercaYa del 22/09/2026: la ubicación exacta puede guardarse internamente pero nunca se muestra; teléfonos solo para usuarios logueados y con opción de ocultarlo; chat interno; denunciar y bloquear; borrado de cuenta dentro de la app.
- Si alguien apaga "compartir ubicación", desaparece del mapa pero su perfil sigue existiendo.

**Producto y construcción**
- Base: evolucionar la app móvil de CercaYa (`movil/`, Expo, rama `v2-expo`) en vez de empezar de cero (mi llamada). Ya tiene mapa nativo, login con Supabase, ubicación, notificaciones push, actualizaciones por internet, perfiles, chat y moderación.
- Se mantiene el nombre **CercaYa** y la misma ficha de tienda (decisión de Diego 20/10/2026). La app nueva reemplaza a la actual: CercaYa pasa de catálogo de servicios a red social con mapa.
- Primera versión del trayecto: abrir Google Maps con el destino.

## Lo que queda para quien construya

- Esquema de datos nuevo: contactos, solicitudes de contacto, ubicación aproximada con vencimiento, sesiones de encuentro, currículum y oficios.
- Cómo se difumina la ubicación (grilla fija o desplazamiento aleatorio estable) para que no se pueda deducir el punto real promediando actualizaciones.
- Reglas de seguridad de la base (RLS) para que la ubicación aproximada y el modo encuentro solo se lean con permiso.
- Mecanismo de tiempo real para el modo encuentro (Supabase Realtime u otro).
- Textos y pantallas de explicación del permiso "siempre", que aprueben Apple y Google.
- Orden de etapas. Sugerencia: 1) mapa, perfiles y contactos; 2) modo público y búsqueda por oficio; 3) modo encuentro con brújula y alarma.

## Llamadas de Claude tras la revisión (Diego las revisa)

- **Precisión por audiencia:** el servidor guarda un solo punto y devuelve uno difuminado distinto según quién mira. Contactos ven una grilla de unos 300 m; el público ve el barrio (unos 1 a 2 km). La grilla es fija con desplazamiento estable por usuario, para que promediar actualizaciones no revele el punto real. Nunca se envía el punto exacto al cliente.
- **Permiso "siempre":** no es requisito de la etapa 1. La etapa 1 funciona con "mientras uso la app" y actualiza al abrir. La actualización en segundo plano entra como mejora de la etapa 1 o 2, porque exige build nativo nuevo y revisión de Apple y Google. Si la rechazan, el plan B ya es el producto.
- **Los 10 minutos:** es un objetivo, no una garantía (iPhone se actualiza por cambio significativo y Android puede estrangular el segundo plano). Cada ubicación tiene hora y vence. Pasados 30 minutos se muestra en gris con "hace X"; pasadas 24 horas deja de mostrarse.
- **Modo encuentro:** ubicación exacta solo con la app abierta (como recomendaron las notas de alarma-gps y CercaYa). Si un lado pierde señal o cierra la app, la sesión se pausa y muestra el último punto con la hora; se termina sola al vencer el tiempo. Radio de llegada: 50 m. Cualquiera puede cancelar en cualquier momento y los datos exactos se borran al terminar.
- **Cómo se hacen contactos:** por usuario o teléfono, y desde el perfil público. Con límite de solicitudes por día, bloqueo y denuncia (ya existen en CercaYa).
- **Currículum y oficios:** currículum estructurado (experiencia, años, descripción) y sin archivos PDF en la primera versión. Oficios como etiquetas sugeridas desde las categorías de CercaYa, con posibilidad de escribir una propia.
- **Edad mínima:** 18 años, igual que lo decidido en CercaYa el 23/09/2026.
- **Alcance geográfico:** el lanzamiento y las pruebas son en Ramallo y Argentina, pero el mapa es abierto. Los nombres de barrio se obtienen por geocodificación inversa, sin depender de la tabla de zonas de Ramallo.
- **Migración:** misma base de Supabase y mismas tablas. Los pedidos y las reseñas de CercaYa quedan intactos pero sin pantalla en la etapa 1.

## Pendientes de Diego

- Consultar la marca "CercaYa" en el registro del INPI antes de invertir en publicidad. En las tiendas no hay una app con ese nombre exacto, pero sí apps parecidas ("Cerca": citas y emergencias) en otros rubros.
- Revisar el documento completo y aprobarlo para pasar al plan.

## Decisiones cerradas de Diego (20/10/2026)

- Capa pública: solo usuarios con cuenta, dentro de un radio cercano y con tope de resultados.
- Nombre y ficha de tienda: se mantienen los de CercaYa.
