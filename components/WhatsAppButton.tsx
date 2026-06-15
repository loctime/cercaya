'use client'
import { buildWhatsAppUrl, defaultProviderMessage } from '@/lib/utils'

interface Props {
  phone: string
  providerName: string
  categoryName?: string
}

export default function WhatsAppButton({ phone, providerName, categoryName = 'servicios' }: Props) {
  const url = buildWhatsAppUrl(phone, defaultProviderMessage(providerName, categoryName))
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-3 rounded-xl font-semibold hover:bg-[#20BA5A] transition"
    >
      <span>💬</span> Contactar por WhatsApp
    </a>
  )
}
