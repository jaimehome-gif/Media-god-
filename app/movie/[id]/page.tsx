import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { MediaRow } from '@/components/media-row'
import { MediaActions } from '@/components/media-actions'
import {
  getMovieDetails,
  getMovieCredits,
  getMovieVideos,
  getSimilarMovies,
  getImageUrl,
} from '@/lib/tmdb'
import { Play, Star, Clock, Calendar, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const movie = await getMovieDetails(parseInt(id)).catch(() => null)
  if (!movie) return { title: 'Movie Not Found' }
  return {
    title: `${movie.title} - StreamVibe`,
    description: movie.overview,
  }
}

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const movieId = parseInt(id)

  const [movie, cast, videos, similar] = await Promise.all([
    getMovieDetails(movieId).catch(() => null),
    getMovieCredits(movieId).catch(() => []),
    getMovieVideos(movieId).catch(() => []),
    getSimilarMovies(movieId).catch(() => []),
  ])

  if (!movie) notFound()

  const backdropUrl = getImageUrl(movie.backdrop_path, 'original')
  const posterUrl = getImageUrl(movie.poster_path, 'w500')
  const trailer = videos.find((v) => v.type === 'Trailer') || videos[0]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <div className="relative w-full min-h-[60vh] pt-16">
        {/* Background */}
        <div className="absolute inset-0">
          {backdropUrl ? (
            <Image
              src={backdropUrl}
              alt={movie.title}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="relative w-[200px] sm:w-[250px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                {posterUrl ? (
                  <Image
                    src={posterUrl}
                    alt={movie.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Play className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2 text-balance">
                {movie.title}
              </h1>

              {movie.tagline && (
                <p className="text-lg text-muted-foreground italic mb-4">{movie.tagline}</p>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
                {movie.vote_average > 0 && (
                  <div className="flex items-center gap-1 text-primary">
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-semibold">{movie.vote_average.toFixed(1)}</span>
                    <span className="text-muted-foreground">({movie.vote_count.toLocaleString()})</span>
                  </div>
                )}
                {movie.release_date && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {new Date(movie.release_date).getFullYear()}
                  </div>
                )}
                {movie.runtime > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {formatRuntime(movie.runtime)}
                  </div>
                )}
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-6">
                {movie.genres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/movies?genre=${genre.id}`}
                    className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>

              {/* Overview */}
              <p className="text-foreground/90 mb-6 text-pretty max-w-2xl leading-relaxed">
                {movie.overview}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 mb-8">
                {trailer && (
                  <Button asChild size="lg" className="gap-2">
                    <a
                      href={`https://www.youtube.com/watch?v=${trailer.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Watch Trailer
                    </a>
                  </Button>
                )}
                <MediaActions
                  mediaId={movie.id}
                  mediaType="movie"
                  title={movie.title}
                  posterPath={movie.poster_path}
                />
              </div>

              {/* Budget & Revenue */}
              {(movie.budget > 0 || movie.revenue > 0) && (
                <div className="flex flex-wrap gap-6 text-sm">
                  {movie.budget > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>Budget:</span>
                      <span className="text-foreground">{formatCurrency(movie.budget)}</span>
                    </div>
                  )}
                  {movie.revenue > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>Revenue:</span>
                      <span className="text-foreground">{formatCurrency(movie.revenue)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cast */}
      {cast.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Cast</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4">
            {cast.map((person) => (
              <div key={person.id} className="flex-shrink-0 w-[120px] text-center">
                <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden mx-auto mb-2 bg-secondary">
                  {person.profile_path ? (
                    <Image
                      src={getImageUrl(person.profile_path, 'w200') || ''}
                      alt={person.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground">
                      {person.name[0]}
                    </div>
                  )}
                </div>
                <p className="font-medium text-sm text-foreground truncate">{person.name}</p>
                <p className="text-xs text-muted-foreground truncate">{person.character}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Similar Movies */}
      {similar.length > 0 && (
        <div className="py-8">
          <MediaRow title="Similar Movies" items={similar} mediaType="movie" />
        </div>
      )}
    </main>
  )
}
