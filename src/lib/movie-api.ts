const API_KEY = process.env.NEXT_PUBLIC_MOVIE_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

async function fetchFromMovieApi(endpoint: string) {
  const response = await fetch(`${BASE_URL}${endpoint}?api_key=${API_KEY}&language=en-US`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }

  return response.json();
}

export async function getMovieDetails(id: string) {
  return fetchFromMovieApi(`/movie/${id}`);
}

export async function searchMovies(query: string) {
  const encodedQuery = encodeURIComponent(query);
  return fetchFromMovieApi(`/search/movie?query=${encodedQuery}`);
}

export async function getTvShowDetails(id: string) {
  return fetchFromMovieApi(`/tv/${id}`);
}

export async function searchTvShows(query: string) {
  const encodedQuery = encodeURIComponent(query);
  return fetchFromMovieApi(`/search/tv?query=${encodedQuery}`);
}
