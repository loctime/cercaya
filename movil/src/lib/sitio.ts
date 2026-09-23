// Páginas de la web (vidriera + legales). Las tiendas exigen que existan.
import { Linking } from 'react-native'

const SITIO = 'https://www.cercaya.controlapps.ar'

export const PAGINAS = {
  soporte: `${SITIO}/soporte`,
  terminos: `${SITIO}/terminos`,
  privacidad: `${SITIO}/privacidad`,
  borrarCuenta: `${SITIO}/borrar-cuenta`,
} as const

export const abrirPagina = (p: keyof typeof PAGINAS) => Linking.openURL(PAGINAS[p])
