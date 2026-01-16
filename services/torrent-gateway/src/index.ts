import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { qbit } from './qbit';
import { fileServer } from './file-server';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// IRON TUNNEL: BYPASS CLIENT IPS BLOCKS VIA VPS
// ═══════════════════════════════════════════════════════════════
import axios from 'axios';

const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a';

// 1. API PROXY
app.get('/api/tmdb/*', async (req, res) => {
    try {
        // Strip '/api/tmdb' to get the real path (e.g., /3/movie/popular)
        const targetPath = req.path.replace('/api/tmdb', '');
        const query = req.url.split('?')[1] || '';
        const targetUrl = `https://api.themoviedb.org${targetPath}?${query}&api_key=${TMDB_API_KEY}`;

        console.log(`[Tunnel] Proxying: ${targetPath}`);

        const response = await axios.get(targetUrl, {
            headers: { 'Referer': 'https://www.themoviedb.org/' },
            validateStatus: () => true // Pass through errors
        });

        res.status(response.status).json(response.data);
    } catch (e: any) {
        console.error('[Tunnel] API Error:', e.message);
        res.status(502).json({ error: 'Tunnel Failure' });
    }
});

// 2. IMAGE PROXY (Redirect to wsrv.nl to save VPS bandwidth)
app.get('/api/image/*', (req, res) => {
    const targetPath = req.path.replace('/api/image', '');
    const tmdbImage = `https://image.tmdb.org${targetPath}`;
    const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(tmdbImage)}`;
    res.redirect(302, wsrvUrl);
});
// ═══════════════════════════════════════════════════════════════

// Routes
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'torrent-gateway',
        qbit_url: process.env.QBIT_URL || 'not_configured'
    });
});

app.post('/add', async (req, res) => {
    try {
        const { magnet } = req.body;
        if (!magnet) {
            res.status(400).json({ error: 'magnet required' });
            return;
        }

        // 1. Add Magnet
        const result = await qbit.addMagnet(magnet);

        // 2. Extract Hash to poll
        // Try to parse from magnet (xt=urn:btih:HASH)
        const hashMatch = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
        if (hashMatch && hashMatch[1]) {
            const hash = hashMatch[1].toLowerCase();
            console.log(`[Gateway] Polling metadata for ${hash}...`);

            // 3. Wait for Metadata (Max 20s)
            const ready = await qbit.waitForMetadata(hash, 20000);
            if (!ready) {
                console.warn(`[Gateway] Timeout waiting for metadata: ${hash}`);
                // We still return true, client might retry or hls might handle it
            } else {
                console.log(`[Gateway] Metadata ready for ${hash}`);
            }
        }

        res.json(result);
    } catch (e: any) {
        console.error("Add Error", e);
        res.status(500).json({ error: e.message });
    }
});

// DEBUG ENDPOINT (User Protocol)
app.get('/debug/session/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const info = await qbit.getTorrentInfo(hash);
        const files = await qbit.listFiles(hash);

        res.json({
            hash,
            isInQbit: !!info,
            state: info ? info.state : 'not_found',
            progress: info ? info.progress : 0,
            filesCount: files.length,
            firstFile: files[0] ? files[0].name : null,
            totalSize: info ? info.size : 0,
            hasMetadata: files.length > 0 && info && info.state !== 'metaDL'
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/session/:hash/status', async (req, res) => {
    try {
        const { hash } = req.params;
        const info = await qbit.getTorrentInfo(hash);
        if (!info) {
            res.status(404).json({ error: 'not_found' });
            return;
        }

        // Find main video file
        const files = await qbit.listFiles(hash);
        // Sort by size desc
        const mainFile = files.sort((a: any, b: any) => b.size - a.size)[0];

        res.json({
            hash,
            state: info.state,
            progress: info.progress,
            ready: info.progress > 0.05 || info.state === 'downloading' || info.state === 'stalledDL', // Soft ready check
            file: mainFile ? { name: mainFile.name, progress: mainFile.progress } : null
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/stream/:hash/:fileIndex', async (req, res) => {
    try {
        const { hash, fileIndex } = req.params;
        const idx = parseInt(fileIndex);

        // 1. Get file path from qBit
        const files = await qbit.listFiles(hash);
        if (!files || !files[idx]) {
            res.status(404).send('File index not found');
            return;
        }

        const targetFile = files[idx];
        // targetFile.name is normally the relative path inside downloads (e.g. "Folder/file.mp4")

        // 2. Serve
        await fileServer.serveFile(req, res, targetFile.name);

    } catch (e: any) {
        console.error('Stream error:', e);
        res.status(500).send('Stream error');
    }
});

app.listen(PORT, () => {
    console.log(`[Gateway] Running on port ${PORT}`);
    // Attempt initial login
    qbit.login().then(ok => {
        if (ok) console.log('[Gateway] Connected to qBittorrent');
        else console.warn('[Gateway] Could not connect to qBittorrent (Is Docker running?)');
    });
});
