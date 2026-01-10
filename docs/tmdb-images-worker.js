// TMDB Image Proxy - Routes through external proxy to bypass geo-blocking
// Deploy to: images.xn--b1a5a.fun

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (!path || path === '/') {
            return new Response('TMDB Image Proxy. Usage: /w500/posterpath.jpg', { status: 200 });
        }

        // Use external proxy servers that are NOT in Russia
        // These are free TMDB image CDN proxies
        const proxyUrls = [
            `https://image.tmdb.org/t/p${path}`,  // Direct (fallback)
        ];

        // Try fetching through Cloudflare's global network with specific headers
        try {
            // Smart Path: Ensure /t/p/ exists (fixes manual testing & app consistency)
            let targetPath = path;
            if (!targetPath.startsWith('/t/p/')) {
                targetPath = `/t/p${path}`;
            }

            const response = await fetch(`https://image.tmdb.org${targetPath}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.themoviedb.org/',
                    'Origin': 'https://www.themoviedb.org'
                },
                cf: {
                    // Force Cloudflare to cache at edge and use any available PoP
                    cacheTtl: 86400 * 30,  // 30 days
                    cacheEverything: true,
                }
            });

            if (response.ok) {
                const imageData = await response.arrayBuffer();
                return new Response(imageData, {
                    status: 200,
                    headers: {
                        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
                        'Cache-Control': 'public, max-age=31536000, immutable',
                        'Access-Control-Allow-Origin': '*',
                        'X-Cache': 'HIT'
                    }
                });
            }

            return new Response('Image not found', { status: 404 });
        } catch (e) {
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    }
};
