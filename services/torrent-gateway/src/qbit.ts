import axios, { AxiosInstance } from 'axios';

export class QbitClient {
    private client: AxiosInstance;
    private baseUrl: string;
    private sid: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.client = axios.create({
            baseURL: baseUrl,
            validateStatus: () => true // Handle errors manually
        });
    }

    async login(): Promise<boolean> {
        try {
            // Default credential for linuxserver image is admin:adminadmin
            // In prod, these should be env vars
            const username = process.env.QBIT_USER || 'admin';
            const password = process.env.QBIT_PASS || 'adminadmin';

            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);

            const res = await this.client.post('/api/v2/auth/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (res.status === 200 && res.headers['set-cookie']) {
                // Extract SID
                const cookies = res.headers['set-cookie'];
                const sidCookie = cookies.find(c => c.includes('SID='));
                if (sidCookie) {
                    this.sid = sidCookie.split(';')[0];
                    console.log('[Qbit] Login successful');
                    return true;
                }
            }
            console.error('[Qbit] Login failed', res.status, res.data);
            return false;
        } catch (e) {
            console.error('[Qbit] Login error', e);
            return false;
        }
    }

    async addMagnet(magnet: string): Promise<{ infoHash: string, status: string }> {
        if (!this.sid) await this.login();

        try {
            const form = new FormData();
            form.append('urls', magnet);
            form.append('savepath', '/downloads');

            // qBittorrent doesn't return the hash immediately on add.
            // We must parse it from the magnet or look it up.
            const exactHash = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/)?.[1]?.toLowerCase();
            if (!exactHash) throw new Error('Invalid magnet link');

            const res = await this.client.post('/api/v2/torrents/add', `urls=${encodeURIComponent(magnet)}&savepath=/downloads`, {
                headers: {
                    'Cookie': this.sid,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (res.status === 200) {
                return { infoHash: exactHash, status: 'added' };
            }
            throw new Error(`Add failed: ${res.status}`);
        } catch (e: any) {
            console.error('[Qbit] Add error', e.message);
            throw e;
        }
    }

    // Poll until metadata is available (critical for "No Source Found" fix)
    async waitForMetadata(hash: string, timeoutMs: number = 30000): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const info = await this.getTorrentInfo(hash);
                // Check if specific metadata is critical (files populated)
                if (info && (info.state === 'downloading' || info.state === 'stalledDL' || info.progress > 0)) {
                    // Double check if files exist
                    const files = await this.listFiles(hash);
                    if (files && files.length > 0) return true;
                }
            } catch (e) {
                // Ignore errors during poll
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        return false;
    }

    async getTorrentInfo(infoHash: string) {
        if (!this.sid) await this.login();

        try {
            const res = await this.client.get('/api/v2/torrents/info', {
                params: { hashes: infoHash },
                headers: { 'Cookie': this.sid }
            });

            if (res.data && res.data.length > 0) {
                return res.data[0]; // state, progress, eta, content_path
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // Gets minimal info to decide if ready to play
    async getProperties(infoHash: string) {
        if (!this.sid) await this.login();
        try {
            const res = await this.client.get('/api/v2/torrents/properties', {
                params: { hash: infoHash },
                headers: { 'Cookie': this.sid }
            });
            return res.data;
        } catch (e) { return null; }
    }

    // List files to find the video file index/name
    async listFiles(infoHash: string) {
        if (!this.sid) await this.login();
        try {
            const res = await this.client.get('/api/v2/torrents/files', {
                params: { hash: infoHash },
                headers: { 'Cookie': this.sid }
            });
            return res.data; // [{name, size, progress, priority}]
        } catch (e) { return []; }
    }
    async getTorrents(): Promise<any[]> {
        if (!this.sid) await this.login();
        try {
            const res = await this.client.get('/api/v2/torrents/info', {
                headers: { 'Cookie': this.sid }
            });
            return res.data || [];
        } catch (e) { return []; }
    }

    async deleteTorrent(hash: string): Promise<boolean> {
        if (!this.sid) await this.login();
        try {
            // deleteFiles=true to clean up disk
            const res = await this.client.post('/api/v2/torrents/delete', `hashes=${hash}&deleteFiles=true`, {
                headers: {
                    'Cookie': this.sid,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return res.status === 200;
        } catch (e) { return false; }
    }
}

// Singleton for easy import
export const qbit = new QbitClient(process.env.QBIT_URL || 'http://localhost:8080');
