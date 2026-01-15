const app = require('express')();

// Generic Fetch Wrapper (Node 18+ has fetch, but for Vercel Serverless Function, ensuring Request/Response)
// We'll use native global fetch if available, else require('node-fetch') if needed.
// Node 18 Runtime on Vercel supports fetch.

// --- CONFIGURATION ---
const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Requested-With, User-Agent, Accept-Language, X-Debug-Trans, X-Debug-Trans-Err, X-Source',
    'Access-Control-Max-Age': '86400',
};

// Middleware for CORS
app.use((req, res, next) => {
    res.set(corsHeaders);
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// ---------------------------------------------------------
// HELPER: Universal Proxy Swarm
// ---------------------------------------------------------
async function fetchWithProxy(targetUrl, customHeaders = {}) {
    // Exact copy of Worker Logic, using global fetch (Node 18+)
    const encodedUrl = encodeURIComponent(targetUrl);
    const proxies = [
        { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}` },
        { name: 'thingproxy', url: `https://thingproxy.freeboard.io/fetch/${targetUrl}` },
        { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedUrl}` },
        { name: 'yacdn', url: `https://yacdn.org/proxy/${targetUrl}` },
        { name: 'direct', url: targetUrl }
    ];

    let lastError = null;
    for (const proxy of proxies) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 8000);

            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.google.com/',
                ...customHeaders
            };

            const res = await fetch(proxy.url, {
                method: 'GET',
                headers: headers,
                signal: controller.signal
            });
            clearTimeout(id);

            if (res.status === 200 || res.status === 401) return res;
        } catch (e) { lastError = e; }
    }
    throw lastError || new Error('All proxies failed');
}

// ---------------------------------------------------------
// SEARCH ENGINE LOGIC
// ---------------------------------------------------------
async function performSearch(query) {
    const HTTP_TRACKERS = [
        "http://tracker.gbitt.info:80/announce",
        "http://bt3.t-ru.org/ann",
        "http://open.acgnxtracker.com:80/announce",
        "http://retracker.local/announce"
    ];
    const trackerParams = HTTP_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");

    async function fetchSource(url, sourceName) {
        try {
            const res = await fetchWithProxy(url);
            const data = await res.json();
            return { source: sourceName, data };
        } catch (e) { return { source: sourceName, error: e.message }; }
    }

    const safeQuery = query.replace(/ /g, '+');
    const tasks = [
        fetchSource(`https://solidtorrents.to/api/v1/search?sort=seeders&category=Video&limit=20&q=${safeQuery}`, 'solid'),
        fetchSource(`https://apibay.org/q.php?q=${safeQuery}`, 'apibay')
    ];

    const taskResults = await Promise.allSettled(tasks);
    const uniqueMap = new Map();
    // ... Processing ...
    for (const res of taskResults) {
        if (res.status === 'fulfilled' && res.value) {
            const { source, data } = res.value;
            if (!data) continue;
            let items = [];
            if (source === 'solid' && data.results) items = data.results;
            else if (source === 'apibay' && Array.isArray(data) && data[0]?.name !== 'No results returned' && data[0]?.id !== '0') items = data;

            for (const item of items) {
                try {
                    const hash = (item.infoHash || item.info_hash || "").trim().toLowerCase();
                    if (!hash || hash.length !== 40) continue;
                    const cleanMagnet = `magnet:?xt=urn:btih:${hash}&dn=Video${trackerParams}`;
                    const safeTitle = String(item.title || item.name || "Unknown Release");
                    const safeSeeds = parseInt(item.seeders || item.seeds || 0) || 0;
                    if (!uniqueMap.has(hash)) {
                        uniqueMap.set(hash, { title: safeTitle, magnet: cleanMagnet, infoHash: hash, seeds: safeSeeds, source });
                    }
                } catch (err) { }
            }
        }
    }
    return Array.from(uniqueMap.values()).sort((a, b) => b.seeds - a.seeds);
}

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

// 1. Landing (HTML)
app.get('/', (req, res) => {
    res.send(`
        <html>
        <body style="background:#000; color:white; font-family:arial; text-align:center; padding-top:50px;">
            <h1>VibeStream API</h1>
            <p>Running on Vercel Network</p>
            <p style="color:#666">Version 4.2.2 Backend</p>
            <br>
            <a href="https://github.com/Arman11124/vibe-player-tv/releases/latest" style="font-size:24px; color:#4ade80;">Download App (GitHub)</a>
        </body>
        </html>
    `);
});

// 2. Play Endpoint
app.get('/play/:tmdbId', async (req, res) => {
    const { tmdbId } = req.params;
    try {
        const metaRes = await fetchWithProxy(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const meta = await metaRes.json();
        const title = meta.title || meta.original_title || 'Video';
        const year = (meta.release_date || '').split('-')[0];

        let magnets = await performSearch(`${title} ${year}`);
        if (!magnets.length) magnets = await performSearch(title);

        if (!magnets.length) return res.status(404).json({ error: 'No sources found' });

        const best = magnets[0];
        res.json({
            magnet: best.magnet,
            posterUrl: meta.poster_path ? `https://image.tmdb.org/t/p/original${meta.poster_path}` : null,
            title: title,
            fs_name: best.title
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. TMDB Proxy
// Matches /3/..., /search/..., /configuration...
app.use((req, res, next) => {
    const path = req.path;
    if (path.startsWith('/3/') || path.startsWith('/search/') || path.startsWith('/configuration')) {
        (async () => {
            try {
                // Construct target URL. Handle legacy /3/ prefix or direct path.
                // If path starts with /3/, use it. If not, maybe append? 
                // Wait, Worker handled `url.pathname.startsWith('/3/')`. Vercel `req.path` includes `/api/...` usually? No, `api/index.js` routes from `/`.

                const targetPath = path.startsWith('/3/') ? path : '/3' + path; // Normalize to TMDB path
                // Actually TMDB needs /3/movie/... so if request is /3/movie/123, we keep it.
                // Avoid double /3 if present.

                const finalPath = path.startsWith('/3/') ? path : (path.startsWith('/configuration') ? '/3' + path : path);
                // Simple: Just proxy essentially everything that isn't /play or /

                const target = `https://api.themoviedb.org${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

                const response = await fetchWithProxy(target);
                const data = await response.json();
                res.status(response.status).json(data);
            } catch (e) {
                res.status(502).json({ error: "Proxy Failed: " + e.message });
            }
        })();
    } else {
        next();
    }
});

// 4. Image Proxy (Redirect to wsrv.nl)
app.use('/t/p/', (req, res) => {
    const tmdbImageUrl = "https://image.tmdb.org/t/p/" + req.path.replace('/t/p/', '');
    // Need to correctly strip the prefix if it's there
    const relativePath = req.originalUrl.split('/t/p/')[1] || req.path.split('/t/p/')[1];
    const fullImgUrl = "https://image.tmdb.org/t/p/" + relativePath;

    const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(fullImgUrl)}`;
    res.redirect(wsrvUrl);
});

module.exports = app;
