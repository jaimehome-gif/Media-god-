import { Navbar } from '@/components/navbar'
import { MediaCard } from '@/components/media-card'
import {
  getTrending,
  getPopularMovies,
  getTopRatedMovies,
  getPopularTVShows,
  getTopRatedTVShows,
  type MediaItem,
} from '@/lib/tmdb'

export const metadata = {
  title: 'Browse - StreamVibe',
  description: 'Browse trending movies and TV shows',
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  const category = params.category || 'trending'

  let items: MediaItem[]
  let title: string

  switch (category) {
    case 'popular_movies':
      title = 'Popular Movies'
      items = (await getPopularMovies()).results.map((m) => ({ ...m, media_type: 'movie' as const }))
      break
    case 'top_rated_movies':
      title = 'Top Rated Movies'
      items = (await getTopRatedMovies()).results.map((m) => ({ ...m, media_type: 'movie' as const }))
      break
    case 'popular_tv':
      title = 'Popular TV Shows'
      items = (await getPopularTVShows()).results.map((t) => ({ ...t, title: t.name, media_type: 'tv' as const }))
      break
    case 'top_rated_tv':
      title = 'Top Rated TV Shows'
      items = (await getTopRatedTVShows()).results.map((t) => ({ ...t, title: t.name, media_type: 'tv' as const }))
      break
    default:
      title = 'Trending Now'
      items = await getTrending()
  }

  const categories = [
    { key: 'trending', label: 'Trending' },
    { key: 'popular_movies', label: 'Popular Movies' },
    { key: 'top_rated_movies', label: 'Top Rated Movies' },
    { key: 'popular_tv', label: 'Popular TV' },
    { key: 'top_rated_tv', label: 'Top Rated TV' },
  ]

  return (
    <main className="min-h-screen bg-background pt-16">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">{title}</h1>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <a
              key={cat.key}
              href={`/browse?category=${cat.key}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === cat.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {cat.label}
            </a>
          ))}
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {items.map((item) => (
            <MediaCard key={`${item.id}-${item.media_type}`} item={item} />
          ))}
        </div>
      </div>
    </main>
  )
}
