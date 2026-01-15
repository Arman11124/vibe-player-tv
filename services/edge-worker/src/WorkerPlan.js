
import { decode } from 'html-entities'; // You might need to add this dependency or use a simple regex replacer if size is concern

const GATEWAY_URL = 'http://167.71.53.11:3000'; // user's VPS IP or placeholder
const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a'; // Keeping existing key

// ... (Helper functions for Search: fetchWithTimeout, formatSize, searchSolid, searchApiBay) ...

export default {
    async fetch(request, env, ctx) {
        // ... (CORS & Proxy Logic) ...

        // /play/:id logic
        if (url.pathname.startsWith('/play/')) {
            const tmdbId = url.pathname.split('/play/')[1];

            // 1. Get Meta from TMDB (to get title/year)
            const meta = await fetchTmdbMeta(tmdbId);
            const query = meta.original_title || meta.title;
            const year = meta.release_date ? meta.release_date.split('-')[0] : '';

            // 2. Search Torrents (Internal)
            const magnets = await searchTorrents(query, year);

            if (!magnets || magnets.length === 0) {
                return new Response(JSON.stringify({ error: 'No sources found' }), { status: 404 });
            }

            // 3. Select Best
            const best = magnets[0]; // Already sorted by seeds

            // 4. Construct Gateway URL
            // Gateway expects: /stream/:infoHash/:fileIndex
            const streamUrl = `${GATEWAY_URL}/stream/${best.infoHash}/0`;

            return new Response(JSON.stringify({
                streamUrl: streamUrl,
                title: best.title,
                posterUrl: `https://image.tmdb.org/t/p/w500${meta.poster_path}`
            }));
        }
    }
}

// ... Implementation Details ...
