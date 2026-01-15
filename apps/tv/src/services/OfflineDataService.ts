/**
 * OfflineDataService.ts
 * Serves movie data from bundled JSON - no external API needed
 * Works 100% offline, no network blocking issues
 */

import offlineMovies from '../data/offlineMovies.json';
import { ContentItem } from './TmdbService';

interface OfflineMovie {
    id: number;
    title: string;
    year: number;
    rating: number;
    poster: string;
    backdrop?: string;
    description: string;
    genres: string[];
    countries: string[];
    duration?: number;
    isSeries: boolean;
}

const mapToContentItem = (movie: OfflineMovie): ContentItem => ({
    id: movie.id,
    title: movie.title,
    original_title: movie.title,
    poster_path: movie.poster, // Full URL from Yandex CDN
    backdrop_path: movie.backdrop || null,
    overview: movie.description,
    release_date: movie.year?.toString(),
    vote_average: movie.rating,
    media_type: movie.isSeries ? 'tv' : 'movie',
    genre_ids: movie.genres.map((_, i) => i)
});

// Get all movies
export const getAllMovies = (): ContentItem[] => {
    return (offlineMovies as OfflineMovie[]).map(mapToContentItem);
};

// Get trending/popular (top rated)
export const getTrending = (): ContentItem[] => {
    const sorted = [...(offlineMovies as OfflineMovie[])]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 20);
    return sorted.map(mapToContentItem);
};

// Get new releases (by year)
export const getNewReleases = (): ContentItem[] => {
    const currentYear = new Date().getFullYear();
    const sorted = [...(offlineMovies as OfflineMovie[])]
        .filter(m => m.year >= currentYear - 1)
        .sort((a, b) => b.year - a.year)
        .slice(0, 20);
    return sorted.map(mapToContentItem);
};

// Get movies (exclude series)
export const getMoviesOnly = (): ContentItem[] => {
    return (offlineMovies as OfflineMovie[])
        .filter(m => !m.isSeries)
        .slice(0, 20)
        .map(mapToContentItem);
};

// Get TV series only
export const getTVOnly = (): ContentItem[] => {
    return (offlineMovies as OfflineMovie[])
        .filter(m => m.isSeries)
        .slice(0, 20)
        .map(mapToContentItem);
};

// Search by title
export const searchOffline = (query: string): ContentItem[] => {
    const q = query.toLowerCase();
    return (offlineMovies as OfflineMovie[])
        .filter(m => m.title.toLowerCase().includes(q))
        .slice(0, 20)
        .map(mapToContentItem);
};

// Get by genre
export const getByGenre = (genre: string): ContentItem[] => {
    return (offlineMovies as OfflineMovie[])
        .filter(m => m.genres.some(g => g.toLowerCase() === genre.toLowerCase()))
        .slice(0, 20)
        .map(mapToContentItem);
};

console.log(`[Offline] Loaded ${offlineMovies.length} movies from bundle`);
