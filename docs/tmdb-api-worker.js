export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

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
        if (url.pathname === '/VibePlayer_v4.1.0.apk' || url.pathname === '/OTT-Browser-v3.3.5.apk' || url.pathname === '/app.apk') {
            const range = request.headers.get('range');
            const apkName = url.pathname.includes('4.1.0') ? 'VibePlayer_v4.1.0.apk' : 'OTT-Browser-v3.3.5.apk';
            let object;
            try {
                // Remove 'onlyIf' - strictly clean get
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
            headers.set('Content-Disposition', 'attachment; filename="app.apk"');
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
            // wsrv.nl redirect for images
            const tmdbImageUrl = "https://image.tmdb.org" + url.pathname;
            const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(tmdbImageUrl)}`;
            const redirectHeaders = new Headers(corsHeaders);
            redirectHeaders.set('Location', wsrvUrl);
            return new Response(null, { status: 302, headers: redirectHeaders });
        }

        // ---------------------------------------------------------
        // 3. TMDB API PROXY (V15: Direct Fetch - No Redirect)
        // ---------------------------------------------------------
        try {
            const tmdbUrl = "https://api.themoviedb.org" + url.pathname + url.search;

            const tmdbResponse = await fetch(tmdbUrl, {
                method: request.method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const responseHeaders = new Headers(corsHeaders);
            responseHeaders.set('Content-Type', 'application/json');

            const body = await tmdbResponse.text();
            return new Response(body, {
                status: tmdbResponse.status,
                headers: responseHeaders
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Proxy error', message: e.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};
