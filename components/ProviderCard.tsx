import Link from 'next/link'
import Image from 'next/image'
import StarRating from './StarRating'
import { ProviderNear } from '@/lib/types'
import { formatDistance } from '@/lib/utils'

export default function ProviderCard({ provider }: { provider: ProviderNear }) {
  return (
    <Link
      href={`/providers/${provider.id}`}
      className="flex gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md border border-transparent hover:border-green-200 transition"
    >
      <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
        {provider.avatar_url ? (
          <Image src={provider.avatar_url} alt={provider.full_name} width={64} height={64} className="object-cover w-full h-full" />
        ) : (
          <span className="text-2xl text-gray-400 font-semibold">
            {provider.full_name[0].toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 truncate">{provider.full_name}</h3>
          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
            📍 {formatDistance(provider.distance_km)}
          </span>
        </div>
        <StarRating rating={provider.avg_rating} count={provider.review_count} />
        {provider.price_range && (
          <p className="text-sm text-green-600 mt-1">{provider.price_range}</p>
        )}
        {provider.bio && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{provider.bio}</p>
        )}
      </div>
    </Link>
  )
}
