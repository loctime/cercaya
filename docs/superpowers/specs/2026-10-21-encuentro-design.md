# Modo encuentro ("Voy para allá") — diseño

Fecha: 21/10/2026. Concreta la "etapa 3" de `2026-10-20-red-social-mapa-design.md`. Decisiones de Diego; las marcadas "(mi llamada)" las tomó Claude.

## Qué es

Desde un contacto aceptado, Diego toca **"Voy para allá"**. El contacto recibe un aviso y puede **aceptar o rechazar**. Si acepta, los dos se ven con ubicación **exacta y en vivo, solo entre ellos dos**, con distancia, una flecha que apunta hacia el otro y un aviso cuando llegan. Cualquiera puede cortarlo cuando quiera.

## Decisiones

- **Solo contactos** (mi llamada). El botón no aparece con desconocidos de la capa azul: sería una forma de seguir a alguien que no te conoce.
- **Aceptación obligatoria.** Sin aceptar, no se comparte ninguna posición exacta, ni la del solicitante.
- **Funciona con la pantalla apagada y la app en segundo plano** (decidido por Diego el 21/10, tras empezar planeando solo "con la app abierta"). Se entrega en dos pasos:
  1. **Entrega 1, por actualización por internet:** el encuentro completo con la app abierta; la app mantiene la pantalla prendida. Sirve para probar el flujo.
  2. **Entrega 2, con APK 1.2.0:** mientras dura el encuentro corre un servicio de ubicación de Android con un aviso fijo en la barra ("Compartiendo ubicación con {nombre}"), que manda la posición cada ~5 s aunque se guarde el celular. Se apaga al terminar el encuentro.
  - Quien pide el encuentro arranca el servicio al pedirlo (el servidor descarta las posiciones mientras está `pendiente`); quien responde, al aceptar. Así, cuando el otro acepta, el celular ya está mandando.
  - Si un lado pierde señal o el sistema le mata la app, el otro ve su último punto con la hora ("sin señal desde hace X").
  - Se usa el servicio con aviso, no el permiso "ubicación siempre en segundo plano" (`ACCESS_BACKGROUND_LOCATION`), que Google revisa más duro. **A confirmar en un celular real** si Android lo acepta sin ese permiso; si no, se agrega.
  - En Xiaomi/Poco/HyperOS hay que poner la app en "Sin restricciones" de batería, y la app lo explica.
  - Para publicar en Google Play habrá que declarar el uso del permiso de servicio de ubicación. No afecta a quienes instalan el APK directo.
- **Duración** (mi llamada): 2 horas por defecto (el servidor admite 60 o 120 minutos). Se corta solo al vencer. Una solicitud sin respuesta vence a los 15 minutos.
- **Llegada:** a menos de 50 m entre los dos, con ambas posiciones de menos de 2 minutos. Avisa con vibración y un cartel; no corta solo.
- **Al terminar** (por cualquiera, por vencimiento, por bloqueo o por quitar el contacto) se **borran las posiciones exactas**.
- **"Cómo llegar":** botón que abre Google Maps con el punto del otro como destino. Rutas propias de transporte quedan para más adelante.
- **Aviso:** push al contacto ("Diego va para allá") y al solicitante cuando acepta, por la misma vía que ya usan los mensajes.
- **Aviso de llegada:** en pantalla, vibración, y además una **notificación local con sonido** (`expo-notifications`, que ya está instalado), para que suene con la pantalla bloqueada. Se avisa una sola vez por llegada.

## Anti-objetivos

- Que alguien vea la posición exacta de otra persona sin que esa persona haya aceptado, o después de que el encuentro terminó.
- Que un tercero pueda leer posiciones de un encuentro ajeno.
- Que un contacto bloqueado o quitado siga viendo la ubicación.

## No objetivos

iPhone (no hay build para iOS), grupos de más de dos personas, historial de recorridos, rutas de transporte propias.
