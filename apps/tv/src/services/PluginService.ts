import { AppConfig } from './ConfigService';

export interface PluginConfig {
    name: string;
    js_bundle_url: string;
    active: boolean;
}

/**
 * Feeds the plugin with metadata and tools.
 * The Remote JS must be an async IIFE or return a Promise.
 * Structure of Remote JS:
 * 
 * const { imdb_id, tmdb_id, title, year } = params;
 * const { api_token } = config;
 * const { fetch } = helpers;
 * 
 * return "https://iframe-url.com";
 */
export const executePlugin = async (
    pluginUrl: string,
    params: { imdb_id?: string; tmdb_id: number; title: string, year?: string; type: 'movie' | 'tv' },
    config: AppConfig
): Promise<string | null> => {
    try {
        if (pluginUrl === 'vibix') {
            // Built-in Vibix Handler
            console.log('[Plugin] Using built-in Vibix handler');
            const token = config.pirate_api_token;
            if (!token) throw new Error('No API Token provided in Config');

            // Try searching by IMDb first (standard)
            // If Vibix strictly needs KP ID, we might need a fallback.
            // But valid balancers usually accept imdb_id.
            // Domain is dynamic for "Burn and Move" (defined in Gist)
            const baseUrl = config.vibix_url || 'https://vibix.org';
            const url = `${baseUrl}/api/v1/search?token=${token}&imdb_id=${params.imdb_id}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data && data.data && data.data.length > 0) {
                return data.data[0].iframe_url || data.data[0].link;
            }
            return null;
        }
        // (no variable leakage, but still has global access like fetch if not shadowed)
        const runner = new Function('params', 'config', 'helpers', `
            return (async () => {
                try {
                    ${jsCode}
                } catch (e) {
                    console.error("Plugin Internal Error:", e);
                    return null;
                }
            })();
        `);

        const helpers = {
            fetch: fetch.bind(null), // Use global fetch
            log: console.log,
        };

        const result = await runner(params, config, helpers);
        console.log(`[Plugin] Result:`, result);
        return result;

    } catch (error) {
        console.warn(`[Plugin] Execution failed for ${pluginUrl}`, error);
        return null;
    }
};

// Legacy stub, can be removed or kept as a loader
export const fetchPlugins = async (): Promise<PluginConfig[]> => {
    return [];
};
