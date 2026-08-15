import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { MediaRow } from '@/components/media-row'
import { MediaActions } from '@/components/media-actions'
import {
  getTVShowDetails,
  getTVShowCredits,
  getTVShowVideos,
  getSimilarTVShows,
  getImageUrl,
} from '@/lib/tmdb'
import { Play, Star, Calendar, Tv } from 'lucide-react'
import { Button } from '@/components/ui/button'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const show = await getTVShowDetails(parseInt(id)).catch(() => null)
  if (!show) return { title: 'TV Show Not Found' }
  return {
    title: `${show.name} - StreamVibe`,
    description: show.overview,
  }
}

export default async function TVShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const showId = parseInt(id)

  const [show, cast, videos, similar] = await Promise.all([
    getTVShowDetails(showId).catch(() => null),
    getTVShowCredits(showId).catch(() => []),
    getTVShowVideos(showId).catch(() => []),
    getSimilarTVShows(showId).catch(() => []),
  ])

  if (!show) notFound()

  const backdropUrl = getImageUrl(show.backdrop_path, 'original')
  const posterUrl = getImageUrl(show.poster_path, 'w500')
  const trailer = videos.find((v) => v.type === 'Trailer') || videos[0]

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
              alt={show.name}
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
                    alt={show.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Tv className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2 text-balance">
                {show.name}
              </h1>

              {show.tagline && (
                <p className="text-lg text-muted-foreground italic mb-4">{show.tagline}</p>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
                {show.vote_average > 0 && (
                  <div className="flex items-center gap-1 text-primary">
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-semibold">{show.vote_average.toFixed(1)}</span>
                    <span className="text-muted-foreground">({show.vote_count.toLocaleString()})</span>
                  </div>
                )}
                {show.first_air_date && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {new Date(show.first_air_date).getFullYear()}
                  </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Tv className="w-4 h-4" />
                  {show.number_of_seasons} Season{show.number_of_seasons !== 1 ? 's' : ''}
                </div>
                <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">
                  {show.status}
                </span>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-6">
                {show.genres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/tv-shows?genre=${genre.id}`}
                    className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>

              {/* Overview */}
              <p className="text-foreground/90 mb-6 text-pretty max-w-2xl leading-relaxed">
                {show.overview}
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
                  mediaId={show.id}
                  mediaType="tv"
                  title={show.name}
                  posterPath={show.poster_path}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seasons */}
      {show.seasons.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Seasons</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4">
            {show.seasons
              .filter((s) => s.season_number > 0)
              .map((season) => (
                <div
                  key={season.id}
                  className="flex-shrink-0 w-[150px] rounded-xl overflow-hidden bg-card"
                >
                  <div className="relative aspect-[2/3]">
                    {season.poster_path ? (
                      <Image
                        src={getImageUrl(season.poster_path, 'w300') || ''}
                        alt={season.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <Tv className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm text-foreground truncate">{season.name}</p>
                    <p className="text-xs text-muted-foreground">{season.episode_count} episodes</p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

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

      {/* Similar Shows */}
      {similar.length > 0 && (
        <div className="py-8">
          <MediaRow title="Similar TV Shows" items={similar} mediaType="tv" />
        </div>
      )}
    </main>
  )
}
