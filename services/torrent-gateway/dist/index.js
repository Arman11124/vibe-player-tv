"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const qbit_1 = require("./qbit");
const file_server_1 = require("./file-server");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
        const result = await qbit_1.qbit.addMagnet(magnet);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/session/:hash/status', async (req, res) => {
    try {
        const { hash } = req.params;
        const info = await qbit_1.qbit.getTorrentInfo(hash);
        if (!info) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        // Find main video file
        const files = await qbit_1.qbit.listFiles(hash);
        // Sort by size desc
        const mainFile = files.sort((a, b) => b.size - a.size)[0];
        res.json({
            hash,
            state: info.state,
            progress: info.progress,
            ready: info.progress > 0.05 || info.state === 'downloading' || info.state === 'stalledDL', // Soft ready check
            file: mainFile ? { name: mainFile.name, progress: mainFile.progress } : null
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/stream/:hash/:fileIndex', async (req, res) => {
    try {
        const { hash, fileIndex } = req.params;
        const idx = parseInt(fileIndex);
        // 1. Get file path from qBit
        const files = await qbit_1.qbit.listFiles(hash);
        if (!files || !files[idx]) {
            res.status(404).send('File index not found');
            return;
        }
        const targetFile = files[idx];
        // targetFile.name is normally the relative path inside downloads (e.g. "Folder/file.mp4")
        // 2. Serve
        await file_server_1.fileServer.serveFile(req, res, targetFile.name);
    }
    catch (e) {
        console.error('Stream error:', e);
        res.status(500).send('Stream error');
    }
});
app.listen(PORT, () => {
    console.log(`[Gateway] Running on port ${PORT}`);
    // Attempt initial login
    qbit_1.qbit.login().then(ok => {
        if (ok)
            console.log('[Gateway] Connected to qBittorrent');
        else
            console.warn('[Gateway] Could not connect to qBittorrent (Is Docker running?)');
    });
});
