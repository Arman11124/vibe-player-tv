#!/bin/bash
set -e
echo ">>> FIXING DOWNLOAD HEADERS FOR TV <<<"

# 1. СЕРВЕР НА ПОРТУ 80 (v3 - Force Download)
cat > /root/tmdb-proxy/index.js <<EOF
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(cors());

// ЛЕНДИНГ (С авто-скачиванием)
app.get('/', (req, res) => {
    res.send(\`
        <html>
        <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
            <h1>Vibe Installer</h1>
            <br>
            <div style="padding: 20px;">
                <a href="/vibe.apk" style="display:inline-block; padding:40px 80px; background:#2563eb; color:white; text-decoration:none; font-size:40px; border-radius:30px; border: 4px solid white; font-weight:bold;">
                    DOWNLOAD APK
                </a>
            </div>
            <p style="color: #666; margin-top: 30px;">Direct VPS Link (Port 80)</p>
            
            <script>
                // Попытка авто-скачивания через 3 секунды
                setTimeout(function() {
                    window.location.href = "/vibe.apk";
                }, 3000);
            </script>
        </body>
        </html>
    \`);
});

// ФАЙЛ (Правильные заголовки для Android)
app.get('/vibe.apk', (req, res) => {
    const file = path.join(__dirname, 'vibe.apk');
    if (fs.existsSync(file)) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="vibe.apk"');
        res.download(file, 'vibe.apk');
    } else {
        res.status(404).send('APK Missing on Server');
    }
});

// ПРОКСИ (API)
app.use('/3', createProxyMiddleware({ target: 'https://api.themoviedb.org', changeOrigin: true, pathRewrite: { '^/': '/3/' } }));
app.use('/t/p', createProxyMiddleware({ target: 'https://image.tmdb.org', changeOrigin: true, pathRewrite: { '^/': '/t/p/' } }));

app.listen(80, '0.0.0.0', () => console.log('VPS Active'));
EOF

# 2. Перезапуск
pm2 restart tmdb-proxy
echo "FIX APPLIED. TRY DOWNLOADING NOW."
