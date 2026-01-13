export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname.includes('debug')) return new Response("DEBUG OK");

        const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a';

        // V36 Dictionary
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

        if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

        // Static Content
        if (url.pathname.endsWith('.apk') || url.pathname === '/' || url.pathname === '/index.html') {
            if (url.pathname.endsWith('.apk')) {
                const range = request.headers.get('range');
                let apkName = 'VibePlayer_v4.1.1.apk';
                if (url.pathname.includes('4.1.0')) apkName = 'VibePlayer_v4.1.0.apk';
                else if (url.pathname.includes('3.3.5')) apkName = 'OTT-Browser-v3.3.5.apk';
                let object = await env.VIBE_STATIC_BUCKET.get(apkName, { range: range ? request.headers : undefined }) || await env.VIBE_STATIC_BUCKET.get(apkName);
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
                const headers = new Headers(corsHeaders);
                object.writeHttpMetadata(headers);
                headers.set('Content-Type', 'text/html; charset=utf-8');
                return new Response(object.body, { headers });
            }
        }

        // ---------------------------------------------------------
        // 2. TORRENT SEARCH (V37: PARALLEL SWARM) - KEEP
        // ---------------------------------------------------------
        if (url.pathname.includes('/search')) {
            const query = url.searchParams.get('q') || '';
            if (!query) return new Response('No query', { status: 400, headers: corsHeaders });

            let debugTransErr = 'None';
            const startTime = Date.now();

            async function performSearch(searchQuery) {
                const rutorUrl = `http://rutor.info/search/0/0/0/0/${encodeURIComponent(searchQuery)}`;
                const encodedRutorUrl = encodeURIComponent(rutorUrl);
                const searchProxies = [
                    { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedRutorUrl}` },
                    { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedRutorUrl}` },
                    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedRutorUrl}` }
                ];
                try {
                    const result = await Promise.any(searchProxies.map(async (proxy) => {
                        const response = await fetch(proxy.url, {
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            signal: AbortSignal.timeout(6000)
                        });
                        if (response.status !== 200) throw new Error(`${proxy.name} ${response.status}`);
                        const html = await response.text();
                        if (!html.includes('magnet:') && !html.includes('rutor.info')) throw new Error(`${proxy.name} Invalid`);
                        const results = [];
                        const regex = /magnet:\?xt=urn:btih:([a-zA-Z0-9]+)&[\s\S]*?href="\/torrent\/\d+\/[^"]+">([^<]+)<\/a>[\s\S]*?align="right">([^<]+)<\/td>[\s\S]*?class="green">.+?>([0-9]+)</g;
                        let match;
                        while ((match = regex.exec(html)) !== null) {
                            results.push({
                                title: match[2], magnet: `magnet:?xt=urn:btih:${match[1]}`,
                                size: match[3].replace(/&nbsp;/g, ' '), seeds: parseInt(match[4]), peers: 0, source: 'Rutor'
                            });
                        }
                        return { results, success: true, used: proxy.name };
                    }));
                    return result;
                } catch (e) {
                    return { results: [], success: false, error: e };
                }
            }

            async function getOriginalTitle(textQuery) {
                const normalized = textQuery.trim().toLowerCase();
                if (DICTIONARY[normalized]) return DICTIONARY[normalized];
                const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(textQuery)}&language=ru-RU`;
                const encodedTmdbUrl = encodeURIComponent(tmdbUrl);
                const proxies = [
                    { name: 'direct', url: tmdbUrl },
                    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedTmdbUrl}` }
                ];
                try {
                    const title = await Promise.any(proxies.map(async (proxy) => {
                        const res = await fetch(proxy.url, { signal: AbortSignal.timeout(3000) });
                        if (!res.ok) throw new Error(`${proxy.name} ${res.status}`);
                        const text = await res.text();
                        let data = JSON.parse(text);
                        if (data.results && data.results.length > 0) return data.results[0].original_title || data.results[0].original_name || null;
                        throw new Error(`${proxy.name} No Results`);
                    }));
                    return title;
                } catch (e) {
                    debugTransErr = 'All TMDB Proxies Failed';
                    return null;
                }
            }

            let currentSearch = await performSearch(query);
            let results = currentSearch.results;
            let success = currentSearch.success;
            let flow = 'Exact';
            let debugTrans = 'Skipped';

            if (results.length === 0) {
                const yearRegex = /\s?(19|20)\d{2}$/;
                if (yearRegex.test(query)) {
                    const fallback = await performSearch(query.replace(yearRegex, ''));
                    if (fallback.success) {
                        results = fallback.results;
                        success = true;
                        flow = 'FuzzyYear';
                    }
                }
            }
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
                            if (!existingMagnets.has(res.magnet)) results.push(res);
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
            responseHeaders.set('X-Duration-Ms', (Date.now() - startTime).toString());

            // V43 Cache
            responseHeaders.set('Cache-Control', 'public, max-age=3600');

            if (success) return new Response(JSON.stringify(results), { headers: responseHeaders });
            else return new Response(JSON.stringify({ error: 'Search failed' }), { status: 502, headers: responseHeaders });
        }

        if (url.pathname.startsWith('/t/p/')) {
            const tmdbImageUrl = "https://image.tmdb.org" + url.pathname;
            const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(tmdbImageUrl)}`;
            const redirectHeaders = new Headers(corsHeaders);
            redirectHeaders.set('Location', wsrvUrl);
            return new Response(null, { status: 302, headers: redirectHeaders });
        }

        // ---------------------------------------------------------
        // 4. TMDB API PROXY (V43: V41 List + Caching)
        // ---------------------------------------------------------
        const targetUrl = "https://api.themoviedb.org" + url.pathname + url.search;
        const encodedUrl = encodeURIComponent(targetUrl);
        // V41 Order: corsproxy.io, direct, codetabs, allorigins
        const proxies = [
            { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedUrl}` },
            { name: 'direct', url: targetUrl },
            { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}` },
            { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedUrl}` }
        ];

        let lastError = null;
        let tried = [];

        for (const proxy of proxies) {
            tried.push(proxy.name);
            try {
                let fetchOptions = {
                    method: request.method,
                    headers: { 'Accept': 'application/json' } // No User-Agent Spoofing
                };
                if (proxy.name === 'direct') fetchOptions.headers['Authorization'] = request.headers.get('Authorization') || '';

                const response = await fetch(proxy.url, fetchOptions);
                if (response.status === 200 || response.status === 401 || response.status === 404) {
                    const responseHeaders = new Headers(corsHeaders);
                    responseHeaders.set('Content-Type', 'application/json');
                    responseHeaders.set('X-Vibe-Proxy', proxy.name);

                    // V43 Aggressive Caching
                    responseHeaders.set('Cache-Control', 'public, max-age=3600');

                    return new Response(response.body, { status: response.status, headers: responseHeaders });
                }
            } catch (e) {
                lastError = e;
            }
        }

        return new Response(JSON.stringify({
            error: 'All proxies failed',
            tried: tried,
            last_error: lastError ? lastError.message : 'Unknown'
        }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
