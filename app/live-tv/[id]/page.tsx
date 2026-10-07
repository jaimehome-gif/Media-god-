import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Tv, Globe, ChevronLeft, Radio } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { LiveTvPlayer } from '@/components/live-tv-player'
import {
  channelCategories,
  allChannels,
  getChannelById,
  getCategoryForChannel,
  getChannelSchedule,
} from '@/lib/live-tv-channels'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === 'international') {
    return { title: 'International Channels - StreamVibe' }
  }
  const channel = getChannelById(parseInt(id, 10))
  if (!channel) return { title: 'Channel Not Found' }
  return {
    title: `${channel.name} - Live TV - StreamVibe`,
    description: `Watch ${channel.name} live. Now playing: ${channel.currentProgram}`,
  }
}

export default async function LiveTVChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // "Browse All" view: every channel in one grid.
  if (id === 'international') {
    return (
      <main className="min-h-screen bg-background pt-16">
        <Navbar />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/live-tv"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Live TV
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">All International Channels</h1>
              <p className="text-muted-foreground">{allChannels.length} channels streaming live</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {allChannels.map((channel) => (
              <Link
                key={channel.id}
                href={`/live-tv/${channel.id}`}
                className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-primary/55 transition-all hover:shadow-lg hover:shadow-primary/10 flex flex-col"
              >
                <div className="aspect-video bg-gradient-to-br from-secondary to-muted flex items-center justify-center relative">
                  <span className="text-4xl">{channel.logo}</span>
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                    {channel.name}
                  </h3>
                  <p className="text-xs font-medium text-emerald-400 mt-1 truncate">
                    {channel.currentProgram}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    )
  }

  const channelId = parseInt(id, 10)
  if (isNaN(channelId)) notFound()

  const channel = getChannelById(channelId)
  if (!channel) notFound()

  const category = getCategoryForChannel(channelId)
  const schedule = getChannelSchedule(channelId)
  const related = (category?.channels ?? allChannels).filter((c) => c.id !== channelId).slice(0, 6)

  return (
    <main className="min-h-screen bg-background pt-16">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/live-tv"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Live TV
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player + info */}
          <div className="lg:col-span-2">
            <LiveTvPlayer
              src={channel.url}
              channelName={channel.name}
              channelLogo={channel.logo}
            />

            <div className="mt-4 flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center text-3xl flex-shrink-0">
                {channel.logo}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{channel.name}</h1>
                  {category && (
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                      {category.name}
                    </span>
                  )}
                </div>
                <p className="text-emerald-400 font-medium mt-1">{channel.currentProgram}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5" />
                    On air
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    {channel.viewers} watching
                  </span>
                  <span>{channel.time}</span>
                </div>
              </div>
            </div>
          </div>

          {/* EPG schedule */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Tv className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Program Guide</h2>
            </div>
            <div className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden">
              {schedule.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 ${entry.live ? 'bg-primary/5' : ''}`}
                >
                  <span className="text-xs text-muted-foreground font-mono pt-0.5 w-24 flex-shrink-0">
                    {entry.time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${entry.live ? 'text-primary' : 'text-foreground'}`}>
                      {entry.title}
                    </p>
                    {entry.live && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-red-500 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        NOW
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related channels */}
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-foreground mb-4">
              {category ? `More in ${category.name}` : 'More Channels'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {related.map((c) => (
                <Link
                  key={c.id}
                  href={`/live-tv/${c.id}`}
                  className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary/55 transition-all flex flex-col"
                >
                  <div className="aspect-video bg-gradient-to-br from-secondary to-muted flex items-center justify-center relative">
                    <span className="text-3xl">{c.logo}</span>
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-medium">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="font-semibold text-foreground text-xs truncate group-hover:text-primary transition-colors">
                      {c.name}
                    </h3>
                    <p className="text-[11px] text-emerald-400 truncate">{c.currentProgram}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
