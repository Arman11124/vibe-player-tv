export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        // DEBUG: Immediate return to check environment
        if (url.pathname.includes('debug')) return new Response("DEBUG OK");

        const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a'; // Production Key

        // V36 Manual Dictionary 
        const DICTIONARY = {
            'фоллаут': 'Fallout',
            'игра престолов': 'Game of Thrones',
            'одних из нас': 'The Last of Us',
            'дом дракона': 'House of the Dragon'
        };

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Requested-With, User-Agent, Accept-Language, X-Debug-Trans, X-Debug-Trans-Err',
            'Access-Control-Max-Age': '86400',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Static Content (Standard)
        if (url.pathname.endsWith('.apk') || url.pathname === '/' || url.pathname === '/index.html') {
            // ... reusing concise logic for brevity in this focused overwrite ...
            // Actually, I must provide full file content. 
        }

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
        // 2. TORRENT SEARCH (V37: Parallel Swarm + Dictionary)
        // ---------------------------------------------------------
        if (url.pathname.includes('/search')) {
            const query = url.searchParams.get('q') || '';
            if (!query) return new Response('No query', { status: 400, headers: corsHeaders });

            let debugTransErr = 'None';
            const startTime = Date.now();

            // Helper: Perform Search with PARALLEL Swarm (Race)
            async function performSearch(searchQuery) {
                const rutorUrl = `http://rutor.info/search/0/0/0/0/${encodeURIComponent(searchQuery)}`;
                const encodedRutorUrl = encodeURIComponent(rutorUrl);

                const searchProxies = [
                    { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedRutorUrl}` },
                    { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedRutorUrl}` },
                    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedRutorUrl}` },
                    { name: 'corsproxy.org', url: `https://corsproxy.org/?${encodedRutorUrl}` }
                ];

                // Race all proxies via Promise.any (first successful with VALID content wins)
                try {
                    const result = await Promise.any(searchProxies.map(async (proxy) => {
                        const response = await fetch(proxy.url, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                            signal: AbortSignal.timeout(5000) // 5s individual timeout
                        });
                        if (response.status !== 200) throw new Error(`${proxy.name} ${response.status}`);

                        const html = await response.text();
                        // Validation
                        if (!html.includes('magnet:') && !html.includes('rutor.info')) throw new Error(`${proxy.name} Invalid Content`);

                        // Parse
                        const results = [];
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
                        return { results, success: true, used: proxy.name };
                    }));
                    return result;
                } catch (e) {
                    // Aggregate error (all failed)
                    return { results: [], success: false, error: e };
                }
            }

            // Helper: Translate via TMDB (Parallel Swarm)
            async function getOriginalTitle(textQuery) {
                // 1. Dictionary
                const normalized = textQuery.trim().toLowerCase();
                if (DICTIONARY[normalized]) return DICTIONARY[normalized];

                // 2. TMDB Parallel Race
                const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(textQuery)}&language=ru-RU`;
                const encodedTmdbUrl = encodeURIComponent(tmdbUrl);

                const proxies = [
                    { name: 'direct', url: tmdbUrl },
                    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedTmdbUrl}` },
                    { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedTmdbUrl}` }
                ];

                try {
                    const title = await Promise.any(proxies.map(async (proxy) => {
                        const res = await fetch(proxy.url, {
                            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
                            signal: AbortSignal.timeout(3000)
                        });
                        if (!res.ok) throw new Error(`${proxy.name} ${res.status}`);
                        const text = await res.text();
                        let data;
                        try { data = JSON.parse(text); } catch { throw new Error(`${proxy.name} non-JSON`); }

                        if (data.results && data.results.length > 0) {
                            const top = data.results[0];
                            return top.original_title || top.original_name || null;
                        }
                        throw new Error(`${proxy.name} No Results`);
                    }));
                    return title;
                } catch (e) {
                    debugTransErr = 'All TMDB Proxies Failed';
                    return null;
                }
            }

            // ---------------- Execute Logic ----------------

            // 1. Exact Query
            let currentSearch = await performSearch(query);
            let results = currentSearch.results;
            let success = currentSearch.success;
            let flow = 'Exact';
            let debugTrans = 'Skipped';

            // 2. Fuzzy Fallback (Strip Year)
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

            // 3. Augmented Translate (< 5 results)
            if (results.length < 5) {
                const yearRegex = /\s?(19|20)\d{2}$/;
                let textToTranslate = query;
                if (yearRegex.test(query)) textToTranslate = query.replace(yearRegex, '');

                const originalTitle = await getOriginalTitle(textToTranslate);
                debugTrans = originalTitle || 'Null';

                if (originalTitle && originalTitle !== textToTranslate) {
                    const translateSearch = await performSearch(originalTitle);
                    if (translateSearch.success && translateSearch.results.length > 0) {
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

            const duration = Date.now() - startTime;
            const responseHeaders = new Headers(corsHeaders);
            responseHeaders.set('Content-Type', 'application/json');
            responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            responseHeaders.set('X-Search-Flow', flow);
            responseHeaders.set('X-Debug-Trans', encodeURIComponent(debugTrans));
            responseHeaders.set('X-Duration-Ms', duration.toString());

            if (success) {
                return new Response(JSON.stringify(results), { headers: responseHeaders });
            } else {
                return new Response(JSON.stringify({ error: 'Search failed' }), {
                    status: 502,
                    headers: responseHeaders
                });
            }
        }

        // TMDB Image Proxy
        if (url.pathname.startsWith('/t/p/')) {
            const tmdbImageUrl = "https://image.tmdb.org" + url.pathname;
            const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(tmdbImageUrl)}`;
            const redirectHeaders = new Headers(corsHeaders);
            redirectHeaders.set('Location', wsrvUrl);
            return new Response(null, { status: 302, headers: redirectHeaders });
        }

        // TMDB API Swarm (Main) - ALSO V37 PARALLEL
        const targetUrl = "https://api.themoviedb.org" + url.pathname + url.search;
        const encodedUrl = encodeURIComponent(targetUrl);
        const proxies = [
            { name: 'direct', url: targetUrl },
            { name: 'corsproxy.org', url: `https://corsproxy.org/?${encodedUrl}` },
            { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedUrl}` },
            { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedUrl}` }
        ];

        try {
            const response = await Promise.any(proxies.map(async (proxy) => {
                let fetchOptions = {
                    method: request.method,
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(4000)
                };
                if (proxy.name === 'direct') fetchOptions.headers['Authorization'] = request.headers.get('Authorization') || '';

                const res = await fetch(proxy.url, fetchOptions);
                if (res.status === 200 || res.status === 401) return res;
                throw new Error('Avg Status ' + res.status);
            }));

            const responseHeaders = new Headers(corsHeaders);
            responseHeaders.set('Content-Type', 'application/json');
            return new Response(response.body, { status: response.status, headers: responseHeaders });

        } catch (e) {
            return new Response(JSON.stringify({ error: 'All proxies failed' }), { status: 502, headers: corsHeaders });
        }
    }
};
