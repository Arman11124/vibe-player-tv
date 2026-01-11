export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // БАЗОВЫЙ URL TMDB
        const TMDB_API = "https://api.themoviedb.org";
        const TMDB_IMAGE = "https://images.tmdb.org";

        // 0. СКАЧИВАНИЕ APK (v3.3.5)
        if (url.pathname === '/OTT-Browser-v3.3.5.apk') {
            const object = await env.VIBE_STATIC_BUCKET.get('OTT-Browser-v3.3.5.apk');
            if (object === null) {
                return new Response('APK not found', { status: 404 });
            }
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Content-Disposition', 'attachment; filename="OTT-Browser-v3.3.5.apk"');
            return new Response(object.body, { headers });
        }

        // 1. ОБРАБОТКА КАРТИНОК (Самое важное сейчас!)
        // Если путь начинается с /t/p/ - это картинка TMDB
        if (url.pathname.startsWith('/t/p/')) {
            const newUrl = TMDB_IMAGE + url.pathname;

            // "Polite Browser" (Method 5)
            // Используем рабочий домен images.tmdb.org + Valid Referer
            try {
                const response = await fetch(newUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.themoviedb.org/', // Pretend we are the main site
                        'Host': 'images.tmdb.org', // Be explicit
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                    }
                });

                if (!response.ok) {
                    // Detailed Error for User Debugging
                    return new Response(`TMDB Proxy Error: ${response.status} ${response.statusText} from ${newUrl}`, {
                        status: response.status,
                        headers: { 'Access-Control-Allow-Origin': '*' }
                    });
                }

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        ...Object.fromEntries(response.headers),
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=31536000'
                    }
                });
            } catch (e) {
                return new Response(`Proxy Exception (Method 5): ${e.message}`, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
            }
        }

        // 2. ОБРАБОТКА API (JSON данных - описания, поиск)
        // Весь остальной трафик идет на API TMDB
        const newUrl = TMDB_API + url.pathname + url.search;
        const response = await fetch(newUrl, {
            method: request.method,
            headers: {
                ...Object.fromEntries(request.headers),
                'Host': 'api.themoviedb.org' // Критично для обхода блокировки
            }
        });

        return response;
    }
};
