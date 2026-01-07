/**
 * ConfigService.ts
 * Zero-Cost Remote Configuration via GitHub Gist
 * Fetches app config with cache-busting and safe fallback.
 */

import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PluginEntry {
    name: string;
    js_bundle_url: string;
    active: boolean;
}

export interface AppConfig {
    is_maintenance: boolean;
    video_source_type: 'tmdb' | 'cdn' | 'hybrid';
    pirate_api_token: string;
    vibix_url?: string; // For Burn and Move (Domain Mirror)
    ad_image_url: string;
    ad_promo_text: string;
    plugins: PluginEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// GitHub Gist raw URL - timestamp cache-busting handles freshness
const CONFIG_URL =
    'https://gist.githubusercontent.com/Arman11124/39e760ddf3fe246fe29e587a5d5c6d51/raw/config.json';

/**
 * Safe Mode: Default fallback config if network fails.
 * Keeps app operational even without remote config.
 */
const DEFAULT_CONFIG: AppConfig = {
    is_maintenance: false,
    video_source_type: 'tmdb',
    pirate_api_token: '',
    ad_image_url: '',
    ad_promo_text: '',
    plugins: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// FETCH CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches remote config from GitHub Gist.
 * Appends timestamp query param to bypass CDN/browser caching.
 *
 * @returns {Promise<AppConfig>} The app configuration.
 */
export const fetchConfig = async (): Promise<AppConfig> => {
    try {
        console.log('[Config] Fetching remote config...');
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await fetch(`${CONFIG_URL}${cacheBuster}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        console.log('[Config] Loaded:', data);
        return data;
    } catch (error) {
        // Network error, timeout, or parsing error → Safe Mode
        console.error('[ConfigService] Failed to fetch config:', error);
        console.log('[ConfigService] Falling back to DEFAULT_CONFIG (Safe Mode)');
        return DEFAULT_CONFIG;
    }
}

/**
 * Shortcut to check if app is in maintenance mode.
 *
 * @returns {Promise<boolean>} True if maintenance mode is active.
 */
export async function isMaintenanceMode(): Promise<boolean> {
    const config = await fetchConfig();
    return config.is_maintenance;
}

export default {
    fetchConfig,
    isMaintenanceMode,
    DEFAULT_CONFIG,
};
