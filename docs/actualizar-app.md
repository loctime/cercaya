# Cómo actualizar la app (CercaYa, Expo)

Sin contraseñas ni claves en este archivo: el repo es público. El token de Expo está en
`~/.claude/settings.json` (`EXPO_TOKEN`).

## Dos tipos de cambio

| Cambié... | Qué hacer | Quién lo recibe |
|---|---|---|
| Solo código JS/TS, pantallas, textos, estilos | **Update por internet** (1 comando) | Todos los que tengan un APK con la **misma `version`** de `movil/app.json` |
| Algo **nativo**: librería con código nativo, permisos, plugins de `app.json`, ícono, splash | **APK nuevo** + subir `version` | Hay que instalar el APK a mano |

Cómo saber si es nativo: si agregaste un paquete con `npx expo install` que trae código nativo
(cámara, mapas, ubicación, login de Google...), o tocaste `plugins`/`android`/`ios`/`icon` en
`app.json`. Ante la duda, tratalo como nativo: una update con código nativo nuevo **rompe** los
APK viejos.

## A) Update por internet (lo de todos los días)

Desde `movil/`, parado en la rama correcta (EAS publica lo que hay en el disco, no una rama):

```bash
npx tsc --noEmit && npm test
EXPO_TOKEN=... npm run actualizar:prueba -- "qué cambió"
```

- Canal `preview`, solo Android. El runtime es la `version` de `app.json` (política `appVersion`).
- Las migraciones de base van **antes** que la update, y siempre aditivas (los APK viejos siguen
  usando la base).
- La app se actualiza sola: al abrir y cada vez que vuelve a primer plano pregunta, baja y se
  reinicia con el cartel "Actualizando CercaYa…". Mínimo 1 minuto entre chequeos.
- Verificar: Perfil, al final, muestra `CercaYa <version> · <id de la update>`; el botón
  "Buscar actualización" fuerza el chequeo a mano.
- Una update en medio de un encuentro activo reinicia la app (el encuentro se retoma solo).

## B) APK nuevo (cambio nativo)

1. Subir `version` en `movil/app.json` (ej. 1.2.0 → 1.3.0). Cambia el runtime: los APK viejos
   dejan de recibir updates, es lo esperado.
2. `EXPO_TOKEN=... npx eas-cli@latest build --profile preview --platform android --non-interactive --no-wait`
3. Cuando termina: `npx eas-cli@latest build:view <id>` → "Application Archive URL" es el link
   del APK para pasar a los testers.
4. **Forzar a todos** a pasarse a la nueva (SQL en Supabase):
   ```sql
   update app_config set valor = '1.3.0' where clave = 'version_minima';
   update app_config set valor = '<link del APK>' where clave = 'url_descarga';
   -- opcional: update app_config set valor = '...' where clave = 'mensaje';
   ```
   Quien tenga una versión menor ve una pantalla "Hay una versión nueva" con botón Descargar.
   La mínima **se sube solo cuando el APK nuevo ya existe**; si no, se bloquea a todos sin salida.
   Para desbloquear: bajarla de nuevo (`'1.0.0'`).
5. Después de instalar el APK nuevo, publicar la update (A) si hay cambios de JS pendientes.

## Gotchas

- El link del APK sirve solo para Android; instalar pide "orígenes desconocidos". Mismo package id
  que el dev client: **no instalarlo en el celu donde esté el dev client**.
- El dev client (`expo start`) y Expo Go **no** reciben updates; la versión sale como `0.0.0`.
- `EXPO_TOKEN` en el entorno rompe `expo start --tunnel` ("Cannot use ngrok with a robot user"):
  usar `env -u EXPO_TOKEN` para el servidor, y el token solo para `eas`.
- Los worktrees no traen `movil/.env` (gitignored): copiarlo del repo principal.
- Las `EXPO_PUBLIC_SUPABASE_*` están en `eas.json` y en EAS env; sin eso la app compilada no conecta.
- iOS: no hay build (falta cuenta Apple Developer). Las updates de arriba son solo Android.

## Estado (24/10/2026)

- APK vigente **1.2.0** (build `a48d6f0a-2ec5-4fdc-adbc-8c5e85dfae7b`):
  https://expo.dev/artifacts/eas/RCxea0unOp5oW1EQxKZ9F-hIqymDwZTP3DQsCEyCkaU.apk
- Los APK 1.0.0 y 1.1.0 no reciben updates: hay que reinstalar.
- `version_minima` en `1.0.0` (no bloquea a nadie), `url_descarga` vacío.
- Migración de la versión mínima: `supabase/migrations/0109_version_minima.sql`
  (`app_config` + `version_app()`, ejecutable por `anon` y `authenticated`).
- Código: `movil/src/lib/actualizaciones.tsx` (proveedor), `movil/src/lib/version.ts` (compara
  versiones, con test).

- **Modo Trabajo (24/10/2026):** migración `0111_modo_trabajo.sql` en producción (`ofrece_servicios`,
  `buscar_servicio()`, tope de 10 chats nuevos por día con desconocidos, sinónimos de canilla/luz/etc. y arreglo de
  `buscar_habilidades_cerca`). Actualización de la app publicada en `preview` (runtime 1.2.0), sin cambio nativo.
  Diseño: `docs/superpowers/specs/2026-10-24-modo-trabajo-design.md`; plan: `docs/superpowers/plans/2026-10-24-modo-trabajo.md`.
- Bots para probarlo: `node scripts/bots.mjs sembrar` (Lucía, Mateo, Nicolás, Camila y Tomás ofrecen servicios; Bruno no) y
  `node scripts/bots.mjs buscar <bot> "canilla rota"` para ver qué devuelve el servidor.

## Bots de prueba

`scripts/bots.mjs` (8 bots `bot-*@cercaya.test` contra producción). Uso en el encabezado del
archivo. `correr` tiene que estar andando para que los bots respondan; no sobrevive al cierre
de la sesión. `limpiar` o `supabase/demo/borrar_demo.sql` los borran.
