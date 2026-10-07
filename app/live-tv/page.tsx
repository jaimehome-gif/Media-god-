import { Tv, Radio, Globe, Film, Music, Gamepad2, Newspaper, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'

export const metadata = {
  title: 'Live TV - StreamVibe',
  description: 'Watch free live TV channels with real-time streams',
}

const channelCategories = [
  {
    name: 'UK General',
    icon: Tv,
    channels: [
      { id: 'itv2', name: 'ITV 2', logo: 'ITV', stream: 'http://45.14.84.37/itv2/index.m3u8' },
      { id: 'itv3', name: 'ITV 3', logo: 'ITV', stream: 'http://45.14.84.37/itv3/index.m3u8' },
      { id: 'itv4', name: 'ITV 4', logo: 'ITV', stream: 'http://45.14.84.37/itv4/index.m3u8' },
      { id: 'channel5', name: 'Channel 5', logo: '5', stream: 'http://193.46.58.239:8080/Channel5/index.m3u8' },
      { id: 'qvcuk', name: 'QVC UK', logo: 'QVC', stream: 'https://qvcuk-live.akamaized.net/hls/live/2097112/qvc/3/3.m3u8' },
      { id: 'tjc', name: 'TJC', logo: 'TJC', stream: 'https://cdn-shop-lc-01.akamaized.net/Content/HLS_HLS/Live/channel(TJCOTT)/index.m3u8' },
      { id: 'greatmovies', name: 'Great! Movies', logo: 'G!', stream: 'https://amg01753-narrativeuk-amg01753c3-lg-gb-1833.playouts.now.amagi.tv/playlist/amg01753-narrativeuk-greatmovies-lggb/playlist.m3u8' },
    ],
  },
  {
    name: 'BBC',
    icon: Newspaper,
    channels: [
      { id: 'bbc-alba', name: 'BBC Alba', logo: 'BBC', stream: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_alba/iptv_hd_abr_v1.m3u8' },
      { id: 'bbc-four', name: 'BBC Four', logo: 'BBC', stream: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_four_hd/iptv_hd_abr_v1.m3u8' },
      { id: 'bbc-scotland', name: 'BBC Scotland', logo: 'BBC', stream: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_scotland_hd/pc_hd_abr_v2.m3u8' },
      { id: 'bbc-three', name: 'BBC Three', logo: 'BBC', stream: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_three_hd/iptv_hd_abr_v1.m3u8' },
    ],
  },
]

export default function LiveTVPage() {
  return (
    <main className="min-h-screen bg-background pt-16">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Radio className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Live TV</h1>
              <p className="text-muted-foreground">Free-to-watch live channels and streams</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-muted-foreground">
              Select a channel to open the live player. Some BBC streams may be UK/region restricted.
            </span>
          </div>
        </div>

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
                    className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-primary/55 focus-visible:border-primary transition-all hover:shadow-lg hover:shadow-primary/10 flex flex-col tv-focus-target focus:outline-none"
                  >
                    <div className="aspect-video bg-gradient-to-br from-secondary to-muted flex items-center justify-center relative">
                      <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
                        {channel.logo}
                      </span>

                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>

                      <div className="absolute inset-0 bg-background/75 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <Tv className="w-6 h-6 text-primary-foreground" />
                        </div>
                      </div>
                    </div>

                    <div className="p-3">
                      <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                        {channel.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">Live stream</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Live stream status</h3>
              <p className="text-sm text-muted-foreground">
                Streams come from publicly available/free-to-watch feeds. Individual channels can go offline,
                change URLs, or be region restricted without notice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
