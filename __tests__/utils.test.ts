import { haversineDistance, buildWhatsAppUrl, formatDistance, formatRating } from '@/lib/utils'

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(-33.48, -60.03, -33.48, -60.03)).toBe(0)
  })

  it('calculates distance between Ramallo and San Nicolás (~22km)', () => {
    const dist = haversineDistance(-33.48, -60.03, -33.33, -60.22)
    expect(dist).toBeGreaterThan(20)
    expect(dist).toBeLessThan(30)
  })
})

describe('buildWhatsAppUrl', () => {
  it('strips non-digits from phone', () => {
    const url = buildWhatsAppUrl('+54 911 2345-6789', 'Hola')
    expect(url).toBe('https://wa.me/5491123456789?text=Hola')
  })

  it('encodes message with spaces', () => {
    const url = buildWhatsAppUrl('5491112345678', 'Me interesa tu servicio')
    expect(url).toContain('Me%20interesa%20tu%20servicio')
  })
})

describe('formatDistance', () => {
  it('shows meters for distances under 1km', () => {
    expect(formatDistance(0.5)).toBe('500m')
  })
  it('shows km for distances 1km+', () => {
    expect(formatDistance(3.7)).toBe('3.7km')
  })
})

describe('formatRating', () => {
  it('shows "Sin reseñas" for null', () => {
    expect(formatRating(null)).toBe('Sin reseñas')
  })
  it('shows one decimal', () => {
    expect(formatRating(4.666)).toBe('4.7')
  })
})
