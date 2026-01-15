import axios from 'axios';

// The Swarm: Public CORS Proxies
// These allow us to bypass ISP blocks on specific APIs by routing traffic through different countries/servers.
const PROXIES = [
    // 1. ELITE WORKER: Our private, high-speed tunnel (Primary)
    { name: 'elite-worker', url: (target: string) => `https://tmdb-proxy.dirtyhands-cdn-worker.workers.dev/3${new URL(target).pathname}?${new URL(target).searchParams.toString()}`, weight: 1 },

    // 2. PUBLIC SWARM: Decentralized fallbacks
    { name: 'corsproxy', url: (target: string) => `https://corsproxy.io/?url=${encodeURIComponent(target)}`, weight: 2 },
    { name: 'codetabs', url: (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`, weight: 2 },
    { name: 'allorigins', url: (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`, weight: 3 },

    // 3. DIRECT: Fallback for VPN/Non-blocked regions
    { name: 'direct', url: (target: string) => target, weight: 4 }
];

// Helper to check if a URL is valid image
export const isImageUrl = (url: string) => url.match(/\.(jpeg|jpg|gif|png)$/) != null;

export class ProxyService {

    /**
     * Hydra Fetch: Tries multiple proxies with prioritized rotation.
     * Ensures we bypass regional blocks and 403 Forbidden errors.
     */
    static async fetch(targetUrl: string, options: any = {}): Promise<any> {
        let lastError = null;

        // Try ELITE WORKER first (fast/private)
        try {
            const eliteUrl = `https://tmdb-proxy.dirtyhands-cdn-worker.workers.dev/3${new URL(targetUrl).pathname}${new URL(targetUrl).search}`;
            return await axios.get(eliteUrl, { ...options, timeout: 5000 });
        } catch (e) {
            console.warn('[Proxy] Elite Worker failed, triggering Hydra Swarm...');
        }

        // Swarm Fallback
        for (const proxy of PROXIES.filter(p => p.name !== 'elite-worker')) {
            try {
                const proxyUrl = proxy.url(targetUrl);
                const response = await axios.get(proxyUrl, {
                    ...options,
                    timeout: 8000,
                    headers: {
                        ...(options.headers || {}),
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (response.status >= 200 && response.status < 300) {
                    return response;
                }
            } catch (e: any) {
                console.warn(`[Proxy] ${proxy.name} failed:`, e.message);
                lastError = e;
            }
        }
        throw lastError || new Error('All Hydra proxies failed');
    }

    /**
     * Priority 1: Elite Worker Proxy (High performance, private)
     */
    static getProxiedImageUrl(path: string): string {
        if (!path) return '';
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `https://tmdb-proxy.dirtyhands-cdn-worker.workers.dev/t/p/w500${cleanPath}`;
    }

    /**
     * Priority 2: Public Image CDN fallback (wsrv.nl)
     */
    static getFallbackImageUrl(path: string): string {
        if (!path) return '';
        const tmdbUrl = `https://image.tmdb.org/t/p/w500${path.startsWith('/') ? '' : '/'}${path}`;
        return `https://wsrv.nl/?url=${encodeURIComponent(tmdbUrl)}&w=500&output=webp`;
    }

    /**
     * Fetches TMDB API data via Hydra (High Resilience).
     * Bypasses 403 errors by rotating public/private proxies.
     */
    static async getTmdbData(
        endpoint: string,
        params: Record<string, string> = {},
        options: { apiKey?: string } = {}
    ): Promise<any> {
        const TMDB_BASE = 'https://api.themoviedb.org/3';
        const queryParams = new URLSearchParams(params);
        if (options.apiKey) queryParams.set('api_key', options.apiKey);

        const targetUrl = `${TMDB_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryParams.toString()}`;

        try {
            const response = await this.fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.themoviedb.org/',
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (e) {
            console.error('[ProxyService] Fatal: Hydra Swarm exhausted.', e);
            throw e;
        }
    }
}
