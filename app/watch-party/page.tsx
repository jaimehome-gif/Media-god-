import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Navbar } from '@/components/navbar'
import Link from 'next/link'
import Image from 'next/image'
import { getActiveWatchParties } from '@/app/actions/media'
import { getImageUrl } from '@/lib/tmdb'
import { Users, Plus, Play, Film, Tv } from 'lucide-react'
import { JoinPartyForm } from '@/components/join-party-form'

export const metadata = {
  title: 'Watch Parties - StreamVibe',
  description: 'Watch together with friends',
}

export default async function WatchPartyPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/sign-in')

  const parties = await getActiveWatchParties()

  return (
    <main className="min-h-screen bg-background pt-16">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Watch Parties</h1>
              <p className="text-muted-foreground">Watch together with friends in sync</p>
            </div>
          </div>
        </div>

        {/* Join Party Section */}
        <div className="mb-12 p-6 rounded-2xl bg-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Join a Watch Party</h2>
          <JoinPartyForm />
        </div>

        {/* Active Parties */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Your Active Parties</h2>
          
          {parties.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No active parties</h3>
              <p className="text-muted-foreground mb-6">
                Create a watch party from any movie or TV show page
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Browse Content
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {parties.map((party) => {
                const posterUrl = getImageUrl(party.posterPath, 'w500')
                return (
                  <Link
                    key={party.id}
                    href={`/watch-party/${party.id}`}
                    className="group flex gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all"
                  >
                    <div className="relative w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
                      {posterUrl ? (
                        <Image
                          src={posterUrl}
                          alt={party.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {party.mediaType === 'movie' ? (
                            <Film className="w-8 h-8 text-muted-foreground" />
                          ) : (
                            <Tv className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                          {party.title}
                        </h3>
                        <p className="text-sm text-muted-foreground capitalize mt-1">
                          {party.mediaType}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Active
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
                          <Play className="w-3 h-3 fill-current" />
                          Join
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
          <h2 className="text-lg font-semibold text-foreground mb-4">How Watch Parties Work</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-medium text-foreground">Create a Party</h3>
                <p className="text-sm text-muted-foreground">
                  Start a watch party from any movie or TV show
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-medium text-foreground">Share the Code</h3>
                <p className="text-sm text-muted-foreground">
                  Send the party code to your friends
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-medium text-foreground">Watch Together</h3>
                <p className="text-sm text-muted-foreground">
                  Everyone watches in perfect sync
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
