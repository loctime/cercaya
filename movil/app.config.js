// Config dinámica sobre app.json. google-services.json (Firebase, para
// notificaciones en Android) no se sube al repo: en EAS llega como archivo
// secreto (variable GOOGLE_SERVICES_JSON); en esta PC se usa el local.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
})
