// TMDB API Proxy Worker
// Deploy to: api.xn--b1a5a.fun
// This Worker proxies requests to TMDB API, bypassing geo-blocking

export default {
    async fetch(request) {
        const url = new URL(request.url);

        // Get the path after the domain (e.g., /3/movie/popular)
        const path = url.pathname + url.search;

        // Root path - show usage
        if (path === '/' || path === '') {
            return new Response('TMDB API Proxy. Usage: /3/movie/popular?api_key=xxx', {
                status: 200,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // Build target URL
        const targetUrl = `https://api.themoviedb.org${path}`;

        try {
            // Fetch from TMDB with Cloudflare Worker's global network
            // Worker runs in nearest PoP, but subrequest goes through CF's network
            const response = await fetch(targetUrl, {
                method: request.method,
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
                },
                cf: {
                    // These options help bypass geo-blocking:
                    cacheTtl: 300,           // Cache for 5 minutes
                    cacheEverything: true,   // Cache all responses
                    // Force resolve to non-Russia PoP not working on Workers :(
                }
            });

            // Return the response with CORS headers
            const responseBody = await response.text();

            return new Response(responseBody, {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Cache-Control': 'public, max-age=300',
                    'X-Proxy': 'TMDB-CF-Worker'
                }
            });

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};
