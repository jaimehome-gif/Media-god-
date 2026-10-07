import {
  Tv,
  Film,
  Music,
  Gamepad2,
  Newspaper,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

export type Channel = {
  id: number
  name: string
  logo: string
  currentProgram: string
  time: string
  viewers: string
}

export type ChannelCategory = {
  name: string
  icon: LucideIcon
  channels: Channel[]
}

export const channelCategories: ChannelCategory[] = [
  {
    name: 'Entertainment',
    icon: Tv,
    channels: [
      { id: 1, name: 'HBO Max', logo: '🎬', currentProgram: 'House of the Dragon S2', time: '20:00 - 21:00', viewers: '2.3M' },
      { id: 2, name: 'Netflix Live', logo: '🔴', currentProgram: 'Stranger Things Marathon', time: '19:00 - 22:00', viewers: '4.1M' },
      { id: 3, name: 'Disney+', logo: '🏰', currentProgram: 'The Mandalorian', time: '20:30 - 21:30', viewers: '1.8M' },
      { id: 4, name: 'Paramount+', logo: '⭐', currentProgram: 'Tulsa King', time: '21:00 - 22:00', viewers: '890K' },
      { id: 5, name: 'AMC', logo: '🎭', currentProgram: 'The Walking Dead', time: '20:00 - 21:00', viewers: '560K' },
      { id: 6, name: 'FX', logo: '📺', currentProgram: 'The Bear', time: '21:30 - 22:00', viewers: '720K' },
    ],
  },
  {
    name: 'News',
    icon: Newspaper,
    channels: [
      { id: 7, name: 'CNN', logo: '📰', currentProgram: 'Global News Hour', time: '20:00 - 21:00', viewers: '3.2M' },
      { id: 8, name: 'BBC World', logo: '🌍', currentProgram: 'BBC News at Ten', time: '22:00 - 22:30', viewers: '2.8M' },
      { id: 9, name: 'Fox News', logo: '🦊', currentProgram: 'Prime Time Politics', time: '20:00 - 22:00', viewers: '2.1M' },
      { id: 10, name: 'MSNBC', logo: '📡', currentProgram: 'The Beat with Ari Melber', time: '18:00 - 19:00', viewers: '1.5M' },
      { id: 11, name: 'Al Jazeera', logo: '🌐', currentProgram: 'Middle East Direct', time: '20:00 - 21:00', viewers: '980K' },
      { id: 12, name: 'Sky News', logo: '☁️', currentProgram: 'News Tonight', time: '21:00 - 22:00', viewers: '1.2M' },
    ],
  },
  {
    name: 'Sports',
    icon: Trophy,
    channels: [
      { id: 13, name: 'ESPN', logo: '🏈', currentProgram: 'Monday Night Football', time: '20:00 - 23:30', viewers: '5.6M' },
      { id: 14, name: 'Fox Sports', logo: '⚽', currentProgram: 'UEFA Champions League Live', time: '20:00 - 22:00', viewers: '3.4M' },
      { id: 15, name: 'NBA TV', logo: '🏀', currentProgram: 'NBA Live: Lakers vs Celtics', time: '19:30 - 22:00', viewers: '2.1M' },
      { id: 16, name: 'NFL Network', logo: '🏈', currentProgram: 'NFL Total Access', time: '19:00 - 20:00', viewers: '1.9M' },
      { id: 17, name: 'MLB Network', logo: '⚾', currentProgram: 'Baseball Tonight', time: '21:00 - 22:00', viewers: '1.3M' },
      { id: 18, name: 'Sky Sports', logo: '🎾', currentProgram: 'Live Premier League Review', time: '20:00 - 22:30', viewers: '2.7M' },
    ],
  },
  {
    name: 'Movies',
    icon: Film,
    channels: [
      { id: 19, name: 'TCM', logo: '🎥', currentProgram: 'Classic Cinema: Casablanca', time: '20:00 - 22:15', viewers: '890K' },
      { id: 20, name: 'Showtime', logo: '🎬', currentProgram: 'Interstellar', time: '19:30 - 22:20', viewers: '1.4M' },
      { id: 21, name: 'Starz', logo: '⭐', currentProgram: 'John Wick: Chapter 4', time: '20:00 - 22:30', viewers: '980K' },
      { id: 22, name: 'Cinemax', logo: '🎞️', currentProgram: 'Gladiator', time: '20:00 - 22:35', viewers: '650K' },
      { id: 23, name: 'IFC', logo: '🎭', currentProgram: 'Indie Spotlight Showcase', time: '20:00 - 21:45', viewers: '420K' },
      { id: 24, name: 'Sundance', logo: '🌅', currentProgram: 'Documentary Special', time: '21:00 - 22:30', viewers: '380K' },
    ],
  },
  {
    name: 'Music',
    icon: Music,
    channels: [
      { id: 25, name: 'MTV', logo: '🎵', currentProgram: 'Official Top 40 Countdown', time: '20:00 - 21:00', viewers: '1.8M' },
      { id: 26, name: 'VH1', logo: '🎸', currentProgram: 'Classic Rock Anthems', time: '20:00 - 22:00', viewers: '920K' },
      { id: 27, name: 'CMT', logo: '🤠', currentProgram: 'Country Music Hits', time: '20:00 - 21:30', viewers: '560K' },
      { id: 28, name: 'BET', logo: '🎤', currentProgram: 'Rap City Reloaded', time: '21:00 - 22:00', viewers: '1.1M' },
      { id: 29, name: 'Fuse', logo: '🎧', currentProgram: 'Underground Beats', time: '20:00 - 21:00', viewers: '340K' },
      { id: 30, name: 'MTV Live', logo: '📻', currentProgram: 'Live Festival Stage', time: '20:00 - 23:00', viewers: '780K' },
    ],
  },
  {
    name: 'Gaming',
    icon: Gamepad2,
    channels: [
      { id: 31, name: 'Twitch TV', logo: '🎮', currentProgram: 'Top Streamer Showcase', time: '20:00 - 00:00', viewers: '8.2M' },
      { id: 32, name: 'YouTube Gaming', logo: '▶️', currentProgram: 'Let’s Play Championship', time: '19:00 - 22:00', viewers: '6.5M' },
      { id: 33, name: 'G4', logo: '🕹️', currentProgram: 'Retro Arcade Battles', time: '20:00 - 21:00', viewers: '1.2M' },
      { id: 34, name: 'ESL', logo: '🏆', currentProgram: 'CS2 Major Grand Finals', time: '18:00 - 22:30', viewers: '2.3M' },
      { id: 35, name: 'FACEIT', logo: '⚔️', currentProgram: 'Pro League Qualifier', time: '20:00 - 23:00', viewers: '890K' },
      { id: 36, name: 'GG', logo: '🎯', currentProgram: 'Speedrun Marathon', time: '20:00 - 22:00', viewers: '450K' },
    ],
  },
]

export const allChannels: Channel[] = channelCategories.flatMap((c) => c.channels)

export function getChannelById(id: number): Channel | undefined {
  return allChannels.find((c) => c.id === id)
}

export function getCategoryForChannel(id: number): ChannelCategory | undefined {
  return channelCategories.find((c) => c.channels.some((ch) => ch.id === id))
}

export type EpgEntry = {
  time: string
  title: string
  live: boolean
}

// Deterministic mock EPG schedule built from the channel's "now" program.
export function getChannelSchedule(id: number): EpgEntry[] {
  const channel = getChannelById(id)
  if (!channel) return []

  const [start] = channel.time.split(' - ')
  const startHour = parseInt(start, 10)
  const baseHour = isNaN(startHour) ? 20 : startHour

  const upcoming = [
    `${channel.currentProgram}`,
    'Primetime Highlights',
    'Late Night Special',
    'After Dark Marathon',
    'Early Morning Block',
  ]

  return upcoming.map((title, i) => {
    const hour = (baseHour + i) % 24
    const next = (hour + 1) % 24
    return {
      time: `${String(hour).padStart(2, '0')}:00 - ${String(next).padStart(2, '0')}:00`,
      title,
      live: i === 0,
    }
  })
}

// A single public HLS test stream used as the live source for every channel.
export const LIVE_STREAM_URL =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8'
