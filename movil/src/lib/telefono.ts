// Celulares argentinos a formato internacional de WhatsApp (549 + area + numero).
// La gente los escribe de mil formas: "3407 15 123456", "03407-123456",
// "+54 9 3407 123456". El numero nacional tiene 10 digitos (area + abonado)
// y el "15" movil va despues del codigo de area (2 a 4 digitos).
export function numeroWhatsApp(crudo: string): string | null {
  let d = crudo.replace(/\D/g, '')
  if (d.startsWith('549')) d = d.slice(3)
  else if (d.startsWith('54')) d = d.slice(2)
  d = d.replace(/^0/, '')

  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === '15') {
        d = d.slice(0, area) + d.slice(area + 2)
        break
      }
    }
  }
  return d.length === 10 ? `549${d}` : null
}
