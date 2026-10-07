import { Tv, Radio, Globe } from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { channelCategories } from '@/lib/live-tv-channels'

export const metadata = {
  title: 'Live TV - StreamVibe',
  description: 'Watch live TV channels from around the world with real-time program guides',
}

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
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Live TV & EPG Schedule</h1>
              <p className="text-muted-foreground">Watch live channels and live program schedules from around the world</p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-muted-foreground">150+ channels streaming live with active EPG guides</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {category.channels.map((channel) => (
                  <Link
                    key={channel.id}
                    href={`/live-tv/${channel.id}`}
                    className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-primary/55 transition-all hover:shadow-lg hover:shadow-primary/10 flex flex-col"
                  >
                    <div className="aspect-video bg-gradient-to-br from-secondary to-muted flex items-center justify-center relative">
                      <span className="text-4xl">{channel.logo}</span>
                      
                      {/* Live badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        LIVE
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                          {channel.name}
                        </h3>
                        <p className="text-xs font-medium text-emerald-400 mt-1 truncate">
                          {channel.currentProgram}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{channel.time}</p>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {channel.viewers}
                        </span>
                      </div>
                    </div>

                    {/* Hover play overlay */}
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
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
              <h3 className="text-lg font-semibold text-foreground mb-1">International Channels & EPG Scheduling</h3>
              <p className="text-sm text-muted-foreground">
                Access 500+ international channels from over 100 countries equipped with live electronic program guide timelines for seamless viewing.
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
