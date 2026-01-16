
import { decode } from 'html-entities';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // --- CONFIGURATION ---
        const GATEWAY_ORIGIN = env.GATEWAY_ORIGIN || 'http://localhost:3000';
        const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a'; // In prod use env.TMDB_API_KEY

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Requested-With, User-Agent, Accept-Language, X-Debug-Trans, X-Debug-Trans-Err, Cache-Control, Pragma, Connection',
            'Access-Control-Max-Age': '86400',
        };

        if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

        // ---------------------------------------------------------
        // 1. STATIC CONTENT (APK & HTML) - Restored from V56
        // ---------------------------------------------------------
        if (url.pathname.endsWith('.apk') || url.pathname.endsWith('.zip')) {
            const githubUrl = "https://github.com/Arman11124/vibe-player-tv/releases/download/v4.2.13/vibe-v4.2.13.apk";
            return Response.redirect(githubUrl, 302);
        }

        // Landing Page
        if (url.pathname === '/' || url.pathname === '/index.html') {
            return new Response(`
                <html>
                <body style="background:#0F172A; color:white; font-family:sans-serif; text-align:center; padding-top:100px; display:flex; flex-direction:column; align-items:center;">
                    <h1 style="font-size:4rem; margin-bottom:10px;">VibePlayer</h1>
                    <div style="background:#1E293B; padding:30px; border-radius:24px; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
                        <p style="font-size:1.5rem; color:#94A3B8; margin-bottom:30px;">Released: v4.2.19-HYDRA-RESCUE</p>
                        <a href="https://github.com/Arman11124/vibe-player-tv/releases/tag/v4.2.19" style="display:inline-block; padding:20px 40px; background:#10B981; color:white; text-decoration:none; font-size:1.5rem; border-radius:12px; font-weight:bold;">
                            DOWNLOAD ELITE EDITION
                        </a>
                    </div>
                    <p style="margin-top:40px; color:#475569;">Super-Engine v2 • 512 Connections • Mega-Swarm Enabled</p>
                </body>
                </html>
            `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
        }

        // ---------------------------------------------------------
        // 2. SEARCH ENGINE (V56 Shared Logic)
        // ---------------------------------------------------------
        // ---------------------------------------------------------
        // HELPER: Universal Proxy Swarm (Network Tunnel)
        // ---------------------------------------------------------
        async function fetchWithProxy(targetUrl, customHeaders = {}) {
            const encodedUrl = encodeURIComponent(targetUrl);
            const proxies = [
                { name: 'direct', url: targetUrl }, // TRY DIRECT FIRST (Fastest)
                { name: 'yacdn', url: `https://yacdn.org/proxy/${targetUrl}` }, // Backup 1
                { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedUrl}` }, // Backup 2
                { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}` } // Last Resort
            ];

            let lastError = null;
            for (const proxy of proxies) {
                try {
                    const headers = new Headers({
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.google.com/',
                        ...customHeaders
                    });

                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), 8000);

                    const res = await fetch(proxy.url, {
                        method: 'GET',
                        headers: headers,
                        signal: controller.signal
                    });
                    clearTimeout(id);

                    if (res.status === 200 || res.status === 401) {
                        return res;
                    }
                } catch (e) {
                    lastError = e;
                }
            }
            throw lastError || new Error('All proxies failed');
        }

        // ---------------------------------------------------------
        // 2. SEARCH ENGINE (ZONA TV STYLE - Multi-Source)
        // ---------------------------------------------------------

        // IRON 30: Pruned High-Performance Mega-Swarm (Consensus Optimized)
        const IRON_TRACKERS = [
            "udp://tracker.opentrackr.org:1337/announce",
            "udp://9.rarbg.com:2810/announce",
            "udp://exodus.desync.com:6969/announce",
            "udp://open.stealth.si:80/announce",
            "udp://tracker.torrent.eu.org:451/announce",
            "udp://tracker.moeking.me:6969/announce",
            "udp://explodie.org:6969/announce",
            "udp://open.demonii.com:1337/announce",
            "udp://tracker.coppersurfer.tk:6969/announce",
            "udp://bt.t-ru.org:2710/announce",
            "udp://retracker.lanta-net.ru:2710/announce",
            "udp://bt2.t-ru.org:2710/announce",
            "udp://bt3.t-ru.org:2710/announce",
            "udp://bt4.t-ru.org:2710/announce",
            "http://retracker.local/announce",
            "udp://tracker.internetwarriors.net:1337/announce",
            "udp://tracker.cyberia.is:6969/announce",
            "udp://tracker3.itzmx.com:6961/announce",
            "udp://tracker.leechers-paradise.org:6969/announce",
            "udp://tracker.zer0day.to:1337/announce",
            "udp://p4p.arenabg.com:1337/announce",
            "udp://tracker.bitsearch.to:1337/announce",
            "udp://tracker.securetrack.cc:1337/announce",
            "udp://ipv4.tracker.harry.lu:80/announce",
            "udp://tracker.swatech.info:2710/announce",
            "udp://tracker.birkenwald.de:6969/announce",
            "udp://tracker.kamigami.org:2710/announce",
            "udp://tracker.publictracker.xyz:6969/announce"
        ];

        async function performSearch(query) {
            const trackerParams = IRON_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");

            // ═══════════════════════════════════════════════════════════════
            // SOURCE 1: SolidTorrents (JSON API)
            // ═══════════════════════════════════════════════════════════════
            async function fetchSolid(q) {
                try {
                    const url = `https://solidtorrents.to/api/v1/search?sort=seeders&category=Video&limit=20&q=${encodeURIComponent(q)}`;
                    const res = await fetchWithProxy(url);
                    const data = await res.json();
                    return (data.results || []).map(item => ({
                        hash: (item.infoHash || "").toLowerCase(),
                        title: item.title || "Unknown",
                        seeds: parseInt(item.seeders) || 0,
                        size: item.size,
                        source: 'SolidTorrents'
                    })).filter(x => x.hash && x.hash.length === 40);
                } catch (e) { return []; }
            }

            // ═══════════════════════════════════════════════════════════════
            // SOURCE 2: ApiBay / PirateBay API
            // ═══════════════════════════════════════════════════════════════
            async function fetchApiBay(q) {
                try {
                    const url = `https://apibay.org/q.php?q=${encodeURIComponent(q)}`;
                    const res = await fetchWithProxy(url);
                    const data = await res.json();
                    if (!Array.isArray(data) || data[0]?.id === '0') return [];
                    return data.map(item => ({
                        hash: (item.info_hash || "").toLowerCase(),
                        title: item.name || "Unknown",
                        seeds: parseInt(item.seeders) || 0,
                        size: parseInt(item.size) || 0,
                        source: 'ApiBay'
                    })).filter(x => x.hash && x.hash.length === 40);
                } catch (e) { return []; }
            }

            // ═══════════════════════════════════════════════════════════════
            // SOURCE 3: Rutor.info (HTML Parsing - Zona TV Style)
            // ═══════════════════════════════════════════════════════════════
            async function fetchRutor(q) {
                try {
                    const url = `http://rutor.info/search/0/0/000/0/${encodeURIComponent(q)}`;
                    const res = await fetchWithProxy(url, { 'Accept': 'text/html' });
                    const html = await res.text();

                    // Parse magnet links from HTML
                    const results = [];
                    const magnetRegex = /magnet:\?xt=urn:btih:([a-fA-F0-9]{40})/gi;
                    const titleRegex = /<a[^>]*class="downtorrent"[^>]*>([^<]+)<\/a>/gi;

                    // Simple extraction: find all magnet hashes
                    let match;
                    while ((match = magnetRegex.exec(html)) !== null) {
                        const hash = match[1].toLowerCase();
                        // Try to extract title near this magnet
                        const titleMatch = html.substring(Math.max(0, match.index - 500), match.index + 200);
                        const titleExtract = titleMatch.match(/<a[^>]*href="\/torrent\/[^"]*"[^>]*>([^<]+)<\/a>/i);

                        results.push({
                            hash: hash,
                            title: titleExtract ? decode(titleExtract[1]) : `Rutor-${hash.substring(0, 8)}`,
                            seeds: 10, // Rutor doesn't show seeds in search, assume some
                            size: 0,
                            source: 'Rutor'
                        });
                    }

                    // Dedupe by hash
                    const seen = new Set();
                    return results.filter(x => {
                        if (seen.has(x.hash)) return false;
                        seen.add(x.hash);
                        return true;
                    }).slice(0, 15);
                } catch (e) {
                    console.log('[Rutor] Parse error:', e.message);
                    return [];
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // SOURCE 4: 1337x (HTML Parsing)
            // ═══════════════════════════════════════════════════════════════
            async function fetch1337x(q) {
                try {
                    const searchUrl = `https://1337x.to/search/${encodeURIComponent(q)}/1/`;
                    const res = await fetchWithProxy(searchUrl, { 'Accept': 'text/html' });
                    const html = await res.text();

                    // Extract torrent page links
                    const linkRegex = /href="(\/torrent\/\d+\/[^"]+)"/gi;
                    const links = [];
                    let linkMatch;
                    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < 5) {
                        links.push('https://1337x.to' + linkMatch[1]);
                    }

                    // Fetch first 3 detail pages for magnets
                    const results = [];
                    for (const link of links.slice(0, 3)) {
                        try {
                            const detailRes = await fetchWithProxy(link);
                            const detailHtml = await detailRes.text();

                            const magnetMatch = detailHtml.match(/magnet:\?xt=urn:btih:([a-fA-F0-9]{40})/i);
                            const titleMatch = detailHtml.match(/<title>([^<]+)/i);
                            const seedMatch = detailHtml.match(/Seeders[^>]*>(\d+)/i);

                            if (magnetMatch) {
                                results.push({
                                    hash: magnetMatch[1].toLowerCase(),
                                    title: titleMatch ? decode(titleMatch[1].replace(' | 1337x', '')) : 'Unknown',
                                    seeds: seedMatch ? parseInt(seedMatch[1]) : 5,
                                    size: 0,
                                    source: '1337x'
                                });
                            }
                        } catch (e) { continue; }
                    }
                    return results;
                } catch (e) {
                    console.log('[1337x] Parse error:', e.message);
                    return [];
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // MERGE ALL SOURCES (Parallel)
            // ═══════════════════════════════════════════════════════════════
            const [solidResults, apiBayResults, rutorResults, x1337Results] = await Promise.all([
                fetchSolid(query),
                fetchApiBay(query),
                fetchRutor(query),
                fetch1337x(query)
            ]);

            // Combine and dedupe
            const uniqueMap = new Map();
            const allResults = [...solidResults, ...apiBayResults, ...rutorResults, ...x1337Results];

            for (const item of allResults) {
                if (!uniqueMap.has(item.hash)) {
                    uniqueMap.set(item.hash, {
                        title: item.title,
                        magnet: `magnet:?xt=urn:btih:${item.hash}&dn=${encodeURIComponent(item.title)}${trackerParams}`,
                        infoHash: item.hash,
                        seeds: item.seeds,
                        size: item.size,
                        source: item.source
                    });
                } else {
                    // Prefer higher seed count
                    const existing = uniqueMap.get(item.hash);
                    if (item.seeds > existing.seeds) {
                        existing.seeds = item.seeds;
                    }
                }
            }

            const sorted = Array.from(uniqueMap.values()).sort((a, b) => b.seeds - a.seeds);
            console.log(`[Search] Query: "${query}" -> ${sorted.length} results from ${allResults.length} total`);
            return sorted;
        }

        // ---------------------------------------------------------
        // 3. /SEARCH Endpoint (Legacy Support)
        // ---------------------------------------------------------
        if (url.pathname.includes('/search')) {
            const query = url.searchParams.get('q') || '';
            if (!query) return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

            const cacheKey = new Request(url.toString(), request);
            const cache = caches.default;
            let response = await cache.match(cacheKey);
            if (response) {
                let newRes = new Response(response.body, response);
                newRes.headers.set("Access-Control-Allow-Origin", "*");
                newRes.headers.set("X-Source", "Cache");
                return newRes;
            }

            const results = await performSearch(query);
            // Limit to 5 for V56 Safety
            const finalResults = results.slice(0, 5);

            response = new Response(JSON.stringify(finalResults), {
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                    "Cache-Control": "public, max-age=1200",
                    "X-Search-Source": "Troika-V56-GatewayMerged"
                }
            });
            ctx.waitUntil(cache.put(cacheKey, response.clone()));
            return response;
        }

        // ---------------------------------------------------------
        // 4. /PLAY Endpoint (GATEWAY INTEGRATION) - NOW SUPPORTS TV + MOVIES
        // ---------------------------------------------------------
        if (url.pathname.startsWith('/play/')) {
            const pathParts = url.pathname.split('/');
            // Support: /play/:id?type=tv OR /play/:type/:id
            let tmdbId = pathParts[2];
            let type = url.searchParams.get('type') || 'movie';

            if (pathParts.length > 3) {
                type = pathParts[2];
                tmdbId = pathParts[3];
            }

            try {
                // A. Get Meta (Try specified type, fallback to other)
                let meta;
                let metaRes = await fetchWithProxy(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`, {
                    'Referer': 'https://www.themoviedb.org/'
                });

                if (metaRes.status !== 200 && !url.searchParams.get('type')) {
                    // Fallback to other type if not explicitly specified
                    const otherType = type === 'movie' ? 'tv' : 'movie';
                    metaRes = await fetchWithProxy(`https://api.themoviedb.org/3/${otherType}/${tmdbId}?api_key=${TMDB_API_KEY}`, {
                        'Referer': 'https://www.themoviedb.org/'
                    });
                    if (metaRes.status === 200) type = otherType;
                }

                if (metaRes.status !== 200) throw new Error("Metadata Not Found");

                meta = await metaRes.json();
                const title = meta.title || meta.name || meta.original_title || meta.original_name || 'Video';
                const year = (meta.release_date || meta.first_air_date || '').split('-')[0];
                let query = `${title} ${year}`;

                // B. Search
                let magnets = await performSearch(query);

                // Fallback: If "Title Year" fails, try just "Title"
                if (!magnets.length) {
                    magnets = await performSearch(title);
                }

                if (!magnets.length) {
                    return new Response(JSON.stringify({ error: "No sources found for: " + title }), { status: 404, headers: corsHeaders });
                }

                // C. Strategy: Direct Magnet (Elite Experience)
                const best = magnets[0];
                const mode = url.searchParams.get('mode') || 'native';

                if (mode === 'native') {
                    return new Response(JSON.stringify({
                        magnet: best.magnet,
                        hash: best.infoHash,
                        posterUrl: meta.poster_path ? `https://tmdb-proxy.dirtyhands-cdn-worker.workers.dev/t/p/original${meta.poster_path}` : null,
                        title: title,
                        fs_name: best.title,
                        type: type
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // D. Legacy Gateway Mode (Fallback)
                const streamUrl = `${GATEWAY_ORIGIN}/stream/${best.infoHash}/best`;

                return new Response(JSON.stringify({
                    streamUrl: streamUrl,
                    posterUrl: meta.poster_path ? `https://tmdb-proxy.dirtyhands-cdn-worker.workers.dev/t/p/original${meta.poster_path}` : null,
                    title: title,
                    fs_name: best.title,
                    debug_mode: 'gateway-direct'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // ---------------------------------------------------------
        // 5. TMDB PROXY (V44 - Robust)
        // ---------------------------------------------------------
        if (url.pathname.startsWith('/3/') || url.pathname.startsWith('/search/') || url.pathname.startsWith('/configuration')) {
            try {
                const response = await fetchWithProxy("https://api.themoviedb.org" + url.pathname + url.search, {
                    'Referer': 'https://www.themoviedb.org/'
                });

                // CLEAN RESPONSE (Prevent Double CORS & Gzip Mismatch)
                const newHeaders = new Headers(response.headers);

                // 1. Strip Upstream CORS (We provide our own)
                newHeaders.delete('Access-Control-Allow-Origin');
                newHeaders.delete('Access-Control-Allow-Methods');
                newHeaders.delete('Access-Control-Allow-Headers');

                // 2. Strip Encoding Headers (Worker decompresses body, passing 'gzip' header breaks client)
                newHeaders.delete('Content-Encoding');
                newHeaders.delete('Content-Length');
                newHeaders.delete('Transfer-Encoding');

                // 3. Set OUR CORS Headers
                Object.keys(corsHeaders).forEach(key => {
                    newHeaders.set(key, corsHeaders[key]);
                });

                return new Response(response.body, {
                    status: response.status,
                    headers: newHeaders
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: "Proxy Failed", details: e.message }), { status: 502, headers: corsHeaders });
            }

        }

        // Image Proxy (wsrv.nl)
        if (url.pathname.startsWith('/t/p/')) {
            const tmdbImageUrl = "https://image.tmdb.org" + url.pathname;
            const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(tmdbImageUrl)}`;
            const redirectHeaders = new Headers(corsHeaders);
            redirectHeaders.set('Location', wsrvUrl);
            return new Response(null, { status: 302, headers: redirectHeaders });
        }

        return new Response("VibePlayer Edge Worker (Merged Gateway+V56)", { headers: corsHeaders });
    }
};
