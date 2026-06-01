import { Navbar } from '@/components/navbar'
import { MediaCard } from '@/components/media-card'
import {
  getPopularTVShows,
  getTopRatedTVShows,
  getOnTheAirTVShows,
  getTVGenres,
  discoverTVShows,
} from '@/lib/tmdb'

export const metadata = {
  title: 'TV Shows - StreamVibe',
  description: 'Browse popular, top rated, and on-air TV shows',
}

export default async function TVShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; genre?: string; page?: string }>
}) {
  const params = await searchParams
  const category = params.category || 'popular'
  const genreId = params.genre
  const page = parseInt(params.page || '1')

  const genres = await getTVGenres()

  let shows
  let title = 'TV Shows'

  if (genreId) {
    const genre = genres.find((g) => g.id === parseInt(genreId))
    title = genre ? `${genre.name} TV Shows` : 'TV Shows'
    shows = await discoverTVShows({ page, with_genres: genreId })
  } else {
    switch (category) {
      case 'top_rated':
        title = 'Top Rated TV Shows'
        shows = await getTopRatedTVShows(page)
        break
      case 'on_the_air':
        title = 'On The Air'
        shows = await getOnTheAirTVShows(page)
        break
      default:
        title = 'Popular TV Shows'
        shows = await getPopularTVShows(page)
    }
  }

  return (
    <main className="min-h-screen bg-background pt-16">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{title}</h1>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'popular', label: 'Popular' },
              { key: 'top_rated', label: 'Top Rated' },
              { key: 'on_the_air', label: 'On The Air' },
            ].map((cat) => (
              <a
                key={cat.key}
                href={`/tv-shows?category=${cat.key}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  category === cat.key && !genreId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {cat.label}
              </a>
            ))}
          </div>

          {/* Genre filters */}
          <div className="flex flex-wrap gap-2">
            {genres.slice(0, 12).map((genre) => (
              <a
                key={genre.id}
                href={`/tv-shows?genre=${genre.id}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  genreId === String(genre.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {genre.name}
              </a>
            ))}
          </div>
        </div>

        {/* Shows grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {shows.results.map((show) => (
            <MediaCard key={show.id} item={show} mediaType="tv" />
          ))}
        </div>

        {/* Pagination */}
        {shows.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            {page > 1 && (
              <a
                href={`/tv-shows?${genreId ? `genre=${genreId}` : `category=${category}`}&page=${page - 1}`}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Previous
              </a>
            )}
            <span className="px-4 py-2 text-muted-foreground">
              Page {page} of {Math.min(shows.total_pages, 500)}
            </span>
            {page < Math.min(shows.total_pages, 500) && (
              <a
                href={`/tv-shows?${genreId ? `genre=${genreId}` : `category=${category}`}&page=${page + 1}`}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Next
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
