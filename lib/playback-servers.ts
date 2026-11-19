export function movieServers(tmdbId: number, imdbId?: string | null) {
  const imdb = imdbId && /^tt\d{4,12}$/i.test(imdbId) ? imdbId.toLowerCase() : null
  const servers = []
  if (imdb) {
    servers.push({ name: 'OnlyFlix', url: `https://share.cdnm.ink/embed/imdb/${imdb}` })
    servers.push({ name: 'VidAPI', url: `https://vidapi.xyz/embed/movie/${imdb}` })
  }
  if (Number.isSafeInteger(tmdbId) && tmdbId > 0) {
    servers.push({ name: 'MedMedia', url: `https://balance.medmedia03.wiki/embed/movie/${tmdbId}` })
  }
  if (imdb) {
    servers.push({ name: 'Nontongo', url: `https://sv2.nontongo.stream/soap/movie/${imdb}` })
    servers.push({ name: 'VidFast', url: `https://vidfast.vc/movie/${imdb}` })
  }
  return servers
}

export function episodeServers(tmdbId: number, season: number, episode: number) {
  if (![tmdbId, season, episode].every(n => Number.isSafeInteger(n) && n > 0)) return []
  const path = `${tmdbId}/${season}/${episode}`
  return [
    { name: 'VidFast', url: `https://vidfast.vc/tv/${path}` },
    { name: 'VidSrc', url: `https://vidsrc.sh/embed/tv/${path}` },
  ]
}
