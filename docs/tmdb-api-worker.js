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
        // 2. TORRENT SEARCH (V28.1: Rutor Scraper via AllOrigins)
        // ---------------------------------------------------------
        if (url.pathname.includes('/search')) {
            const query = url.searchParams.get('q') || '';
            if (!query) return new Response('No query', { status: 400, headers: corsHeaders });

            // Rutor Search URL
            const rutorUrl = `http://rutor.info/search/0/0/0/0/${encodeURIComponent(query)}`;
            // Proxy via AllOrigins to get HTML (bypass CORS/Blocks)
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rutorUrl)}`;

            try {
                const response = await fetch(proxyUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });
                const html = await response.text();

                // Regex to parse Rutor Table (Robust for Multiline)
                // Matches: 
                // 1. magnet link hash (captured by ([a-zA-Z0-9]+))
                // 2. Title (captured by ([^<]+))
                // 3. Size (captured by ([^<]+))
                // 4. Seeds (captured by ([0-9]+))
                // Using [\s\S]*? to match across newlines between tags

                const regex = /magnet:\?xt=urn:btih:([a-zA-Z0-9]+)&[\s\S]*?href="\/torrent\/\d+\/[^"]+">([^<]+)<\/a>[\s\S]*?align="right">([^<]+)<\/td>[\s\S]*?class="green">.+?>([0-9]+)</g;

                const results = [];
                let match;
                while ((match = regex.exec(html)) !== null) {
                    const magnetHash = match[1];
                    const fullMagnet = `magnet:?xt=urn:btih:${magnetHash}`;
                    results.push({
                        title: match[2],
                        magnet: fullMagnet,
                        size: match[3].replace(/&nbsp;/g, ' '),
                        seeds: parseInt(match[4]),
                        peers: 0,
                        source: 'Rutor'
                    });
                }

                // Return JSON
                const responseHeaders = new Headers(corsHeaders);
                responseHeaders.set('Content-Type', 'application/json');
                return new Response(JSON.stringify(results), { headers: responseHeaders });

            } catch (e) {
                return new Response(JSON.stringify({ error: 'Search failed', details: e.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // ---------------------------------------------------------
        // 3. TMDB IMAGE CHECK
        // ---------------------------------------------------------
        if (url.pathname.startsWith('/t/p/')) {
            const tmdbImageUrl = "https://image.tmdb.org" + url.pathname;
            const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(tmdbImageUrl)}`;
            const redirectHeaders = new Headers(corsHeaders);
            redirectHeaders.set('Location', wsrvUrl);
            return new Response(null, { status: 302, headers: redirectHeaders });
        }

        // ---------------------------------------------------------
        // 4. TMDB API PROXY (V27: The Proxy Swarm)
        // ---------------------------------------------------------

        const targetUrl = "https://api.themoviedb.org" + url.pathname + url.search;
        const encodedUrl = encodeURIComponent(targetUrl);

        const proxies = [
            { name: 'corsproxy.org', url: `https://corsproxy.org/?${encodedUrl}` },
            { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedUrl}` },
            { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}` },
            { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedUrl}` },
            { name: 'direct', url: targetUrl }
        ];

        let lastError = null;

        for (const proxy of proxies) {
            try {
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

                if (response.status === 200 || response.status === 401) {
                    const responseHeaders = new Headers(corsHeaders);
                    responseHeaders.set('Content-Type', 'application/json');
                    responseHeaders.set('X-Vibe-Proxy', proxy.name);

                    return new Response(response.body, {
                        status: response.status,
                        headers: responseHeaders
                    });
                }
            } catch (e) {
                lastError = e;
            }
        }

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
