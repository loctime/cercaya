export default function StarRating({ rating, count }: { rating: number | null; count: number }) {
  const stars = rating ? Math.round(rating) : 0
  return (
    <div className="flex items-center gap-1 text-sm">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= stars ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
      <span className="text-gray-500 ml-1">
        {rating ? `${rating.toFixed(1)} (${count})` : 'Sin reseñas'}
      </span>
    </div>
  )
}
