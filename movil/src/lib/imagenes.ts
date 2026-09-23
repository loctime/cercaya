// Subida de imagenes a Storage. Cada usuario solo puede escribir en su
// carpeta (<user_id>/...), lo exige la policy del bucket.
import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

export type FotoLocal = { uri: string; mimeType?: string | null }

export async function elegirImagenes(max: number, opciones?: { cuadrada?: boolean }): Promise<FotoLocal[]> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permiso.granted) return []
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // El recorte solo existe eligiendo de a una.
    allowsMultipleSelection: max > 1 && !opciones?.cuadrada,
    allowsEditing: !!opciones?.cuadrada,
    aspect: opciones?.cuadrada ? [1, 1] : undefined,
    selectionLimit: max,
    quality: 0.6,
  })
  if (r.canceled) return []
  return r.assets.slice(0, max).map((a) => ({ uri: a.uri, mimeType: a.mimeType }))
}

// Sube y devuelve la ruta dentro del bucket.
export async function subirImagen(bucket: 'avatares' | 'galeria' | 'pedidos', carpeta: string, foto: FotoLocal) {
  const datos = await (await fetch(foto.uri)).arrayBuffer()
  const tipo = foto.mimeType ?? 'image/jpeg'
  const ext = tipo.split('/')[1] ?? 'jpg'
  const ruta = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(ruta, datos, { contentType: tipo })
  if (error) throw error
  return ruta
}

export const urlPublica = (bucket: 'avatares' | 'galeria', ruta: string) =>
  supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl

// Borra todos mis archivos (antes de eliminar la cuenta). En "pedidos"
// hay una subcarpeta por pedido: <yo>/<pedido>/foto.
export async function borrarMisArchivos(yo: string) {
  for (const bucket of ['avatares', 'galeria', 'pedidos'] as const) {
    const { data: raiz } = await supabase.storage.from(bucket).list(yo, { limit: 1000 })
    const rutas: string[] = []
    for (const item of raiz ?? []) {
      if (item.id) {
        rutas.push(`${yo}/${item.name}`)
      } else {
        const { data: sub } = await supabase.storage.from(bucket).list(`${yo}/${item.name}`, { limit: 1000 })
        for (const f of sub ?? []) rutas.push(`${yo}/${item.name}/${f.name}`)
      }
    }
    if (rutas.length) await supabase.storage.from(bucket).remove(rutas)
  }
}
