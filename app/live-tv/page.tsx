import { Navbar } from '@/components/navbar'
import { Tv, Radio, Globe, Film, Music, Gamepad2, Newspaper, Trophy } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Live TV - StreamVibe',
  description: 'Watch live TV channels from around the world',
}

const channelCategories = [
  {
    name: 'Entertainment',
    icon: Tv,
    channels: [
      { id: 1, name: 'HBO Max', logo: '🎬', viewers: '2.3M' },
      { id: 2, name: 'Netflix Live', logo: '🔴', viewers: '4.1M' },
      { id: 3, name: 'Disney+', logo: '🏰', viewers: '1.8M' },
      { id: 4, name: 'Paramount+', logo: '⭐', viewers: '890K' },
      { id: 5, name: 'AMC', logo: '🎭', viewers: '560K' },
      { id: 6, name: 'FX', logo: '📺', viewers: '720K' },
    ],
  },
  {
    name: 'News',
    icon: Newspaper,
    channels: [
      { id: 7, name: 'CNN', logo: '📰', viewers: '3.2M' },
      { id: 8, name: 'BBC World', logo: '🌍', viewers: '2.8M' },
      { id: 9, name: 'Fox News', logo: '🦊', viewers: '2.1M' },
      { id: 10, name: 'MSNBC', logo: '📡', viewers: '1.5M' },
      { id: 11, name: 'Al Jazeera', logo: '🌐', viewers: '980K' },
      { id: 12, name: 'Sky News', logo: '☁️', viewers: '1.2M' },
    ],
  },
  {
    name: 'Sports',
    icon: Trophy,
    channels: [
      { id: 13, name: 'ESPN', logo: '🏈', viewers: '5.6M' },
      { id: 14, name: 'Fox Sports', logo: '⚽', viewers: '3.4M' },
      { id: 15, name: 'NBA TV', logo: '🏀', viewers: '2.1M' },
      { id: 16, name: 'NFL Network', logo: '🏈', viewers: '1.9M' },
      { id: 17, name: 'MLB Network', logo: '⚾', viewers: '1.3M' },
      { id: 18, name: 'Sky Sports', logo: '🎾', viewers: '2.7M' },
    ],
  },
  {
    name: 'Movies',
    icon: Film,
    channels: [
      { id: 19, name: 'TCM', logo: '🎥', viewers: '890K' },
      { id: 20, name: 'Showtime', logo: '🎬', viewers: '1.4M' },
      { id: 21, name: 'Starz', logo: '⭐', viewers: '980K' },
      { id: 22, name: 'Cinemax', logo: '🎞️', viewers: '650K' },
      { id: 23, name: 'IFC', logo: '🎭', viewers: '420K' },
      { id: 24, name: 'Sundance', logo: '🌅', viewers: '380K' },
    ],
  },
  {
    name: 'Music',
    icon: Music,
    channels: [
      { id: 25, name: 'MTV', logo: '🎵', viewers: '1.8M' },
      { id: 26, name: 'VH1', logo: '🎸', viewers: '920K' },
      { id: 27, name: 'CMT', logo: '🤠', viewers: '560K' },
      { id: 28, name: 'BET', logo: '🎤', viewers: '1.1M' },
      { id: 29, name: 'Fuse', logo: '🎧', viewers: '340K' },
      { id: 30, name: 'MTV Live', logo: '📻', viewers: '780K' },
    ],
  },
  {
    name: 'Gaming',
    icon: Gamepad2,
    channels: [
      { id: 31, name: 'Twitch TV', logo: '🎮', viewers: '8.2M' },
      { id: 32, name: 'YouTube Gaming', logo: '▶️', viewers: '6.5M' },
      { id: 33, name: 'G4', logo: '🕹️', viewers: '1.2M' },
      { id: 34, name: 'ESL', logo: '🏆', viewers: '2.3M' },
      { id: 35, name: 'FACEIT', logo: '⚔️', viewers: '890K' },
      { id: 36, name: 'GG', logo: '🎯', viewers: '450K' },
    ],
  },
]

export default function LiveTVPage() {
  return (
    <main className="min-h-screen bg-background pt-16">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Radio className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Live TV</h1>
              <p className="text-muted-foreground">Watch live channels from around the world</p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-muted-foreground">150+ channels streaming live</span>
          </div>
        </div>

        {/* Channel Categories */}
        <div className="flex flex-col gap-12">
          {channelCategories.map((category) => (
            <section key={category.name}>
              <div className="flex items-center gap-3 mb-6">
                <category.icon className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">{category.name}</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {category.channels.map((channel) => (
                  <Link
                    key={channel.id}
                    href={`/live-tv/${channel.id}`}
                    className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10"
                  >
                    <div className="aspect-video bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                      <span className="text-4xl">{channel.logo}</span>
                      
                      {/* Live badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        LIVE
                      </div>
                    </div>

                    <div className="p-3">
                      <h3 className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">
                        {channel.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Globe className="w-3 h-3" />
                        {channel.viewers} watching
                      </div>
                    </div>

                    {/* Hover play overlay */}
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                        <Tv className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Info banner */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">International Channels</h3>
              <p className="text-sm text-muted-foreground">
                Access 500+ international channels from over 100 countries. Stream news, sports, entertainment, and more in multiple languages.
              </p>
            </div>
            <Link
              href="/live-tv/international"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Browse All
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
