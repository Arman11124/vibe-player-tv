export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        // DEBUG: Immediate return to check environment
        if (url.pathname.includes('debug')) return new Response("DEBUG OK");

        const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a'; // Production Key

        // V36: Manual Dictionary for common hard-to-translate queries
        const DICTIONARY = {
            'фоллаут': 'Fallout',
            'игра престолов': 'Game of Thrones',
            'одних из нас': 'The Last of Us',
            'дом дракона': 'House of the Dragon'
        };

        // ---------------------------------------------------------
        // 0. GLOBAL CORS HANDLER
        // ---------------------------------------------------------
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Requested-With, User-Agent, Accept-Language, X-Debug-Trans, X-Debug-Trans-Err',
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
            let apkName = 'VibePlayer_v4.1.1.apk';
            if (url.pathname.includes('4.1.0')) apkName = 'VibePlayer_v4.1.0.apk';
            else if (url.pathname.includes('3.3.5')) apkName = 'OTT-Browser-v3.3.5.apk';
            let object;
            try {
                object = await env.VIBE_STATIC_BUCKET.get(apkName, { range: range ? request.headers : undefined });
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
        // 2. TORRENT SEARCH (V36: Dictionary + Augmented Translate + Fuzzy + Swarm)
        // ---------------------------------------------------------
        if (url.pathname.includes('/search')) {
            const query = url.searchParams.get('q') || '';
            if (!query) return new Response('No query', { status: 400, headers: corsHeaders });

            let debugTransErr = 'None';

            // Helper: Perform Search with Swarm
            async function performSearch(searchQuery) {
                const rutorUrl = `http://rutor.info/search/0/0/0/0/${encodeURIComponent(searchQuery)}`;
                const encodedRutorUrl = encodeURIComponent(rutorUrl);

                const searchProxies = [
                    { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedRutorUrl}` },
                    { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedRutorUrl}` },
                    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedRutorUrl}` },
                    { name: 'corsproxy.org', url: `https://corsproxy.org/?${encodedRutorUrl}` }
                ];

                let results = [];
                let success = false;
                let error = null;

                for (const proxy of searchProxies) {
                    try {
                        const response = await fetch(proxy.url, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                        });

                        if (response.status !== 200) continue;

                        const html = await response.text();
                        if (!html.includes('magnet:') && !html.includes('rutor.info')) continue;

                        const regex = /magnet:\?xt=urn:btih:([a-zA-Z0-9]+)&[\s\S]*?href="\/torrent\/\d+\/[^"]+">([^<]+)<\/a>[\s\S]*?align="right">([^<]+)<\/td>[\s\S]*?class="green">.+?>([0-9]+)</g;

                        let match;
                        while ((match = regex.exec(html)) !== null) {
                            results.push({
                                title: match[2],
                                magnet: `magnet:?xt=urn:btih:${match[1]}`,
                                size: match[3].replace(/&nbsp;/g, ' '),
                                seeds: parseInt(match[4]),
                                peers: 0,
                                source: 'Rutor'
                            });
                        }

                        // Treat empty valid page as success
                        if (results.length > 0 || html.includes('rutor.info')) {
                            success = true;
                            break;
                        }
                    } catch (e) {
                        error = e;
                    }
                }
                return { results, success, error };
            }

            // Helper: Translate via TMDB (Direct + Swarm)
            async function getOriginalTitle(textQuery) {
                // 1. Check Dictionary First
                const normalized = textQuery.trim().toLowerCase();
                if (DICTIONARY[normalized]) return DICTIONARY[normalized];

                // 2. Try TMDB
                const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(textQuery)}&language=ru-RU`;
                const encodedTmdbUrl = encodeURIComponent(tmdbUrl);

                const proxies = [
                    { name: 'direct', url: tmdbUrl },
                    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedTmdbUrl}` },
                    { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedTmdbUrl}` },
                    { name: 'corsproxy.org', url: `https://corsproxy.org/?${encodedTmdbUrl}` }
                ];

                for (const proxy of proxies) {
                    try {
                        const res = await fetch(proxy.url, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                'Accept': 'application/json'
                            }
                        });

                        if (res.ok) {
                            const contentType = res.headers.get('content-type');
                            if (contentType && contentType.includes('application/json')) {
                                const data = await res.json();
                                if (data.results && data.results.length > 0) {
                                    const top = data.results[0];
                                    return top.original_title || top.original_name || null;
                                }
                            } else {
                                try {
                                    const text = await res.text();
                                    const data = JSON.parse(text);
                                    if (data.results && data.results.length > 0) {
                                        const top = data.results[0];
                                        return top.original_title || top.original_name || null;
                                    }
                                } catch (e) {
                                    debugTransErr = `Proxy ${proxy.name} non-JSON`;
                                }
                            }
                        } else {
                            debugTransErr = `Proxy ${proxy.name} ${res.status}`;
                        }
                    } catch (e) {
                        debugTransErr = `Proxy ${proxy.name} Error: ${e.message}`;
                    }
                }
                return null;
            }

            // ---------------- Execute Logic ----------------

            // 1. Try Exact Query
            let { results, success, error } = await performSearch(query);
            let flow = 'Exact';
            let debugTrans = 'Skipped';

            // 2. Fuzzy Fallback (Strip Year)
            // Always try stripping year if 0 results
            if (results.length === 0) {
                const yearRegex = /\s?(19|20)\d{2}$/;
                if (yearRegex.test(query)) {
                    const fallbackQuery = query.replace(yearRegex, '');
                    const fallback = await performSearch(fallbackQuery);
                    if (fallback.success) {
                        results = fallback.results;
                        success = true;
                        flow = 'FuzzyYear';
                    }
                }
            }

            // 3. Augmented Translate
            // If results are few (e.g. 0 or 1-2 random matches), Try Translate.
            if (results.length < 5) {
                // Determine what text to translate
                const yearRegex = /\s?(19|20)\d{2}$/;
                let textToTranslate = query;
                if (yearRegex.test(query)) textToTranslate = query.replace(yearRegex, '');

                const originalTitle = await getOriginalTitle(textToTranslate);
                debugTrans = originalTitle || 'Null';

                if (originalTitle && originalTitle !== textToTranslate) {
                    const translateSearch = await performSearch(originalTitle);
                    if (translateSearch.success && translateSearch.results.length > 0) {
                        // Merge Logic
                        const existingMagnets = new Set(results.map(r => r.magnet));
                        for (const res of translateSearch.results) {
                            if (!existingMagnets.has(res.magnet)) {
                                results.push(res);
                            }
                        }
                        success = true;
                        flow += `+Translated(${encodeURIComponent(originalTitle)})`;
                    }
                }
            }

            const responseHeaders = new Headers(corsHeaders);
            responseHeaders.set('Content-Type', 'application/json');
            responseHeaders.set('X-Search-Flow', flow);
            responseHeaders.set('X-Debug-Trans', encodeURIComponent(debugTrans));
            responseHeaders.set('X-Debug-Trans-Err', encodeURIComponent(debugTransErr));

            if (success) {
                return new Response(JSON.stringify(results), { headers: responseHeaders });
            } else {
                return new Response(JSON.stringify({ error: 'Search failed', details: error ? error.message : 'No Valid Proxy' }), {
                    status: 502,
                    headers: responseHeaders
                });
            }
        }

        // ---------------------------------------------------------
        // 3. TMDB API PROXY
        // ---------------------------------------------------------
        if (url.pathname.startsWith('/t/p/')) {
            const tmdbImageUrl = "https://image.tmdb.org" + url.pathname;
            const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(tmdbImageUrl)}`;
            const redirectHeaders = new Headers(corsHeaders);
            redirectHeaders.set('Location', wsrvUrl);
            return new Response(null, { status: 302, headers: redirectHeaders });
        }

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
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
                };
                if (proxy.name === 'direct') fetchOptions.headers['Authorization'] = request.headers.get('Authorization') || '';
                const response = await fetch(proxy.url, fetchOptions);
                if (response.status === 200 || response.status === 401) {
                    const responseHeaders = new Headers(corsHeaders);
                    responseHeaders.set('Content-Type', 'application/json');
                    responseHeaders.set('X-Vibe-Proxy', proxy.name);
                    return new Response(response.body, { status: response.status, headers: responseHeaders });
                }
            } catch (e) { lastError = e; }
        }
        return new Response(JSON.stringify({ error: 'All failed', tried: proxies.map(p => p.name) }), { status: 502, headers: corsHeaders });
    }
};
