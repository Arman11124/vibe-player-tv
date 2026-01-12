/**
 * ConfigService.ts
 * Zero-Cost Remote Configuration via GitHub Gist
 * Supports "Camouflaged" Base64 config for anti-censorship.
 */

import { Base64 } from 'js-base64';

export interface PluginEntry {
    name: string;
    js_bundle_url: string;
    active: boolean;
}

export interface AppConfig {
    maintenance: boolean;
    parser_url: string; // JacRed / Prowlarr URL
    proxy_url?: string; // SOCKS5 for TorrServer
    tmdb_key?: string;
    banner_img?: string;
    plugins: PluginEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Raw link to the latest file in the Gist (auto-redirects to current filename)
const GIST_ID = '39e760ddf3fe246fe29e587a5d5c6d51';
const RAW_URL = `https://gist.githubusercontent.com/Arman11124/${GIST_ID}/raw`;

const DEFAULT_CONFIG: AppConfig = {
    maintenance: false,
    parser_url: 'https://api.xn--b1a5a.fun', // Worker Proxy (Reliable)
    plugins: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIC
// ─────────────────────────────────────────────────────────────────────────────

export const fetchConfig = async (): Promise<AppConfig> => {
    try {
        console.log('[Config] Fetching remote Gist...');
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await fetch(`${RAW_URL}${cacheBuster}`);

        if (!response.ok) throw new Error('Network response was not ok');

        const text = await response.text();
        let data: any;

        try {
            // 1. Try JSON Parse first (Legacy Mode)
            data = JSON.parse(text);
            console.log('[Config] Loaded JSON (Legacy)');
        } catch (e) {
            // 2. Try Base64 Decode (Camouflage Mode)
            try {
                const decoded = Base64.decode(text);
                data = JSON.parse(decoded);
                console.log('[Config] Loaded Encoded (Camouflage)');
            } catch (err) {
                console.error('[Config] Failed to decode config', err);
                return DEFAULT_CONFIG;
            }
        }

        const combined = { ...DEFAULT_CONFIG, ...data };

        // CORRECTION: UNCONDITIONAL FORCE (Debug Mode)
        // We suspect Gist might return other blocked URLs
        console.log('[Config] FORCING Worker Proxy');
        combined.parser_url = DEFAULT_CONFIG.parser_url;

        return combined;
    } catch (error) {
        console.error('[Config] Fetch failed', error);
        return DEFAULT_CONFIG;
    }
}

export default { fetchConfig };
