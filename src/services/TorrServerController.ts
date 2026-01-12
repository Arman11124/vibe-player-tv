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

    // Config: 32MB Cache to prevent OOM on legacy devices
    // 20% Read Ahead
    private readonly DEFAULT_SETTINGS = {
        cache_size: 32 * 1024 * 1024,
        reader_read_ahead: 20,
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
            // Adaptive cache based on device RAM
            let cacheSize = 32 * 1024 * 1024; // Default: 32MB (safe fallback)

            try {
                // Try to get device memory if react-native-device-info is available
                const DeviceInfo = require('react-native-device-info');
                const totalMemoryBytes = await DeviceInfo.getTotalMemory();
                const totalMemoryMB = totalMemoryBytes / (1024 * 1024);

                if (totalMemoryMB < 1500) {
                    // Weak devices (1GB RAM): conservative cache
                    cacheSize = 64 * 1024 * 1024; // 64MB
                    console.log(`[TorrCtrl] Low RAM device (${Math.round(totalMemoryMB)}MB), using 64MB cache`);
                } else {
                    // Normal devices (2GB+): aggressive cache
                    cacheSize = 200 * 1024 * 1024; // 200MB
                    console.log(`[TorrCtrl] Normal RAM device (${Math.round(totalMemoryMB)}MB), using 200MB cache`);
                }
            } catch (deviceInfoError) {
                // react-native-device-info not installed, use safe default
                console.log('[TorrCtrl] DeviceInfo not available, using 32MB default cache');
            }

            await axios.post(`${TORR_API}/settings`, {
                cache_size: cacheSize,
                reader_read_ahead: 20,
                use_disk: false
            });
            console.log(`[TorrCtrl] Settings applied (${cacheSize / 1024 / 1024}MB RAM Cache)`);
        } catch (e) {
            console.warn('[TorrCtrl] Failed to apply settings', e);
        }
    }

    /**
     * Step 1: Add Magnet to Engine
     */
    public async addMagnet(magnetLink: string): Promise<string> {
        if (!this.isRunning) await this.init();
        const addRes = await axios.post(`${TORR_API}/torrents/add`, { link: magnetLink });
        const hash = addRes.data.hash;
        if (!hash) throw new Error('No hash returned');
        return hash;
    }

    /**
     * Step 2: Poll for Metadata (File List)
     */
    public async getFiles(hash: string): Promise<any[]> {
        // MatriX.125 on legacy devices needs TIME.
        // 40 attempts * 1s = 40 seconds max wait.
        for (let i = 0; i < 40; i++) {
            try {
                const torRes = await axios.get(`${TORR_API}/torrents/view?hash=${hash}`, { timeout: 3000 });
                // Robust check for different API versions (MatriX 126 vs 137)
                const data = torRes.data;
                if (data) {
                    if (data.file_stats && data.file_stats.length > 0) return data.file_stats;
                    if (data.Files && data.Files.length > 0) return data.Files; // Legacy casing?
                    if (Array.isArray(data) && data.length > 0) return data; // Raw array?
                }
            } catch (e) {
                // Ignore transient errors during init
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        return [];
    }

    /**
     * Step 3: Get Stream URL for specific file
     */
    public getStreamUrl(hash: string, fileIdx: number): string {
        return `${TORR_API}/stream/${encodeURIComponent(hash)}?index=${fileIdx}&play`;
    }

    /**
     * Legacy: Auto-plays largest file
     */
    public async playMagnet(magnetLink: string): Promise<string | null> {
        try {
            const hash = await this.addMagnet(magnetLink);
            const files = await this.getFiles(hash);

            if (files.length === 0) return null;

            // Find largest file
            let maxIdx = 0;
            let maxSize = 0;
            files.forEach((f: any, idx: number) => {
                if (f.length > maxSize) {
                    maxSize = f.length;
                    maxIdx = idx;
                }
            });

            return this.getStreamUrl(hash, maxIdx);
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
