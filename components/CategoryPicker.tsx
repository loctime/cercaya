import Link from 'next/link'
import { Category } from '@/lib/types'

export default function CategoryPicker({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {categories.map(cat => (
        <Link
          key={cat.id}
          href={`/providers?category=${cat.id}`}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-green-400 border-2 border-transparent transition"
        >
          <span className="text-3xl">{cat.icon}</span>
          <span className="text-sm font-medium text-center text-gray-700">{cat.name}</span>
        </Link>
      ))}
    </div>
  )
}
