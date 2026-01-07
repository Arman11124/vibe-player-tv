import axios from 'axios';

// TODO: User needs to provide this key from https://kinopoiskapiunofficial.tech/
// Free tier: 500 requests/day
export const KINOPOISK_API_KEY = '';

const BASE_URL = 'https://kinopoiskapiunofficial.tech/api';

export interface KinopoiskRating {
    kp: number | null;
    imdb: number | null;
    filmId: number;
}

export const fetchKinopoiskRating = async (originalTitle: string, year?: string): Promise<KinopoiskRating | null> => {
    if (!KINOPOISK_API_KEY) {
        // console.warn('[Kinopoisk] No API Key provided'); // Silenced per user request
        return null;
    }

    try {
        // Strategy: Search by Keyword (Original Title) since IMDb lookup is spotty on free tier
        const searchUrl = `${BASE_URL}/v2.1/films/search-by-keyword`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'X-API-KEY': KINOPOISK_API_KEY },
            params: {
                keyword: originalTitle,
                page: 1,
            }
        });

        if (data.films && data.films.length > 0) {
            // Fuzzy match logic: pick first or match year
            const match = data.films.find((f: any) => year ? f.year == year : true) || data.films[0];

            // v2.1 response usually contains 'rating' which is the KP rating
            return {
                kp: match.rating && match.rating !== 'null' ? parseFloat(match.rating) : null,
                imdb: null,
                filmId: match.filmId
            };
        }

        return null;

    } catch (e) {
        console.warn('[Kinopoisk] Fetch failed', e);
        return null;
    }
};
