# Modo Trabajo en el mapa (buscador de servicios)

Fecha: 24/10/2026 · Estado: **para aprobar** · Rama: `encuentro`

## Intención

CercaYa tiene dos usos que no se deben mezclar:

1. **Amigos** (hoy): ver contactos y vecinos, "Voy para allá".
2. **Trabajo** (nuevo): alguien necesita algo ("canilla rota") y quiere ver **solo** a quienes pueden resolverlo, cerca, y escribirles.

El mapa pasa de un modo al otro con un interruptor arriba. En Trabajo no aparece nadie que no pueda cumplir el pedido, sea contacto o no.

## Decisiones de Diego

- Interruptor **Amigos | Trabajo** arriba del mapa (opción B de las maquetas).
- Buscador de texto libre: "canilla rota", "arreglar canilla", "reparación canilla" encuentran lo mismo.
- En Trabajo aparecen **solo** quienes activaron **"Ofrezco servicios"**.
- Contacto con quien aparece: **chat directo** (sin pedido abierto por ahora).
- Escribirle a un desconocido: libre, con **tope diario** de chats nuevos.
- Sin resultados: mensaje claro y botón para ampliar el radio.

## Objetivos

- Encontrar a alguien útil en menos de 3 toques desde el mapa.
- Que nadie aparezca en una búsqueda sin haberlo elegido.
- Reusar lo ya construido: catálogo de habilidades con sinónimos (0110), ubicación difuminada, chat (`abrir_chat`).

## No objetivos

- Pedidos abiertos que ven varios (modelo v1), presupuestos, pagos, reseñas, verificación de profesionales.
- Cambiar el modo Amigos ni el modo encuentro.
- Los 6 oficios de Marcelo (paso aparte, migración posterior).
- Notificar "cuando alguien ofrezca esto".

## Anti-objetivos (sería un fracaso aunque "ande")

- Mostrar la ubicación exacta de alguien que ofrece servicios.
- Que el tope de chats se pueda esquivar abriendo y cerrando conversaciones.
- Que quien no activó "Ofrezco servicios" salga en una búsqueda.

## Comportamiento

**Interruptor.** Dos botones sobre el mapa. La app recuerda el último modo. En Amigos queda la barra actual (Todos / Contactos / Cerca). En Trabajo esa barra se reemplaza por el buscador.

**Buscador (Trabajo).** Desde 2 letras, con espera de ~0,4 s al tipear. Coincide contra el nombre del oficio o tarea **y** sus sinónimos del catálogo, sin importar tildes ni mayúsculas (la misma lógica de `buscar_habilidades_cerca`). Con el buscador vacío se muestran sugerencias tocables tomadas del catálogo (ej. "Arreglar una canilla", "Cambiar una lamparita") *(mi idea)*.

**Mapa.** Solo pines naranjas de quienes coinciden, hasta 30, los más cercanos primero. Radio por defecto 15 km. Los contactos que ofrecen ese servicio también aparecen, con una marca "Es tu contacto" *(mi idea, porque contratar a un conocido es el caso más valioso)*.

**Tarjeta.** Al tocar un pin: nombre, oficio o tarea que coincide, zona y distancia aproximada, botón **Escribirle** (abre el chat directo) y acceso al perfil.

**Sin resultados.** "Todavía nadie cerca ofrece esto" y un botón "Buscar más lejos" que sube el radio al máximo (50 km). Si tampoco hay, el mismo mensaje sin botón.

**Ofrezco servicios.** Un interruptor en el perfil, junto a "Qué sabés hacer?". Apagado por defecto. Para activarlo hace falta tener al menos una habilidad cargada *(mi idea: si no, aparecería en búsquedas sin poder coincidir con nada)*. Es independiente de "Aparecer para gente cerca" (`es_publico`): alguien puede ser encontrable como cerrajero sin aparecer en "cerca tuyo".

## Privacidad

- Quien ofrece servicios se ve con la **misma ubicación difuminada de la capa pública** (celda de ~1,6 km); nunca el punto real. Activar el interruptor es aceptar ese nivel de visibilidad, y el texto del interruptor lo dice.
- Solo se muestran personas con ubicación de los últimos 7 días, sin bloqueos en ningún sentido y que no sean uno mismo.
- Nadie que no haya activado "Ofrezco servicios" aparece, aunque tenga oficios cargados o sea público.

## Piezas

**Base de datos (migración 0111, aditiva):**
- Columna `profile_private.ofrece_servicios boolean not null default false`, editable por su dueño.
- Función `buscar_servicio(p_texto, p_radio_km)` para usuarios con sesión. Devuelve lo mismo que `buscar_habilidades_cerca` más `es_contacto`. Incluye contactos (a diferencia de aquella).
- Tope de chats nuevos: en `abrir_chat`, si la conversación no existe y la otra persona **no es contacto**, máximo 10 por día por persona *(mi idea: mismo criterio que el límite de solicitudes de contacto)*. Contado sobre conversaciones creadas, para que no se pueda esquivar abriendo y borrando.

**App (`movil/`):**
- `mapa.tsx`: modo Amigos/Trabajo, buscador, pines naranjas, tarjeta, estado vacío.
- Interruptor "Ofrezco servicios" en el perfil, con la regla de al menos una habilidad.
- Una librería chica para el buscador con espera (debounce) y su test.

**Pruebas:**
- Base: aparece solo quien ofrece; no aparece quien no activó aunque sea público; sinónimos y tildes; bloqueados; radio; contacto marcado; ubicación nunca exacta; tope de chats (y que a contactos no se les aplica).
- App: typecheck y tests existentes; verificación visual en el celular.

**Datos de prueba:** a los bots se les cargan habilidades y se activa "Ofrezco servicios" en la mayoría (Nicolás, Camila, Mateo, Lucía) para tener algo que encontrar; Bruno queda sin activar como control.

## Cómo se publica

Migración 0111 en producción primero (aditiva, nada deja de funcionar), después actualización por internet en el canal `preview` (sin cambios nativos, la reciben los APK 1.2.0). Sin subir `version`.

## Queda a criterio de quien construye

Diseño visual fino de la tarjeta y del estado vacío (siguiendo el sistema actual: naranja con texto oscuro, letra mínima 14), textos exactos en español rioplatense, y el manejo de errores de red.

## Riesgos conocidos

- Con pocos usuarios el modo Trabajo se verá vacío al principio; los bots sirven para probar, pero en producción real depende de que la gente active "Ofrezco servicios".
- Las ubicaciones difuminadas a 1,6 km son poco precisas para decidir "quién está más cerca"; es deliberado.
