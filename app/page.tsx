import { Navbar } from '@/components/navbar'
import { HeroSlider } from '@/components/hero-slider'
import { MediaRow } from '@/components/media-row'
import { ContinueWatchingRow } from '@/components/continue-watching-row'
import {
  getTrending,
  getPopularMovies,
  getTopRatedMovies,
  getPopularTVShows,
  getNowPlayingMovies,
  getOnTheAirTVShows,
  type MediaItem,
} from '@/lib/tmdb'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  const [trending, popularMovies, topRatedMovies, popularTV, nowPlaying, onTheAir] = await Promise.all([
    getTrending('all', 'week'),
    getPopularMovies(),
    getTopRatedMovies(),
    getPopularTVShows(),
    getNowPlayingMovies(),
    getOnTheAirTVShows(),
  ])

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <HeroSlider items={trending.slice(0, 6) as MediaItem[]} />

      <div className="flex flex-col gap-8 py-8">
        {/* Continue Watching - Only for logged in users */}
        {session?.user && <ContinueWatchingRow />}

        {/* Trending Now */}
        <MediaRow
          title="Trending Now"
          items={trending as MediaItem[]}
          viewAllHref="/browse?category=trending"
        />

        {/* Now Playing Movies */}
        <MediaRow
          title="Now Playing"
          items={nowPlaying.results}
          mediaType="movie"
          viewAllHref="/movies?category=now_playing"
        />

        {/* Popular Movies */}
        <MediaRow
          title="Popular Movies"
          items={popularMovies.results}
          mediaType="movie"
          viewAllHref="/movies"
        />

        {/* On The Air TV Shows */}
        <MediaRow
          title="On The Air"
          items={onTheAir.results}
          mediaType="tv"
          viewAllHref="/tv-shows?category=on_the_air"
        />

        {/* Popular TV Shows */}
        <MediaRow
          title="Popular TV Shows"
          items={popularTV.results}
          mediaType="tv"
          viewAllHref="/tv-shows"
        />

        {/* Top Rated Movies */}
        <MediaRow
          title="Top Rated Movies"
          items={topRatedMovies.results}
          mediaType="movie"
          viewAllHref="/movies?category=top_rated"
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-8">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              StreamVibe - Your ultimate streaming destination
            </p>
            <p className="text-xs text-muted-foreground">
              Powered by TMDB API. This is a demo application.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
