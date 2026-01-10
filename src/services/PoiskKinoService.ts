/**
 * PoiskKinoService.ts
 * Russian movie metadata API - works without VPN in Russia
 * API: https://api.poiskkino.dev
 */

import axios from 'axios';
import { ContentItem, ContentType } from './TmdbService';

const API_BASE = 'https://api.poiskkino.dev/v1.4';
const API_KEY = '30AY857-XVV4BBE-GB47B9E-200J2CV';

const apiClient = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: {
        'X-API-KEY': API_KEY,
        'Accept': 'application/json'
    }
});

interface PoiskKinoMovie {
    id: number;
    name?: string;
    alternativeName?: string;
    enName?: string;
    year?: number;
    description?: string;
    rating?: {
        kp?: number;
        imdb?: number;
    };
    poster?: {
        url?: string;
        previewUrl?: string;
    };
    backdrop?: {
        url?: string;
    };
    genres?: Array<{ name: string }>;
    countries?: Array<{ name: string }>;
    movieLength?: number;
    type?: string;
    externalId?: {
        imdb?: string;
        tmdb?: number;
    };
}

interface PoiskKinoResponse {
    docs: PoiskKinoMovie[];
    total: number;
    limit: number;
    page: number;
}

const mapToContentItem = (movie: PoiskKinoMovie): ContentItem => {
    return {
        id: movie.externalId?.tmdb || movie.id,
        title: movie.name || movie.alternativeName || movie.enName || 'Без названия',
        original_title: movie.enName || movie.alternativeName,
        poster_path: movie.poster?.previewUrl || movie.poster?.url || null,
        backdrop_path: movie.backdrop?.url || null,
        overview: movie.description,
        release_date: movie.year?.toString(),
        vote_average: movie.rating?.kp || movie.rating?.imdb || 0,
        media_type: (movie.type === 'tv-series' || movie.type === 'animated-series') ? 'tv' : 'movie',
        genre_ids: movie.genres?.map((g, i) => i) || []
    };
};

// Fetch popular/trending movies
export const fetchPopular = async (): Promise<ContentItem[]> => {
    try {
        console.log('[PoiskKino] Fetching popular movies...');
        const { data } = await apiClient.get<PoiskKinoResponse>('/movie', {
            params: {
                'sortField': 'votes.kp',
                'sortType': -1,
                'limit': 50,
                'year': '2015-2026' // Wider range for more results
            }
        });
        console.log(`[PoiskKino] Raw: ${data.docs.length} movies`);
        // Filter locally: only movies with posters and minimum length
        const filtered = data.docs
            .filter(m => (m.poster?.url || m.poster?.previewUrl) && (m.movieLength || 0) > 40)
            .map(mapToContentItem)
            .slice(0, 20);
        console.log(`[PoiskKino] Filtered: ${filtered.length} movies`);
        return filtered;
    } catch (e) {
        console.log('[PoiskKino] fetchPopular error:', e);
        return [];
    }
};

// Search movies by title
export const searchMovies = async (query: string): Promise<ContentItem[]> => {
    try {
        console.log('[PoiskKino] Searching:', query);
        const { data } = await apiClient.get<PoiskKinoResponse>('/movie/search', {
            params: { query, limit: 20 }
        });
        return data.docs.map(mapToContentItem).filter(m => m.poster_path);
    } catch (e) {
        console.log('[PoiskKino] search error:', e);
        return [];
    }
};

// Fetch movies by genre
export const fetchByGenre = async (genreName: string): Promise<ContentItem[]> => {
    try {
        const { data } = await apiClient.get<PoiskKinoResponse>('/movie', {
            params: {
                'genres.name': genreName,
                'sortField': 'rating.kp',
                'sortType': -1,
                'limit': 20
            }
        });
        return data.docs.map(mapToContentItem).filter(m => m.poster_path);
    } catch (e) {
        console.log('[PoiskKino] fetchByGenre error:', e);
        return [];
    }
};

// Fetch top rated
export const fetchTopRated = async (): Promise<ContentItem[]> => {
    try {
        const { data } = await apiClient.get<PoiskKinoResponse>('/movie', {
            params: {
                'rating.kp': '8-10',
                'sortField': 'rating.kp',
                'sortType': -1,
                'limit': 20
            }
        });
        return data.docs.map(mapToContentItem).filter(m => m.poster_path);
    } catch (e) {
        console.log('[PoiskKino] fetchTopRated error:', e);
        return [];
    }
};

// Fetch new releases
export const fetchNewReleases = async (): Promise<ContentItem[]> => {
    try {
        const currentYear = new Date().getFullYear();
        const { data } = await apiClient.get<PoiskKinoResponse>('/movie', {
            params: {
                'year': `${currentYear - 1}-${currentYear}`,
                'sortField': 'year',
                'sortType': -1,
                'limit': 20
            }
        });
        return data.docs.map(mapToContentItem).filter(m => m.poster_path);
    } catch (e) {
        console.log('[PoiskKino] fetchNewReleases error:', e);
        return [];
    }
};

// Get random movie
export const fetchRandom = async (): Promise<ContentItem | null> => {
    try {
        const { data } = await apiClient.get<PoiskKinoMovie>('/movie/random');
        return mapToContentItem(data);
    } catch (e) {
        console.log('[PoiskKino] fetchRandom error:', e);
        return null;
    }
};

// Check if API is accessible (for connectivity testing)
export const checkConnectivity = async (): Promise<boolean> => {
    try {
        const { data } = await apiClient.get<PoiskKinoResponse>('/movie', {
            params: { limit: 1 }
        });
        return data.docs && data.docs.length > 0;
    } catch (e) {
        console.log('[PoiskKino] Connectivity check failed:', e);
        return false;
    }
};
