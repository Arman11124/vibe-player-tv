import axios from 'axios';
import { NativeModules } from 'react-native';

const { TorrentModule } = NativeModules;
const WORKER_URL = 'https://tmdb-proxy.dirtyhands-cdn-worker.workers.dev';

export interface StreamSession {
    sessionId: string;
    streamUrl: string;
    posterUrl: string;
    title: string;
}

class GatewayService {
    private engineStarted = false;

    constructor() {
        this.initEngine();
    }

    private async initEngine() {
        try {
            console.log('[Gateway] Starting Native Torrent Engine...');
            await TorrentModule.startEngine();
            this.engineStarted = true;
        } catch (e) {
            console.error('[Gateway] Failed to start engine', e);
        }
    }

    public async resolveStream(tmdbId: number, title: string, mediaType: string = 'movie'): Promise<StreamSession | null> {
        console.log(`[Gateway] Resolving stream for ID ${tmdbId} (${title}) [${mediaType}]`);

        if (!this.engineStarted) await this.initEngine();

        try {
            // Ask VPS for Magnet (It handles searching via Proxy Swarm)
            // Enhanced endpoint to support type explicitly
            const response = await axios.get(`${WORKER_URL}/play/${tmdbId}?mode=native&type=${mediaType}`, {
                timeout: 30000
            });

            console.log('[Gateway] Response Keys:', Object.keys(response.data));

            // Server might return 'magnet' or 'debug_magnet' depending on version
            let magnet = response.data.magnet || response.data.debug_magnet;

            if (magnet) {
                console.log('[Gateway] Got magnet from VPS:', response.data.fs_name);

                // INJECT TRACKERS (Iron Link - Verified 2025)
                const TRACKERS = [
                    "udp://tracker.opentrackr.org:1337/announce",
                    "udp://bt.t-ru.org:2710/announce",           // RuTracker official
                    "udp://open.stealth.si:80/announce",
                    "udp://tracker.torrent.eu.org:451/announce",
                    "udp://exodus.desync.com:6969/announce",
                    "udp://tracker.moeking.me:6969/announce",
                    "http://retracker.local/announce",
                    "http://tracker.gbitt.info:80/announce",
                    "udp://explodie.org:6969/announce",
                    "udp://tracker.tiny-vps.com:6969/announce"
                ];

                const trString = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");

                // Ensure we append correctly depending on if it has query params or not
                if (magnet.includes('?')) {
                    magnet += trString;
                } else {
                    // If it's just a hash or weird format, we might need to reconstruct, 
                    // but VPS normally returns full magnet. 
                    // Safest fallback:
                    if (magnet.startsWith('magnet:?')) {
                        magnet += trString;
                    }
                }

                console.log('[Gateway] Final Magnet for Engine:', magnet.substring(0, 100) + '...');

                // Add to Native Engine
                const { hash } = await TorrentModule.addMagnet(magnet);
                console.log(`[Gateway] Torrent Added. Hash: ${hash}`);

                // Wait for Metadata
                await this.waitForReady(hash);

                // Smart File Selection (Largest Video File)
                const files = await TorrentModule.getTorrentFiles(hash);
                let bestIndex = -1;
                let maxSize = -1;

                if (files && Array.isArray(files)) {
                    files.forEach((file: any) => {
                        const name = file.name.toLowerCase();
                        // Check for video extensions
                        if (name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.avi')) {
                            if (file.size > maxSize) {
                                maxSize = file.size;
                                bestIndex = file.index;
                            }
                        }
                    });
                }

                if (bestIndex === -1) {
                    // Fallback: If no files found via API (rare), try -1 (auto)
                    console.warn('[Gateway] No video files found in metadata, trying auto-select');
                    bestIndex = -1;
                } else {
                    console.log(`[Gateway] Selected File Index: ${bestIndex} (Size: ${(maxSize / 1024 / 1024).toFixed(2)} MB)`);
                }

                // Get Stream URL for specific file
                const url = await TorrentModule.getStreamUrl(hash, bestIndex);
                console.log(`[Gateway] Stream Ready: ${url}`);

                return {
                    sessionId: hash,
                    streamUrl: url,
                    posterUrl: response.data.posterUrl || '',
                    title: title
                };
            }

            throw new Error(response.data.error || 'No sources found');

        } catch (e: any) {
            console.error('[Gateway] Resolution failed', e.message);
            // Throw descriptive error for UI
            if (e.code === 'ECONNABORTED') throw new Error('Search Request Timed Out (VPS took too long).');
            if (e.response && e.response.status === 404) throw new Error('No Torrents Found for this title.');
            if (e.message === 'Network Error') throw new Error('Connection to VPS failed. Check Internet or Firewall.');
            throw e;
        }
    }

    private async waitForReady(hash: string): Promise<void> {
        let retries = 0;
        const maxRetries = 60; // 60s
        while (retries < maxRetries) {
            const status = await TorrentModule.getTorrentStatus(hash);
            if (status.ready) return;
            await new Promise(r => setTimeout(r, 1000));
            retries++;
        }
        throw new Error('Timeout waiting for torrent metadata');
    }
}

export default new GatewayService();
