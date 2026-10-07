import { Navbar } from '@/components/navbar'
import { MediaCard } from '@/components/media-card'
import {
  getPopularMovies,
  getTopRatedMovies,
  getNowPlayingMovies,
  getUpcomingMovies,
  getMovieGenres,
  discoverMovies,
} from '@/lib/tmdb'

export const metadata = {
  title: 'Movies - StreamVibe',
  description: 'Browse popular, top rated, and upcoming movies',
}

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; genre?: string; page?: string }>
}) {
  const params = await searchParams
  const category = params.category || 'popular'
  const genreId = params.genre
  const page = parseInt(params.page || '1')

  const genres = await getMovieGenres()

  let movies
  let title = 'Movies'

  if (genreId) {
    const genre = genres.find((g) => g.id === parseInt(genreId))
    title = genre ? `${genre.name} Movies` : 'Movies'
    movies = await discoverMovies({ page, with_genres: genreId })
  } else {
    switch (category) {
      case 'top_rated':
        title = 'Top Rated Movies'
        movies = await getTopRatedMovies(page)
        break
      case 'now_playing':
        title = 'Now Playing'
        movies = await getNowPlayingMovies(page)
        break
      case 'upcoming':
        title = 'Upcoming Movies'
        movies = await getUpcomingMovies(page)
        break
      default:
        title = 'Popular Movies'
        movies = await getPopularMovies(page)
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
              { key: 'now_playing', label: 'Now Playing' },
              { key: 'upcoming', label: 'Upcoming' },
            ].map((cat) => (
              <a
                key={cat.key}
                href={`/movies?category=${cat.key}`}
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
                href={`/movies?genre=${genre.id}`}
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

        {/* Movies grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {movies.results.map((movie) => (
            <MediaCard key={movie.id} item={movie} mediaType="movie" />
          ))}
        </div>

        {/* Pagination */}
        {movies.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            {page > 1 && (
              <a
                href={`/movies?${genreId ? `genre=${genreId}` : `category=${category}`}&page=${page - 1}`}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Previous
              </a>
            )}
            <span className="px-4 py-2 text-muted-foreground">
              Page {page} of {Math.min(movies.total_pages, 500)}
            </span>
            {page < Math.min(movies.total_pages, 500) && (
              <a
                href={`/movies?${genreId ? `genre=${genreId}` : `category=${category}`}&page=${page + 1}`}
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
