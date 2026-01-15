"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qbit = exports.QbitClient = void 0;
const axios_1 = __importDefault(require("axios"));
class QbitClient {
    constructor(baseUrl) {
        this.sid = null;
        this.baseUrl = baseUrl;
        this.client = axios_1.default.create({
            baseURL: baseUrl,
            validateStatus: () => true // Handle errors manually
        });
    }
    async login() {
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
        }
        catch (e) {
            console.error('[Qbit] Login error', e);
            return false;
        }
    }
    async addMagnet(magnet) {
        if (!this.sid)
            await this.login();
        try {
            const form = new FormData();
            form.append('urls', magnet);
            form.append('savepath', '/downloads');
            // qBittorrent doesn't return the hash immediately on add.
            // We must parse it from the magnet or look it up.
            const exactHash = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/)?.[1]?.toLowerCase();
            if (!exactHash)
                throw new Error('Invalid magnet link');
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
        }
        catch (e) {
            console.error('[Qbit] Add error', e.message);
            throw e;
        }
    }
    async getTorrentInfo(infoHash) {
        if (!this.sid)
            await this.login();
        try {
            const res = await this.client.get('/api/v2/torrents/info', {
                params: { hashes: infoHash },
                headers: { 'Cookie': this.sid }
            });
            if (res.data && res.data.length > 0) {
                return res.data[0]; // state, progress, eta, content_path
            }
            return null;
        }
        catch (e) {
            return null;
        }
    }
    // Gets minimal info to decide if ready to play
    async getProperties(infoHash) {
        if (!this.sid)
            await this.login();
        try {
            const res = await this.client.get('/api/v2/torrents/properties', {
                params: { hash: infoHash },
                headers: { 'Cookie': this.sid }
            });
            return res.data;
        }
        catch (e) {
            return null;
        }
    }
    // List files to find the video file index/name
    async listFiles(infoHash) {
        if (!this.sid)
            await this.login();
        try {
            const res = await this.client.get('/api/v2/torrents/files', {
                params: { hash: infoHash },
                headers: { 'Cookie': this.sid }
            });
            return res.data; // [{name, size, progress, priority}]
        }
        catch (e) {
            return [];
        }
    }
}
exports.QbitClient = QbitClient;
// Singleton for easy import
exports.qbit = new QbitClient(process.env.QBIT_URL || 'http://localhost:8080');
