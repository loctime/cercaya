import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Categoria = { id: number; slug: string; name: string; icon: string; sort: number }

let cache: Categoria[] | null = null

// Las categorias casi no cambian: se piden una vez por sesion de la app.
export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>(cache ?? [])
  useEffect(() => {
    if (cache) return
    supabase
      .from('categories')
      .select('id, slug, name, icon, sort')
      .order('sort')
      .then(({ data }) => {
        cache = data ?? []
        setCategorias(cache)
      })
  }, [])
  return categorias
}

// Distancia que devuelve el servidor: 0 = "menos de 1 km".
export function textoDistancia(km: number | string | null | undefined): string {
  if (km == null) return ''
  const n = Number(km)
  if (n === 0) return 'a menos de 1 km'
  return `a ~${n.toLocaleString('es-AR')} km`
}

// Fechas siempre DD/MM/AAAA.
export function fecha(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}
