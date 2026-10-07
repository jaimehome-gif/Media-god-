import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Navbar } from '@/components/navbar'
import Image from 'next/image'
import { getWatchParty } from '@/app/actions/media'
import { getImageUrl } from '@/lib/tmdb'
import { Users, Copy, Play, MessageCircle, Film, Tv } from 'lucide-react'
import { WatchPartyControls } from '@/components/watch-party-controls'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const party = await getWatchParty(id)
  if (!party) return { title: 'Watch Party Not Found' }
  return {
    title: `Watch Party: ${party.title} - StreamVibe`,
    description: `Watch ${party.title} together with friends`,
  }
}

export default async function WatchPartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/sign-in')

  const party = await getWatchParty(id)
  if (!party) notFound()

  const posterUrl = getImageUrl(party.posterPath, 'w500')

  return (
    <main className="min-h-screen bg-background pt-16">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Video Area */}
          <div className="lg:col-span-2">
            {/* Video Player Placeholder */}
            <div className="relative aspect-video bg-card rounded-2xl overflow-hidden border border-border mb-4">
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={party.title}
                  fill
                  className="object-cover opacity-50"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-secondary">
                  {party.mediaType === 'movie' ? (
                    <Film className="w-16 h-16 text-muted-foreground" />
                  ) : (
                    <Tv className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
              )}

              {/* Overlay with play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <button className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center mb-4 mx-auto hover:bg-primary transition-colors">
                    <Play className="w-10 h-10 text-primary-foreground fill-current ml-1" />
                  </button>
                  <p className="text-foreground font-medium">Click to start watching</p>
                  <p className="text-sm text-muted-foreground">Everyone will watch in sync</p>
                </div>
              </div>

              {/* Live badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                WATCH PARTY
              </div>
            </div>

            {/* Title and Info */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{party.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="capitalize">{party.mediaType}</span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {party.memberCount} watching
                </span>
                {party.isActive && (
                  <span className="flex items-center gap-1 text-green-500">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Active
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <WatchPartyControls partyId={party.id} isHost={party.hostId === session.user.id} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Party Info Card */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">Party Info</h2>
              
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Party Code</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-foreground font-mono text-sm">
                    {party.id}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(party.id)}
                    className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Share this code with friends to invite them to watch together.</p>
              </div>
            </div>

            {/* Chat Section */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Party Chat</h2>
              </div>

              <div className="h-[400px] flex flex-col">
                {/* Messages area */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                </div>

                {/* Input area */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
