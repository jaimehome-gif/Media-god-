import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Navbar } from '@/components/navbar'
import Link from 'next/link'
import Image from 'next/image'
import { getFavorites, removeFromFavorites } from '@/app/actions/media'
import { getImageUrl } from '@/lib/tmdb'
import { Heart, Play, Film, Tv } from 'lucide-react'
import { WatchlistActions } from '@/components/watchlist-actions'

export const metadata = {
  title: 'My Favorites - StreamVibe',
  description: 'Your favorite movies and TV shows',
}

export default async function FavoritesPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/sign-in')

  const favorites = await getFavorites()

  return (
    <main className="min-h-screen bg-background pt-16">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Heart className="w-6 h-6 text-red-500 fill-current" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">My Favorites</h1>
            <p className="text-muted-foreground">{favorites.length} items</p>
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No favorites yet</h2>
            <p className="text-muted-foreground mb-6">
              Start adding your favorite movies and TV shows
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Browse Content
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {favorites.map((item) => {
              const posterUrl = getImageUrl(item.posterPath, 'w500')
              return (
                <div key={item.id} className="group relative">
                  <Link
                    href={`/${item.mediaType}/${item.mediaId}`}
                    className="block"
                  >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary">
                      {posterUrl ? (
                        <Image
                          src={posterUrl}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {item.mediaType === 'movie' ? (
                            <Film className="w-12 h-12 text-muted-foreground" />
                          ) : (
                            <Tv className="w-12 h-12 text-muted-foreground" />
                          )}
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                            <Play className="w-4 h-4 fill-current" />
                            Watch Now
                          </div>
                        </div>
                      </div>

                      {/* Heart badge */}
                      <div className="absolute top-2 left-2">
                        <Heart className="w-5 h-5 text-red-500 fill-current" />
                      </div>
                    </div>

                    <div className="mt-2 px-1">
                      <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                    </div>
                  </Link>

                  {/* Remove button */}
                  <WatchlistActions
                    mediaId={item.mediaId}
                    mediaType={item.mediaType}
                    action={removeFromFavorites}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
