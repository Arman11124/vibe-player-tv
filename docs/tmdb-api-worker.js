// TMDB Smart Proxy (Worker + R2 + Landing Page)
// Deploy to: api.xn--b1a5a.fun

const TMDB_API_HOST = 'api.themoviedb.org';
const TMDB_IMG_HOST = 'image.tmdb.org';
const CACHE_TTL_SECONDS = 2592000; // 30 Days

const LANDING_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OttBrowser - Free Movies & TV</title>
    <style>
        :root { --primary: #E50914; --dark: #141414; --light: #ffffff; }
        body { margin: 0; background-color: var(--dark); color: var(--light); font-family: Helvetica, Arial, sans-serif; }
        .hero { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(rgba(0,0,0,0.5), #141414), url('https://image.tmdb.org/t/p/original/mSDsSDwaP3E7Jjto22tPiDz8WK3.jpg'); background-size: cover; }
        .content { text-align: center; max-width: 800px; padding: 20px; }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        .btn { display: inline-block; background-color: var(--primary); color: white; padding: 1rem 3rem; font-size: 1.2rem; font-weight: bold; text-decoration: none; border-radius: 4px; }
        .features { padding: 4rem 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; max-width: 1000px; margin: 0 auto; text-align: center; }
        .feature-card { background: #1f1f1f; padding: 2rem; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="hero">
        <div class="content">
            <h1>VibePlayer (OttBrowser)</h1>
            <p>Free 4K Movies & Series via P2P. No Subscription. No VPN.</p>
            <a href="/latest.apk" class="btn">Download v3.2 (P2P Edition)</a>
            <div style="margin-top: 20px; font-size: 0.9rem; opacity: 0.7;">Version 3.2.0 • Android TV Ready</div>
        </div>
    </div>
    <div class="features">
        <div class="feature-card"><h3>🚀 P2P Engine</h3><p>TorrServer Matrix inside.</p></div>
        <div class="feature-card"><h3>🛡️ Smart Proxy</h3><p>Bypasses blocking automatically.</p></div>
        <div class="feature-card"><h3>📺 TV Ready</h3><p>Optimized for D-Pad & 4K.</p></div>
    </div>
</body>
</html>`;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // 0. LANDING PAGE & APK SERVING
        if (path === '/' || path === '/index.html') {
            return new Response(LANDING_PAGE, {
                headers: { 'Content-Type': 'text/html;charset=UTF-8' }
            });
        }

        if (path === '/latest.apk') {
            // Serve APK from vibe-static (Public) bucket
            // Since it's public, we could redirect, but serving via Worker keeps domain clean
            if (!env.VIBE_STATIC_BUCKET) {
                return new Response('Bucket Config Error', { status: 500 });
            }

            const object = await env.VIBE_STATIC_BUCKET.get('VibePlayer_Latest.apk');
            if (object === null) {
                return new Response('APK not found in R2 bucket', { status: 404 });
            }
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Content-Disposition', 'attachment; filename="VibePlayer_v3.2.0.apk"');

            return new Response(object.body, { headers });
        }

        // 1. ROUTING
        // /t/p/* -> Image CDN
        // /3/*   -> API
        let targetHost = TMDB_API_HOST;
        if (path.startsWith('/t/p/')) {
            targetHost = TMDB_IMG_HOST;
        }

        const targetUrl = `https://${targetHost}${path}${url.search}`;

        // 2. R2 CACHING (Only for API GET requests)
        // We don't cache images here (Cloudflare CDN handles that better), strictly JSON metadata
        const isCacheable = request.method === 'GET' && targetHost === TMDB_API_HOST && env.TMDB_CACHE_BUCKET;
        const cacheKey = `tmdb_v1${path}${url.search}`; // Simple cache key

        if (isCacheable) {
            try {
                const cached = await env.TMDB_CACHE_BUCKET.get(cacheKey);
                if (cached) {
                    // HIT!
                    const headers = new Headers(cached.httpMetadata);
                    headers.set('X-Proxy-Cache', 'HIT');
                    headers.set('Access-Control-Allow-Origin', '*'); // Ensure CORS on cached response
                    return new Response(cached.body, {
                        headers,
                        status: 200 // Assuming cached is always 200
                    });
                }
            } catch (e) {
                console.warn('[R2] Cache Read Error', e);
            }
        }

        // 3. FETCH & SPOOF
        try {
            const newRequest = new Request(targetUrl, {
                method: request.method,
                headers: request.headers,
                // body: request.body // GET usually has no body
            });

            // CRITICAL: Header Spoofing to bypass Geo-Block
            newRequest.headers.set('Host', targetHost);
            newRequest.headers.set('Referer', `https://${targetHost}`);

            // Clean up headers clearly identifying us
            newRequest.headers.delete('Cf-Worker');
            newRequest.headers.delete('X-Forwarded-Proto');

            const response = await fetch(newRequest, {
                cf: {
                    cacheTtl: 0, // Don't rely on standard CF Cache for API, we use R2
                    ssl: { strict: true } // Force strict SSL
                }
            });

            // 4. PROCESS RESPONSE
            const responseBody = await response.arrayBuffer(); // Read as buffer for R2

            // IF Valid API Response -> Save to R2
            if (isCacheable && response.ok) {
                ctx.waitUntil(
                    env.TMDB_CACHE_BUCKET.put(cacheKey, responseBody, {
                        httpMetadata: {
                            contentType: response.headers.get('content-type') || 'application/json',
                        },
                        customMetadata: {
                            timestamp: Date.now().toString()
                        }
                        // R2 doesn't support expiration natively in put() in all bindings, 
                        // but lifecycle rules on bucket handle cleanup.
                    })
                );
            }

            // 5. RETURN TO CLIENT
            const responseHeaders = new Headers(response.headers);
            responseHeaders.set('Access-Control-Allow-Origin', '*');
            responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            responseHeaders.set('X-Proxy-Cache', 'MISS');
            responseHeaders.set('X-Proxy-Worker', 'v2-SmartPlus');

            return new Response(responseBody, {
                status: response.status,
                headers: responseHeaders
            });

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message, hint: 'Proxy Fetch Failed' }), {
                status: 502,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }
};
