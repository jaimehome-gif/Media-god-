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

// Mock Data - No API Key Required
const mockMovies: Movie[] = [
  {
    id: 1,
    title: "The Dark Knight",
    overview: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2008-07-18",
    vote_average: 9.0,
    vote_count: 30000,
    genre_ids: [28, 80, 18],
  },
  {
    id: 2,
    title: "Inception",
    overview: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2010-07-16",
    vote_average: 8.8,
    vote_count: 35000,
    genre_ids: [28, 878, 12],
  },
  {
    id: 3,
    title: "Interstellar",
    overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2014-11-07",
    vote_average: 8.6,
    vote_count: 32000,
    genre_ids: [12, 18, 878],
  },
  {
    id: 4,
    title: "The Matrix",
    overview: "A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.",
    poster_path: null,
    backdrop_path: null,
    release_date: "1999-03-31",
    vote_average: 8.7,
    vote_count: 25000,
    genre_ids: [28, 878],
  },
  {
    id: 5,
    title: "Pulp Fiction",
    overview: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    poster_path: null,
    backdrop_path: null,
    release_date: "1994-10-14",
    vote_average: 8.9,
    vote_count: 28000,
    genre_ids: [80, 53],
  },
  {
    id: 6,
    title: "Fight Club",
    overview: "An insomniac office worker and a devil-may-care soapmaker form an underground fight club that evolves into something much more.",
    poster_path: null,
    backdrop_path: null,
    release_date: "1999-10-15",
    vote_average: 8.8,
    vote_count: 29000,
    genre_ids: [18],
  },
  {
    id: 7,
    title: "Forrest Gump",
    overview: "The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man.",
    poster_path: null,
    backdrop_path: null,
    release_date: "1994-07-06",
    vote_average: 8.8,
    vote_count: 26000,
    genre_ids: [35, 18, 10749],
  },
  {
    id: 8,
    title: "The Shawshank Redemption",
    overview: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    poster_path: null,
    backdrop_path: null,
    release_date: "1994-09-23",
    vote_average: 9.3,
    vote_count: 27000,
    genre_ids: [18, 80],
  },
  {
    id: 9,
    title: "Goodfellas",
    overview: "The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners.",
    poster_path: null,
    backdrop_path: null,
    release_date: "1990-09-19",
    vote_average: 8.7,
    vote_count: 15000,
    genre_ids: [18, 80],
  },
  {
    id: 10,
    title: "The Godfather",
    overview: "The aging patriarch of an organized crime dynasty in postwar New York City transfers control of his clandestine empire to his reluctant youngest son.",
    poster_path: null,
    backdrop_path: null,
    release_date: "1972-03-24",
    vote_average: 9.2,
    vote_count: 20000,
    genre_ids: [18, 80],
  },
  {
    id: 11,
    title: "Gladiator",
    overview: "A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2000-05-05",
    vote_average: 8.5,
    vote_count: 18000,
    genre_ids: [28, 18, 12],
  },
  {
    id: 12,
    title: "Avatar",
    overview: "A paraplegic Marine dispatched to the moon Pandora on a unique mission becomes torn between following his orders and protecting the world he feels is his home.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2009-12-18",
    vote_average: 7.9,
    vote_count: 30000,
    genre_ids: [28, 12, 14, 878],
  },
]

const mockTVShows: TVShow[] = [
  {
    id: 101,
    name: "Breaking Bad",
    overview: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine to secure his family's future.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2008-01-20",
    vote_average: 9.5,
    vote_count: 25000,
    genre_ids: [18, 80],
  },
  {
    id: 102,
    name: "Game of Thrones",
    overview: "Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2011-04-17",
    vote_average: 9.3,
    vote_count: 23000,
    genre_ids: [10765, 18, 10759],
  },
  {
    id: 103,
    name: "Stranger Things",
    overview: "When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces in order to get him back.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2016-07-15",
    vote_average: 8.7,
    vote_count: 20000,
    genre_ids: [18, 10765, 9648],
  },
  {
    id: 104,
    name: "The Wire",
    overview: "The Baltimore drug scene, as seen through the eyes of drug dealers and law enforcement.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2002-06-02",
    vote_average: 9.4,
    vote_count: 8000,
    genre_ids: [80, 18],
  },
  {
    id: 105,
    name: "The Sopranos",
    overview: "New Jersey mob boss Tony Soprano deals with personal and professional issues in his home and business life.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "1999-01-10",
    vote_average: 9.2,
    vote_count: 9000,
    genre_ids: [18, 80],
  },
  {
    id: 106,
    name: "The Office",
    overview: "A mockumentary on a group of typical office workers, where the workday consists of ego clashes, inappropriate behavior, and tedium.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2005-03-24",
    vote_average: 9.0,
    vote_count: 15000,
    genre_ids: [35],
  },
  {
    id: 107,
    name: "Friends",
    overview: "Follows the personal and professional lives of six twenty to thirty-something-year-old friends living in Manhattan.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "1994-09-22",
    vote_average: 8.9,
    vote_count: 18000,
    genre_ids: [35, 18],
  },
  {
    id: 108,
    name: "The Mandalorian",
    overview: "After the fall of the Galactic Empire, a lone gunfighter makes his way through the outer reaches of the lawless galaxy.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2019-11-12",
    vote_average: 8.7,
    vote_count: 12000,
    genre_ids: [10765, 10759, 18],
  },
  {
    id: 109,
    name: "House of the Dragon",
    overview: "The story of the Targaryen civil war that took place about 200 years before the events portrayed in Game of Thrones.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2022-08-21",
    vote_average: 8.5,
    vote_count: 10000,
    genre_ids: [10765, 18, 10759],
  },
  {
    id: 110,
    name: "The Last of Us",
    overview: "Joel and Ellie, a pair connected through the harshness of the world they live in, are forced to endure brutal circumstances and ruthless killers.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2023-01-15",
    vote_average: 8.8,
    vote_count: 9000,
    genre_ids: [18, 10759, 10765],
  },
  {
    id: 111,
    name: "Wednesday",
    overview: "Wednesday Addams is sent to Nevermore Academy, a bizarre boarding school where she attempts to master her psychic powers.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2022-11-23",
    vote_average: 8.4,
    vote_count: 8000,
    genre_ids: [35, 9648, 10765],
  },
  {
    id: 112,
    name: "Squid Game",
    overview: "Hundreds of cash-strapped players accept a strange invitation to compete in children's games. Inside, a tempting prize awaits with deadly high stakes.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2021-09-17",
    vote_average: 8.1,
    vote_count: 15000,
    genre_ids: [10759, 9648, 18],
  },
]

const genres: Genre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
  { id: 10759, name: 'Action & Adventure' },
  { id: 10762, name: 'Kids' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
]

const mockCast: CastMember[] = [
  { id: 1, name: "Robert Downey Jr.", character: "Lead Actor", profile_path: null },
  { id: 2, name: "Scarlett Johansson", character: "Supporting Actor", profile_path: null },
  { id: 3, name: "Chris Evans", character: "Lead Actor", profile_path: null },
  { id: 4, name: "Tom Holland", character: "Supporting Actor", profile_path: null },
  { id: 5, name: "Zendaya", character: "Lead Actress", profile_path: null },
  { id: 6, name: "Morgan Freeman", character: "Narrator", profile_path: null },
  { id: 7, name: "Leonardo DiCaprio", character: "Lead Actor", profile_path: null },
  { id: 8, name: "Brad Pitt", character: "Supporting Actor", profile_path: null },
  { id: 9, name: "Margot Robbie", character: "Lead Actress", profile_path: null },
  { id: 10, name: "Timothee Chalamet", character: "Lead Actor", profile_path: null },
]

// Helper to shuffle array
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Trending
export async function getTrending(): Promise<MediaItem[]> {
  const movies: MediaItem[] = mockMovies.slice(0, 6).map(m => ({ ...m, media_type: 'movie' as const }))
  const tv: MediaItem[] = mockTVShows.slice(0, 6).map(t => ({ ...t, title: t.name, media_type: 'tv' as const }))
  return shuffle([...movies, ...tv])
}

// Movies
export async function getPopularMovies(page = 1) {
  return { results: shuffle(mockMovies), total_pages: 1 }
}

export async function getTopRatedMovies(page = 1) {
  const sorted = [...mockMovies].sort((a, b) => b.vote_average - a.vote_average)
  return { results: sorted, total_pages: 1 }
}

export async function getNowPlayingMovies(page = 1) {
  return { results: shuffle(mockMovies.slice(0, 8)), total_pages: 1 }
}

export async function getUpcomingMovies(page = 1) {
  return { results: shuffle(mockMovies.slice(4)), total_pages: 1 }
}

export async function getMovieDetails(id: number): Promise<MovieDetails> {
  const movie = mockMovies.find(m => m.id === id) || mockMovies[0]
  return {
    ...movie,
    genres: genres.filter(g => movie.genre_ids.includes(g.id)),
    runtime: 120 + Math.floor(Math.random() * 60),
    tagline: "An unforgettable cinematic experience",
    status: "Released",
    budget: 150000000,
    revenue: 500000000,
    production_companies: [
      { id: 1, name: "StreamVibe Studios", logo_path: null },
    ],
  }
}

export async function getMovieCredits(id: number) {
  return shuffle(mockCast).slice(0, 8)
}

export async function getMovieVideos(id: number) {
  return [] as Video[]
}

export async function getSimilarMovies(id: number) {
  return shuffle(mockMovies.filter(m => m.id !== id)).slice(0, 6)
}

// TV Shows
export async function getPopularTVShows(page = 1) {
  return { results: shuffle(mockTVShows), total_pages: 1 }
}

export async function getTopRatedTVShows(page = 1) {
  const sorted = [...mockTVShows].sort((a, b) => b.vote_average - a.vote_average)
  return { results: sorted, total_pages: 1 }
}

export async function getOnTheAirTVShows(page = 1) {
  return { results: shuffle(mockTVShows.slice(0, 8)), total_pages: 1 }
}

export async function getTVShowDetails(id: number): Promise<TVShowDetails> {
  const show = mockTVShows.find(t => t.id === id) || mockTVShows[0]
  return {
    ...show,
    genres: genres.filter(g => show.genre_ids.includes(g.id)),
    episode_run_time: [45, 60],
    tagline: "A must-watch television experience",
    status: "Returning Series",
    number_of_seasons: 3 + Math.floor(Math.random() * 5),
    number_of_episodes: 20 + Math.floor(Math.random() * 50),
    seasons: [
      { id: 1, name: "Season 1", season_number: 1, episode_count: 10, poster_path: null },
      { id: 2, name: "Season 2", season_number: 2, episode_count: 10, poster_path: null },
      { id: 3, name: "Season 3", season_number: 3, episode_count: 10, poster_path: null },
    ],
  }
}

export async function getTVShowCredits(id: number) {
  return shuffle(mockCast).slice(0, 8)
}

export async function getTVShowVideos(id: number) {
  return [] as Video[]
}

export async function getSimilarTVShows(id: number) {
  return shuffle(mockTVShows.filter(t => t.id !== id)).slice(0, 6)
}

// Search
export async function searchMulti(query: string, page = 1) {
  const q = query.toLowerCase()
  const movieResults = mockMovies.filter(m => m.title.toLowerCase().includes(q))
  const tvResults = mockTVShows.filter(t => t.name.toLowerCase().includes(q))
  
  const results: MediaItem[] = [
    ...movieResults.map(m => ({ ...m, media_type: 'movie' as const })),
    ...tvResults.map(t => ({ ...t, title: t.name, media_type: 'tv' as const })),
  ]
  
  return { results, total_pages: 1, total_results: results.length }
}

// Genres
export async function getMovieGenres() {
  return genres.slice(0, 19)
}

export async function getTVGenres() {
  return genres.slice(18)
}

// Discover
export async function discoverMovies(params: {
  page?: number
  with_genres?: string
  sort_by?: string
  year?: string
}) {
  let results = [...mockMovies]
  
  if (params.with_genres) {
    const genreId = parseInt(params.with_genres)
    results = results.filter(m => m.genre_ids.includes(genreId))
  }
  
  if (params.sort_by === 'vote_average.desc') {
    results.sort((a, b) => b.vote_average - a.vote_average)
  }
  
  return { results: shuffle(results), total_pages: 1 }
}

export async function discoverTVShows(params: {
  page?: number
  with_genres?: string
  sort_by?: string
  year?: string
}) {
  let results = [...mockTVShows]
  
  if (params.with_genres) {
    const genreId = parseInt(params.with_genres)
    results = results.filter(t => t.genre_ids.includes(genreId))
  }
  
  if (params.sort_by === 'vote_average.desc') {
    results.sort((a, b) => b.vote_average - a.vote_average)
  }
  
  return { results: shuffle(results), total_pages: 1 }
}

// Helper to get image URL - returns placeholder for mock data
export function getImageUrl(path: string | null, size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}
