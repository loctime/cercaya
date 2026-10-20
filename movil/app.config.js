// Config dinámica sobre app.json. google-services.json (Firebase, para
// notificaciones en Android) no se sube al repo: en EAS llega como archivo
// secreto (variable GOOGLE_SERVICES_JSON); en esta PC se usa el local.
const fs = require('node:fs')

const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'

// Clave de Google Maps para Android: la misma clave Android del proyecto de
// Firebase (cercaya-14f06). Se lee del google-services.json para no escribirla
// en el repo, que es publico. Hace falta tener habilitado "Maps SDK for Android"
// en ese proyecto de Google Cloud.
function claveDeMapas() {
  try {
    const json = JSON.parse(fs.readFileSync(googleServicesFile, 'utf8'))
    return json.client?.[0]?.api_key?.[0]?.current_key
  } catch {
    return undefined
  }
}

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile,
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? claveDeMapas() } },
  },
})
