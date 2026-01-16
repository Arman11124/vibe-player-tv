#!/bin/bash
# IRON TUNNEL DEPLOYMENT SCRIPT (v4.2.23)
# Copy this ENTIRE content into your VPS Web Console to deploy the Vibe Gateway.

echo "🚀 Starting IRON TUNNEL Deployment..."

# 1. Setup Directories
mkdir -p /opt/torrent-gateway/src
cd /opt/torrent-gateway

# 2. Create package.json
cat > package.json << 'EOF'
{
  "name": "torrent-gateway",
  "version": "1.0.0",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "fluent-ffmpeg": "^2.1.3",
    "nodemon": "^3.0.3",
    "webtorrent": "^2.5.1"
  }
}
EOF

# 3. Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-bullseye-slim
RUN apt-get update && apt-get install -y ffmpeg python3 build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install
COPY src ./src
RUN mkdir -p /tmp/webtorrent
EXPOSE 3000
CMD ["npm", "start"]
EOF

# 4. Create TorrentEngine.js
cat > src/TorrentEngine.js << 'EOF'
import WebTorrent from 'webtorrent';
class TorrentEngine {
    constructor() { this.client = new WebTorrent(); }
    async addMagnet(magnetURI) {
        return new Promise((resolve, reject) => {
            const existing = this.client.get(magnetURI);
            if (existing) { resolve(this._format(existing)); return; }
            const torrent = this.client.add(magnetURI, { path: '/tmp/webtorrent', destroyStoreOnDestroy: true });
            torrent.on('metadata', () => resolve(this._format(torrent)));
            torrent.on('error', reject);
            setTimeout(() => reject(new Error('Timeout')), 15000);
        });
    }
    getStream(infoHash, fileIndex, range) {
        const torrent = this.client.get(infoHash);
        if (!torrent) throw new Error('Not found');
        const file = torrent.files[fileIndex];
        return { stream: file.createReadStream(range), file };
    }
    _format(t) { return { infoHash: t.infoHash, name: t.name, files: t.files.map((f, i) => ({ index: i, name: f.name, length: f.length })) }; }
}
export default new TorrentEngine();
EOF

# 5. Create index.js (WITH IRON TUNNEL PROXY)
cat > src/index.js << 'EOF'
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import TorrentEngine from './TorrentEngine.js';

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3000;
const TMDB_API_KEY = 'b93ef6c5dd891291cb040d2ffa577a7a';

// --- IRON TUNNEL: TMDB PROXY ---
app.get('/api/tmdb/*', async (req, res) => {
    try {
        const targetPath = req.path.replace('/api/tmdb', '');
        const query = req.url.split('?')[1] || '';
        const targetUrl = `https://api.themoviedb.org${targetPath}?${query}&api_key=${TMDB_API_KEY}`;
        console.log(`[Tunnel] Proxying: ${targetPath}`);
        const response = await axios.get(targetUrl, {
            headers: { 'Referer': 'https://www.themoviedb.org/' },
            validateStatus: () => true
        });
        res.status(response.status).json(response.data);
    } catch (e) {
        console.error('[Tunnel] Error:', e.message);
        res.status(502).json({ error: 'Tunnel Failure' });
    }
});

// --- IRON TUNNEL: IMAGE PROXY ---
app.get('/api/image/*', (req, res) => {
    const targetPath = req.path.replace('/api/image', '');
    const wsrvUrl = `https://wsrv.nl/?url=https://image.tmdb.org${targetPath}`;
    res.redirect(302, wsrvUrl);
});

// --- GATEWAY ROUTES ---
app.get('/health', (req, res) => res.json({ status: 'online', mode: 'IRON_TUNNEL' }));

app.post('/add', async (req, res) => {
    try {
        const info = await TorrentEngine.addMagnet(req.body.magnet);
        res.json(info);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/stream/:hash/:index', (req, res) => {
    try {
        const { hash, index } = req.params;
        const range = req.headers.range;
        const { stream, file } = TorrentEngine.getStream(hash, parseInt(index), range ? {
            start: parseInt(range.replace(/bytes=/, "").split("-")[0]),
            end: range.split("-")[1] ? parseInt(range.split("-")[1]) : undefined
        } : null);
        if (range) {
            const start = parseInt(range.replace(/bytes=/, "").split("-")[0]);
            const end = range.split("-")[1] ? parseInt(range.split("-")[1]) : file.length - 1;
            res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${file.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': (end - start) + 1, 'Content-Type': 'video/mp4' });
        } else { res.writeHead(200, { 'Content-Length': file.length, 'Content-Type': 'video/mp4' }); }
        stream.pipe(res);
    } catch (e) { if(!res.headersSent) res.status(500).end(); }
});

app.listen(PORT, () => console.log(`Gateway running on ${PORT}`));
EOF

# 6. Build and Run
echo "🐳 Building Docker Image..."
docker build -t torrent-gateway .
echo "🔄 Restarting Container..."
docker stop torrent-gateway || true
docker rm torrent-gateway || true
docker run -d --restart=always --name torrent-gateway -p 3000:3000 -v /tmp/webtorrent:/tmp/webtorrent torrent-gateway

echo "✅ IRON TUNNEL DEPLOYED! (Port 3000)"
