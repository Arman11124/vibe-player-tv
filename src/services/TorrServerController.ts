import { NativeModules } from 'react-native';
import axios from 'axios';

const { TorrServerModule } = NativeModules;
const TORR_API = 'http://127.0.0.1:8090';

export interface TorrentStats {
    hash: string;
    title: string;
    download_speed: number; // Bytes/sec
    upload_speed: number;
    total_peers: number;
    active_peers: number;
    status: string; // "Downloading", "Seeding", null
}

class TorrServerController {
    private static instance: TorrServerController;
    private isRunning = false;
    private checkInterval: NodeJS.Timeout | null = null;

    // Config: 200MB Cache for RAM (Don't kill the TV)
    // 95% Read Ahead to prioritize playback
    private readonly DEFAULT_SETTINGS = {
        cache_size: 200 * 1024 * 1024,
        reader_read_ahead: 95,
        use_disk: false
    };

    public static getInstance(): TorrServerController {
        if (!TorrServerController.instance) {
            TorrServerController.instance = new TorrServerController();
        }
        return TorrServerController.instance;
    }

    /**
     * Wakes up the native daemon and waits for HTTP 200 OK
     */
    public async init() {
        console.log('[TorrCtrl] Initializing...');

        // 1. Kick native service
        TorrServerModule.start();

        // 2. Poll until alive (max 10 attempts)
        let attempts = 0;
        while (attempts < 10) {
            const alive = await this.checkHealth();
            if (alive) {
                console.log('[TorrCtrl] Daemon is ALIVE');
                this.isRunning = true;
                this.applySettings();
                return;
            }
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
            if (attempts % 3 === 0) TorrServerModule.start(); // Kick again
        }

        console.error('[TorrCtrl] Failed to start daemon after 10s');
        throw new Error('TorrServer failed to start. Please check permissions or device compatibility.');
    }

    public async checkHealth(): Promise<boolean> {
        try {
            const res = await axios.get(`${TORR_API}/echo`, { timeout: 1000 });
            return res.status === 200;
        } catch (e) {
            return false;
        }
    }

    private async applySettings() {
        try {
            await axios.post(`${TORR_API}/settings`, this.DEFAULT_SETTINGS);
            console.log('[TorrCtrl] Settings applied (RAM Cache)');
        } catch (e) {
            console.warn('[TorrCtrl] Failed to apply settings', e);
        }
    }

    /**
     * Adds a magnet links and returns the playback URL for the largest file
     */
    public async playMagnet(magnetLink: string): Promise<string | null> {
        if (!this.isRunning) await this.init();

        try {
            // 1. Add Torrent
            // Endpoint: /torrents/add {"link": "magnet:..."}
            const addRes = await axios.post(`${TORR_API}/torrents/add`, { link: magnetLink });
            const hash = addRes.data.hash;

            if (!hash) throw new Error('No hash returned');

            // 2. Get File List to find the main movie file
            // We need to wait a bit for metadata if it's a cold magnet, 
            // but TorrServer usually returns hash immediately and fetches meta in background.
            // For playback, we can use the "autoplay" feature or list files.

            // Wait for metadata (simple poll)
            let files = [];
            for (let i = 0; i < 10; i++) {
                const torRes = await axios.get(`${TORR_API}/torrents/view?hash=${hash}`);
                if (torRes.data && torRes.data.file_stats && torRes.data.file_stats.length > 0) {
                    files = torRes.data.file_stats;
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            if (files.length === 0) return null;

            // 3. Find largest file (usually the movie)
            let maxIdx = 0;
            let maxSize = 0;
            files.forEach((f: any, idx: number) => {
                if (f.length > maxSize) {
                    maxSize = f.length;
                    maxIdx = idx;
                }
            });

            // 4. Construct Stream URL
            // http://127.0.0.1:8090/stream/{hash}?index={id}&play
            const streamUrl = `${TORR_API}/stream/${encodeURIComponent(hash)}?index=${maxIdx}&play`;
            console.log('[TorrCtrl] Ready to stream:', streamUrl);

            return streamUrl;

        } catch (e) {
            console.error('[TorrCtrl] Play Error', e);
            return null;
        }
    }

    public async dropAll() {
        try {
            // Drop all torrents to free up RAM/Network
            // Newer TorrServer API might use /torrents/action with "action": "drop"
            // But usually just stopping the playback or session is enough.
            // For now, valid MatriX command:
            const list = await axios.get(`${TORR_API}/torrents/list`);
            if (list.data && Array.isArray(list.data)) {
                for (const t of list.data) {
                    await axios.post(`${TORR_API}/torrents/action`, { action: "drop", hash: t.hash });
                }
            }
            console.log('[TorrCtrl] Dropped all torrents');
        } catch (e) {
            console.warn('[TorrCtrl] Drop failed', e);
        }
    }
}

export default TorrServerController.getInstance();
