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

const API_KEY = process.env.TMDB_API_KEY
const BASE_URL = 'https://api.themoviedb.org/3'

async function tmdbFetch<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('api_key', API_KEY || '')
  url.searchParams.set('language', 'en-US')
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }
  }
  const response = await fetch(url, { next: { revalidate: 3600 } })
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

interface TMDBPagedResult<T> {
  results: T[]
  total_pages: number
  total_results?: number
}

// Trending
export async function getTrending(): Promise<MediaItem[]> {
  const data = await tmdbFetch<TMDBPagedResult<any>>('/trending/all/day')
  return data.results.map((item) => ({
    ...item,
    title: item.title || item.name,
    media_type: item.media_type as 'movie' | 'tv',
  }))
}

// Movies
export async function getPopularMovies(page = 1): Promise<TMDBPagedResult<Movie>> {
  return tmdbFetch('/movie/popular', { page })
}

export async function getTopRatedMovies(page = 1): Promise<TMDBPagedResult<Movie>> {
  return tmdbFetch('/movie/top_rated', { page })
}

export async function getNowPlayingMovies(page = 1): Promise<TMDBPagedResult<Movie>> {
  return tmdbFetch('/movie/now_playing', { page })
}

export async function getUpcomingMovies(page = 1): Promise<TMDBPagedResult<Movie>> {
  return tmdbFetch('/movie/upcoming', { page })
}

export async function getMovieDetails(id: number): Promise<MovieDetails> {
  return tmdbFetch(`/movie/${id}`)
}

export async function getMovieCredits(id: number): Promise<CastMember[]> {
  const data = await tmdbFetch<{ cast: CastMember[] }>(`/movie/${id}/credits`)
  return data.cast.slice(0, 15)
}

export async function getMovieVideos(id: number): Promise<Video[]> {
  const data = await tmdbFetch<{ results: Video[] }>(`/movie/${id}/videos`)
  return data.results
}

export async function getSimilarMovies(id: number): Promise<Movie[]> {
  const data = await tmdbFetch<TMDBPagedResult<Movie>>(`/movie/${id}/similar`)
  return data.results.slice(0, 10)
}

// TV Shows
export async function getPopularTVShows(page = 1): Promise<TMDBPagedResult<TVShow>> {
  return tmdbFetch('/tv/popular', { page })
}

export async function getTopRatedTVShows(page = 1): Promise<TMDBPagedResult<TVShow>> {
  return tmdbFetch('/tv/top_rated', { page })
}

export async function getOnTheAirTVShows(page = 1): Promise<TMDBPagedResult<TVShow>> {
  return tmdbFetch('/tv/on_the_air', { page })
}

export async function getTVShowDetails(id: number): Promise<TVShowDetails> {
  return tmdbFetch(`/tv/${id}`)
}

export async function getTVShowCredits(id: number): Promise<CastMember[]> {
  const data = await tmdbFetch<{ cast: CastMember[] }>(`/tv/${id}/credits`)
  return data.cast.slice(0, 15)
}

export async function getTVShowVideos(id: number): Promise<Video[]> {
  const data = await tmdbFetch<{ results: Video[] }>(`/tv/${id}/videos`)
  return data.results
}

export async function getSimilarTVShows(id: number): Promise<TVShow[]> {
  const data = await tmdbFetch<TMDBPagedResult<TVShow>>(`/tv/${id}/similar`)
  return data.results.slice(0, 10)
}

// Search
export async function searchMulti(query: string, page = 1): Promise<TMDBPagedResult<MediaItem>> {
  const data = await tmdbFetch<TMDBPagedResult<any>>('/search/multi', { query, page })
  return {
    ...data,
    results: data.results
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item) => ({
        ...item,
        title: item.title || item.name,
        media_type: item.media_type as 'movie' | 'tv',
      })),
  }
}

// Genres
export async function getMovieGenres(): Promise<Genre[]> {
  const data = await tmdbFetch<{ genres: Genre[] }>('/genre/movie/list')
  return data.genres
}

export async function getTVGenres(): Promise<Genre[]> {
  const data = await tmdbFetch<{ genres: Genre[] }>('/genre/tv/list')
  return data.genres
}

// Discover
export async function discoverMovies(params: {
  page?: number
  with_genres?: string
  sort_by?: string
  year?: string
}): Promise<TMDBPagedResult<Movie>> {
  const query: Record<string, string | number> = { page: params.page || 1 }
  if (params.with_genres) query.with_genres = params.with_genres
  if (params.sort_by) query.sort_by = params.sort_by
  if (params.year) query.primary_release_year = params.year
  return tmdbFetch('/discover/movie', query)
}

export async function discoverTVShows(params: {
  page?: number
  with_genres?: string
  sort_by?: string
  year?: string
}): Promise<TMDBPagedResult<TVShow>> {
  const query: Record<string, string | number> = { page: params.page || 1 }
  if (params.with_genres) query.with_genres = params.with_genres
  if (params.sort_by) query.sort_by = params.sort_by
  if (params.year) query.first_air_date_year = params.year
  return tmdbFetch('/discover/tv', query)
}

// Helper to get image URL
export function getImageUrl(path: string | null, size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}
