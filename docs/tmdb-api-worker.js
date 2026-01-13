export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        // DEBUG: Immediate return to check environment
        if (url.pathname.includes('debug')) return new Response("DEBUG OK");

        // ---------------------------------------------------------
        // 0. GLOBAL CORS HANDLER
        // ---------------------------------------------------------
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Requested-With, User-Agent, Accept-Language',
            'Access-Control-Max-Age': '86400',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // ---------------------------------------------------------
        // 1. STATIC CONTENT
        // ---------------------------------------------------------
        if (url.pathname === '/VibePlayer_v4.1.1.apk' || url.pathname === '/VibePlayer_v4.1.0.apk' || url.pathname === '/OTT-Browser-v3.3.5.apk' || url.pathname === '/app.apk') {
            const range = request.headers.get('range');
            let apkName = 'VibePlayer_v4.1.1.apk'; // Default to latest
            if (url.pathname.includes('4.1.0')) apkName = 'VibePlayer_v4.1.0.apk';
            else if (url.pathname.includes('3.3.5')) apkName = 'OTT-Browser-v3.3.5.apk';
            let object;
            try {
                object = await env.VIBE_STATIC_BUCKET.get(apkName, {
                    range: range ? request.headers : undefined
                });
            } catch (e) {
                object = await env.VIBE_STATIC_BUCKET.get(apkName);
            }
            if (!object) return new Response('APK not found', { status: 404, headers: corsHeaders });

            const headers = new Headers(corsHeaders);
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Content-Disposition', `attachment; filename="${apkName}"`);
            headers.set('Content-Type', 'application/vnd.android.package-archive');
            headers.set('Accept-Ranges', 'bytes');
            if (range && object.range) headers.set('Content-Range', object.range.toString());
            if (object.size) headers.set('Content-Length', object.size);
            return new Response(object.body, { headers, status: (range && object.range) ? 206 : 200 });
        }

        if (url.pathname === '/' || url.pathname === '/index.html') {
            const object = await env.VIBE_STATIC_BUCKET.get('index.html');
            if (!object) return new Response('404', { status: 404 });
            const headers = new Headers(corsHeaders);
            object.writeHttpMetadata(headers);
            headers.set('Content-Type', 'text/html; charset=utf-8');
            return new Response(object.body, { headers });
        }

        // ---------------------------------------------------------
        // 2. TMDB IMAGE CHECK
        // ---------------------------------------------------------
        if (url.pathname.startsWith('/t/p/')) {
            const tmdbImageUrl = "https://image.tmdb.org" + url.pathname;
            const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(tmdbImageUrl)}`;
            const redirectHeaders = new Headers(corsHeaders);
            redirectHeaders.set('Location', wsrvUrl);
            return new Response(null, { status: 302, headers: redirectHeaders });
        }

        // ---------------------------------------------------------
        // 3. TMDB API PROXY (V27: The Proxy Swarm)
        // ---------------------------------------------------------
        // Goal: Bypass DNS Poisoning (127.0.0.1) in Moscow Region.
        // Strategy: Iterate through public proxies until one works.

        const targetUrl = "https://api.themoviedb.org" + url.pathname + url.search;
        const encodedUrl = encodeURIComponent(targetUrl);

        // List of proxies to try (Priority Order)
        // Note: corsproxy.io was blocked, but we retry. corsproxy.org is new.
        const proxies = [
            { name: 'corsproxy.org', url: `https://corsproxy.org/?${encodedUrl}` },
            { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedUrl}` },
            { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}` },
            { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedUrl}` },
            { name: 'direct', url: targetUrl } // Final Fallback
        ];

        let lastError = null;

        for (const proxy of proxies) {
            try {
                // If Direct, we use special headers
                let fetchOptions = {
                    method: request.method,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json'
                    }
                };

                if (proxy.name === 'direct') {
                    fetchOptions.headers['Authorization'] = request.headers.get('Authorization') || '';
                }

                const response = await fetch(proxy.url, fetchOptions);

                // Validation: Must be 200 OK (or 401 if key is bad, which is "Success" for connectivity)
                // And Content-Type should happen to be JSON usually.
                if (response.status === 200 || response.status === 401) {
                    const responseHeaders = new Headers(corsHeaders);
                    responseHeaders.set('Content-Type', 'application/json');
                    responseHeaders.set('X-Vibe-Proxy', proxy.name); // Debug Info

                    return new Response(response.body, {
                        status: response.status,
                        headers: responseHeaders
                    });
                } else {
                    // console.log(`Proxy ${proxy.name} failed with status: ${response.status}`);
                    // Continue to next proxy
                }
            } catch (e) {
                lastError = e;
                // console.log(`Proxy ${proxy.name} error: ${e.message}`);
            }
        }

        // If all fail
        return new Response(JSON.stringify({
            error: 'All proxies failed',
            last_error: lastError ? lastError.message : 'Unknown',
            tried: proxies.map(p => p.name)
        }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
