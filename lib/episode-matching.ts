/**
 * Episode matching shared by discovery and the Real-Debrid file selector.
 * Never silently substitute a different episode from a season pack.
 */
export function compactTitle(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '')
}

export function isVideoFile(path: string): boolean {
  return /\.(?:mp4|m4v|mkv|webm|avi|mov|wmv|ts|m2ts|mpg|mpeg)$/i.test(path)
}

export function isSampleOrTrailer(path: string): boolean {
  return /(?:^|[\\/._ -])(?:sample|trailer|preview)(?:[\\/._ -]|$)/i.test(path)
}

function episodeNumbers(value: string): { season: number; episodes: number[] }[] {
  const result: { season: number; episodes: number[] }[] = []
  const sxe = /s(\d{1,2})[. _-]*e(\d{1,3})(?:(?:[. _-]*-?[. _-]*e?)(\d{1,3}))?/gi
  for (const hit of value.matchAll(sxe)) {
    const first = Number(hit[2])
    const second = hit[3] ? Number(hit[3]) : first
    const episodes = second >= first && second <= first + 10
      ? Array.from({ length: second - first + 1 }, (_, index) => first + index)
      : [first]
    result.push({ season: Number(hit[1]), episodes })
  }
  for (const hit of value.matchAll(/(?:^|[^\d])(\d{1,2})x(\d{1,3})(?!\d)/gi)) {
    result.push({ season: Number(hit[1]), episodes: [Number(hit[2])] })
  }
  return result
}

export function matchesExactEpisode(name: string, season: number, episode: number): boolean {
  return episodeNumbers(name).some(item => item.season === season && item.episodes.includes(episode))
}

export function isSeasonPack(name: string, season: number): boolean {
  const clean = name.replace(/\b(?:2160p|1080p|720p|480p|4k)\b/gi, '')
  const seasonMarker = new RegExp(`(?:^|[^a-z0-9])(?:s0*${season}|season[ ._-]*0*${season})(?![0-9a-z])`, 'i')
  return seasonMarker.test(clean) && episodeNumbers(name).length === 0
}

export function matchesSeriesTitle(filename: string, title: string): boolean {
  const seriesPart = filename.split(/(?:[. _-]+s\d{1,2}(?:e\d+)?|[. _-]+season[. _-]*\d+|[. _-]+\d{1,2}x\d+)/i)[0]
  return compactTitle(seriesPart).includes(compactTitle(title))
}

/** Filename may name a whole season, but individual video files must match the exact episode. */
export function matchesEpisodeFile(path: string, season: number, episode: number, torrentName = ''): boolean {
  if (!isVideoFile(path) || isSampleOrTrailer(path)) return false
  const leaf = path.split(/[\\/]/).pop() || path
  if (matchesExactEpisode(leaf, season, episode)) return true
  if (episodeNumbers(leaf).length > 0) return false
  // Some season packs call their files "Episode 1.mkv" rather than S01E01.
  if (isSeasonPack(torrentName, season)) {
    const generic = leaf.match(/(?:^|[ ._-])(?:episode|ep)[ ._-]*0*(\d{1,3})(?!\d)/i)
    if (generic && Number(generic[1]) === episode) return true
  }
  // A single-episode torrent's only video may have a generic name.
  return false
}

export function matchesEpisodeResult(filename: string, title: string, season: number, episode: number): boolean {
  return matchesSeriesTitle(filename, title) &&
    (matchesExactEpisode(filename, season, episode) || isSeasonPack(filename, season))
}
