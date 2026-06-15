import Link from 'next/link'
import { Category } from '@/lib/types'

const CATEGORY_CONFIG: Record<string, { bg: string; icon: React.ReactNode }> = {
  'Corte de pasto': {
    bg: 'bg-green-100',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5c0 0 1.5-3 4.5-3s4.5 3 4.5 3m0 0c0 0 1.5-3 4.5-3s4.5 3 4.5 3M3 17h18M3 17v-1.5M21 17v-1.5M12 6v4m0-4C12 4.343 11.328 3 10.5 3S9 4.343 9 6m3 0c0-1.657.672-3 1.5-3S15 4.343 15 6" />
      </svg>
    ),
  },
  'Poda de árboles': {
    bg: 'bg-emerald-100',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C9 3 6 6 6 9c0 2.4 1.5 4.5 3.75 5.4V18h4.5v-3.6C16.5 13.5 18 11.4 18 9c0-3-3-6-6-6zM9.75 18h4.5v2.25a.75.75 0 01-1.5 0V18h-1.5v2.25a.75.75 0 01-1.5 0V18z" />
      </svg>
    ),
  },
  'Limpieza de jardín': {
    bg: 'bg-lime-100',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-lime-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 21l7-14 7 14M8 15h8" />
      </svg>
    ),
  },
  'Plomería': {
    bg: 'bg-blue-100',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  'Electricidad': {
    bg: 'bg-yellow-100',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
      </svg>
    ),
  },
  'Pintura': {
    bg: 'bg-purple-100',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  'Albañilería': {
    bg: 'bg-orange-100',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  'Limpieza del hogar': {
    bg: 'bg-sky-100',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
}

const DEFAULT_CONFIG = {
  bg: 'bg-gray-100',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63" />
    </svg>
  ),
}

export default function CategoryPicker({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {categories.map(cat => {
        const config = CATEGORY_CONFIG[cat.name] ?? DEFAULT_CONFIG
        return (
          <Link
            key={cat.id}
            href={`/providers?category=${cat.id}`}
            className="flex flex-col items-center gap-3 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md border-2 border-transparent hover:border-green-300 transition active:scale-95"
          >
            <div className={`${config.bg} w-16 h-16 rounded-2xl flex items-center justify-center`}>
              {config.icon}
            </div>
            <span className="text-sm font-medium text-center text-gray-700 leading-tight">{cat.name}</span>
          </Link>
        )
      })}
    </div>
  )
}
