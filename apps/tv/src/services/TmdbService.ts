import axios from 'axios';
import { Alert } from 'react-native';

export const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a';
const BASE_URL = 'https://api.xn--b1a5a.fun/3';
const IMAGE_BASE_URL = 'https://api.xn--b1a5a.fun/t/p/w500';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

export const getImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE_URL}${path}`;
};

export type ContentType = 'movie' | 'tv';

export interface ContentItem {
  id: number;
  title: string; // "name" for TV mapped to "title"
  original_title?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview?: string;
  release_date?: string; // "first_air_date" for TV mapped to "release_date"
  vote_average?: number;
  media_type: ContentType;
  genre_ids?: number[];
}

// Raw TMDB responses often assume "title" for movies and "name" for TV
interface TmdbRawItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  media_type?: string;
}

interface TmdbResponse {
  results: Array<TmdbRawItem>;
}

// --- Mappers ---

const mapToContentItem = (item: TmdbRawItem, fallbackType: ContentType = 'movie'): ContentItem => {
  return {
    id: item.id,
    title: item.title || item.name || 'Unknown',
    original_title: item.original_title || item.original_name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    overview: item.overview,
    release_date: item.release_date || item.first_air_date,
    vote_average: item.vote_average,
    media_type: (item.media_type as ContentType) || fallbackType,
    genre_ids: item.genre_ids,
  };
};

// --- Generic Fetcher ---

export const fetchFromTmdb = async (endpoint: string, params: Record<string, any> = {}, type: ContentType = 'movie'): Promise<ContentItem[]> => {
  try {
    // USE HYDRA: ProxyService handles the rotation and fallback
    const { ProxyService } = require('./ProxyService');
    const data = await ProxyService.getTmdbData(endpoint, {
      ...params,
      language: 'ru-RU'
    }, { apiKey: TMDB_API_KEY });

    if (!data || !data.results) return [];

    return data.results
      .map((item: any) => mapToContentItem(item, type))
      .filter((item: any) => item.poster_path);
  } catch (error: any) {
    console.warn(`[TMDB] Error fetching ${endpoint}:`, error);
    return [];
  }
};

// --- Top Level API ---

// 1. Core Categories
export const fetchTrending = async (): Promise<ContentItem[]> => {
  try {
    const { ProxyService } = require('./ProxyService');
    const data = await ProxyService.getTmdbData('/trending/all/week', {
      language: 'ru-RU'
    }, { apiKey: TMDB_API_KEY });

    if (!data || !data.results) return [];
    return data.results
      .map((item: any) => mapToContentItem(item, (item.media_type as ContentType) || 'movie'))
      .filter((item: any) => item.poster_path);
  } catch (e) {
    console.warn('[TMDB] fetchTrending failed', e);
    return [];
  }
};
export const fetchPopularMovies = async (): Promise<ContentItem[]> => fetchFromTmdb('/movie/popular', {}, 'movie');
export const fetchTopRatedMovies = async (): Promise<ContentItem[]> => fetchFromTmdb('/movie/top_rated', {}, 'movie');
export const fetchNowPlaying = async (): Promise<ContentItem[]> => fetchFromTmdb('/movie/now_playing', {}, 'movie');
export const fetchUpcoming = async (): Promise<ContentItem[]> => fetchFromTmdb('/movie/upcoming', {}, 'movie');

// 2. TV Shows
export const fetchTrendingTV = async (): Promise<ContentItem[]> => fetchFromTmdb('/trending/tv/week', {}, 'tv');
export const fetchPopularTV = async (): Promise<ContentItem[]> => fetchFromTmdb('/tv/popular', {}, 'tv');
export const fetchTopRatedTV = async (): Promise<ContentItem[]> => fetchFromTmdb('/tv/top_rated', {}, 'tv');

// 3. Genres (Discover)
const GENRES = {
  Action: 28,
  Comedy: 35,
  Drama: 18,
  Thriller: 53,
  SciFi: 878,
  Documentary: 99,
  Animation: 16,
};

export const fetchByGenre = async (genreId: number, type: ContentType = 'movie'): Promise<ContentItem[]> => {
  return fetchFromTmdb(`/discover/${type}`, { with_genres: genreId }, type);
};

export const fetchActionMovies = () => fetchByGenre(GENRES.Action);
export const fetchComedyMovies = () => fetchByGenre(GENRES.Comedy);
export const fetchDramaMovies = () => fetchByGenre(GENRES.Drama);
export const fetchThrillerMovies = () => fetchByGenre(GENRES.Thriller);
export const fetchSciFiMovies = () => fetchByGenre(GENRES.SciFi);
export const fetchDocumentaries = () => fetchByGenre(GENRES.Documentary);
export const fetchCartoons = () => fetchByGenre(GENRES.Animation); // Мультфильмы

// 4. Regional Content (Discovery via Region/Language)

// Russia / USSR (Language 'ru' covers both mostly, or region RU)
// For USSR specific we might try origin_country='SU' but 'ru' language is a safer broad net for "Russian content"
export const fetchRussianContent = async (): Promise<ContentItem[]> => {
  return fetchFromTmdb('/discover/movie', {
    with_original_language: 'ru',
    sort_by: 'popularity.desc'
  }, 'movie');
};

// USA
export const fetchUSContent = async (): Promise<ContentItem[]> => {
  return fetchFromTmdb('/discover/movie', {
    with_origin_country: 'US',
    sort_by: 'popularity.desc'
  }, 'movie');
};

// UK
export const fetchUKContent = async (): Promise<ContentItem[]> => {
  return fetchFromTmdb('/discover/movie', {
    with_origin_country: 'GB',
    sort_by: 'popularity.desc'
  }, 'movie');
};

// Korea (K-Drama/Movies)
export const fetchKoreanContent = async (): Promise<ContentItem[]> => {
  return fetchFromTmdb('/discover/movie', {
    with_original_language: 'ko',
    sort_by: 'popularity.desc'
  }, 'movie');
};

// Europe (France, Germany, Italy, Spain)
export const fetchEuropeanContent = async (): Promise<ContentItem[]> => {
  return fetchFromTmdb('/discover/movie', {
    with_origin_country: 'FR|DE|IT|ES', // Pipe separated OR
    sort_by: 'popularity.desc'
  }, 'movie');
};


// 5. Details & Recommendations
export interface ContentDetails extends ContentItem {
  imdb_id?: string;
  runtime?: number;
  spoken_languages?: { english_name: string; name: string }[];
}

export const fetchDetails = async (id: number, type: ContentType = 'movie'): Promise<ContentDetails | null> => {
  try {
    const { ProxyService } = require('./ProxyService');
    const data = await ProxyService.getTmdbData(`/${type}/${id}`, {
      language: 'ru-RU', // get overview in Russian
      append_to_response: 'external_ids',
      include_image_language: 'ru,null,en'
    }, { apiKey: TMDB_API_KEY });

    // For movies, imdb_id is in root. For TV, usually in external_ids
    const imdbId = data.imdb_id || data.external_ids?.imdb_id;

    return {
      ...mapToContentItem(data, type),
      imdb_id: imdbId,
      runtime: data.runtime,
      spoken_languages: data.spoken_languages
    };
  } catch (e) {
    console.warn('[TMDB] fetchDetails failed', e);
    return null;
  }
};

export const fetchRecommendations = async (id: number, type: ContentType = 'movie', genreIds: number[] = []): Promise<ContentItem[]> => {
  try {
    // 1. Try Direct Recommendations (Best Quality)
    let results = await fetchFromTmdb(`/${type}/${id}/recommendations`, {}, type);

    // 2. Fallback: Similar Content (Broader Match)
    if (results.length < 5) {
      const similar = await fetchFromTmdb(`/${type}/${id}/similar`, {}, type);
      // Merge unique
      const existingIds = new Set(results.map(r => r.id));
      for (const item of similar) {
        if (!existingIds.has(item.id)) {
          results.push(item);
          existingIds.add(item.id);
        }
      }
    }

    // 3. Last Resort: Genre Discovery (Guaranteed Filler)
    if (results.length < 5 && genreIds.length > 0) {
      const primaryGenre = genreIds[0];
      const genreRecs = await fetchFromTmdb(`/discover/${type}`, {
        with_genres: primaryGenre,
        sort_by: 'popularity.desc',
        page: 1
      }, type);

      const existingIds = new Set(results.map(r => r.id));
      // Filter out the movie itself
      existingIds.add(id);

      for (const item of genreRecs) {
        if (!existingIds.has(item.id)) {
          results.push(item);
          existingIds.add(item.id);
        }
        // Limit total mix to reasonable amount (e.g. 20)
        if (results.length >= 20) break;
      }
    }

    return results;
  } catch (e) {
    console.warn('Smart Recommendations failed', e);
    return [];
  }
};

export const fetchVideos = async (id: number, type: ContentType = 'movie'): Promise<string | null> => {
  try {
    const { ProxyService } = require('./ProxyService');
    const data = await ProxyService.getTmdbData(`/${type}/${id}/videos`, {
      language: 'ru-RU'
    }, { apiKey: TMDB_API_KEY });

    let video = data.results.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));

    if (!video) {
      // Fallback to English
      const enData = await ProxyService.getTmdbData(`/${type}/${id}/videos`, {
        language: 'en-US'
      }, { apiKey: TMDB_API_KEY });
      video = enData.results.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
    }
    return video ? video.key : null;
  } catch (e) {
    console.warn('[TMDB] fetchVideos failed', e);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MOVIE DETAILS WITH TRAILER (Optimized Single Call)
// ─────────────────────────────────────────────────────────────────────────────

export interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
  runtime: number;
  trailerKey: string | null;
  media_type: ContentType;
  genre_ids?: number[];
  imdb_id?: string;
}

export const getMovieDetails = async (id: number, type: ContentType = 'movie'): Promise<MovieDetails | null> => {
  try {
    const { ProxyService } = require('./ProxyService');
    // Single API call via Hydra
    const data = await ProxyService.getTmdbData(`/${type}/${id}`, {
      language: 'ru-RU',
      append_to_response: 'videos,external_ids'
    }, { apiKey: TMDB_API_KEY });

    // Extract trailer key from videos
    let trailerKey: string | null = null;
    if (data.videos?.results?.length > 0) {
      const trailer = data.videos.results.find(
        (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
      );
      const teaser = data.videos.results.find(
        (v: any) => v.site === 'YouTube' && v.type === 'Teaser'
      );
      trailerKey = trailer?.key || teaser?.key || null;
    }

    // If no Russian trailer, try English
    if (!trailerKey) {
      try {
        const enData = await ProxyService.getTmdbData(`/${type}/${id}/videos`, {
          language: 'en-US'
        }, { apiKey: TMDB_API_KEY });

        const enTrailer = enData.results?.find(
          (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
        );
        trailerKey = enTrailer?.key || null;
      } catch { }
    }

    return {
      id: data.id,
      title: data.title || data.name || 'Unknown',
      overview: data.overview || 'Описание недоступно',
      backdrop_path: data.backdrop_path,
      poster_path: data.poster_path,
      vote_average: data.vote_average || 0,
      release_date: data.release_date || data.first_air_date || '',
      runtime: data.runtime || 0,
      trailerKey,
      media_type: type,
      genre_ids: data.genres?.map((g: any) => g.id) || [],
      imdb_id: data.imdb_id || data.external_ids?.imdb_id
    };
  } catch (e) {
    console.error('[TMDB] getMovieDetails failed:', e);
    return null;
  }
};


