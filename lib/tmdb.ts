const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export interface Movie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  media_type?: string
}

export interface TVShow {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  media_type?: string
}

export interface MediaItem {
  id: number
  title: string
  name?: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  media_type: 'movie' | 'tv'
}

export interface Genre {
  id: number
  name: string
}

export interface MovieDetails extends Movie {
  genres: Genre[]
  runtime: number
  tagline: string
  status: string
  budget: number
  revenue: number
  production_companies: { id: number; name: string; logo_path: string | null }[]
}

export interface TVShowDetails extends TVShow {
  genres: Genre[]
  episode_run_time: number[]
  tagline: string
  status: string
  number_of_seasons: number
  number_of_episodes: number
  seasons: {
    id: number
    name: string
    season_number: number
    episode_count: number
    poster_path: string | null
  }[]
}

export interface CastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
}

export interface Video {
  id: string
  key: string
  name: string
  site: string
  type: string
}

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const searchParams = new URLSearchParams({
    api_key: TMDB_API_KEY || '',
    ...params,
  })

  const response = await fetch(`${TMDB_BASE_URL}${endpoint}?${searchParams}`, {
    next: { revalidate: 3600 },
  })

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`)
  }

  return response.json()
}

// Trending
export async function getTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week') {
  const data = await fetchTMDB<{ results: MediaItem[] }>(`/trending/${mediaType}/${timeWindow}`)
  return data.results
}

// Movies
export async function getPopularMovies(page = 1) {
  const data = await fetchTMDB<{ results: Movie[]; total_pages: number }>('/movie/popular', { page: String(page) })
  return data
}

export async function getTopRatedMovies(page = 1) {
  const data = await fetchTMDB<{ results: Movie[]; total_pages: number }>('/movie/top_rated', { page: String(page) })
  return data
}

export async function getNowPlayingMovies(page = 1) {
  const data = await fetchTMDB<{ results: Movie[]; total_pages: number }>('/movie/now_playing', { page: String(page) })
  return data
}

export async function getUpcomingMovies(page = 1) {
  const data = await fetchTMDB<{ results: Movie[]; total_pages: number }>('/movie/upcoming', { page: String(page) })
  return data
}

export async function getMovieDetails(id: number) {
  return fetchTMDB<MovieDetails>(`/movie/${id}`)
}

export async function getMovieCredits(id: number) {
  const data = await fetchTMDB<{ cast: CastMember[] }>(`/movie/${id}/credits`)
  return data.cast.slice(0, 10)
}

export async function getMovieVideos(id: number) {
  const data = await fetchTMDB<{ results: Video[] }>(`/movie/${id}/videos`)
  return data.results.filter(v => v.site === 'YouTube')
}

export async function getSimilarMovies(id: number) {
  const data = await fetchTMDB<{ results: Movie[] }>(`/movie/${id}/similar`)
  return data.results.slice(0, 12)
}

// TV Shows
export async function getPopularTVShows(page = 1) {
  const data = await fetchTMDB<{ results: TVShow[]; total_pages: number }>('/tv/popular', { page: String(page) })
  return data
}

export async function getTopRatedTVShows(page = 1) {
  const data = await fetchTMDB<{ results: TVShow[]; total_pages: number }>('/tv/top_rated', { page: String(page) })
  return data
}

export async function getOnTheAirTVShows(page = 1) {
  const data = await fetchTMDB<{ results: TVShow[]; total_pages: number }>('/tv/on_the_air', { page: String(page) })
  return data
}

export async function getTVShowDetails(id: number) {
  return fetchTMDB<TVShowDetails>(`/tv/${id}`)
}

export async function getTVShowCredits(id: number) {
  const data = await fetchTMDB<{ cast: CastMember[] }>(`/tv/${id}/credits`)
  return data.cast.slice(0, 10)
}

export async function getTVShowVideos(id: number) {
  const data = await fetchTMDB<{ results: Video[] }>(`/tv/${id}/videos`)
  return data.results.filter(v => v.site === 'YouTube')
}

export async function getSimilarTVShows(id: number) {
  const data = await fetchTMDB<{ results: TVShow[] }>(`/tv/${id}/similar`)
  return data.results.slice(0, 12)
}

// Search
export async function searchMulti(query: string, page = 1) {
  const data = await fetchTMDB<{ results: MediaItem[]; total_pages: number; total_results: number }>('/search/multi', {
    query,
    page: String(page),
  })
  return data
}

// Genres
export async function getMovieGenres() {
  const data = await fetchTMDB<{ genres: Genre[] }>('/genre/movie/list')
  return data.genres
}

export async function getTVGenres() {
  const data = await fetchTMDB<{ genres: Genre[] }>('/genre/tv/list')
  return data.genres
}

// Discover
export async function discoverMovies(params: {
  page?: number
  with_genres?: string
  sort_by?: string
  year?: string
}) {
  const data = await fetchTMDB<{ results: Movie[]; total_pages: number }>('/discover/movie', {
    page: String(params.page || 1),
    ...(params.with_genres && { with_genres: params.with_genres }),
    ...(params.sort_by && { sort_by: params.sort_by }),
    ...(params.year && { primary_release_year: params.year }),
  })
  return data
}

export async function discoverTVShows(params: {
  page?: number
  with_genres?: string
  sort_by?: string
  year?: string
}) {
  const data = await fetchTMDB<{ results: TVShow[]; total_pages: number }>('/discover/tv', {
    page: String(params.page || 1),
    ...(params.with_genres && { with_genres: params.with_genres }),
    ...(params.sort_by && { sort_by: params.sort_by }),
    ...(params.year && { first_air_date_year: params.year }),
  })
  return data
}

// Helper to get image URL
export function getImageUrl(path: string | null, size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}
