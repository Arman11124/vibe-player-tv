#!/bin/bash
set -e

HOST="root@167.71.53.11"
DIR="/opt/torrent-gateway"

echo "🚀 Deploying Torrent Gateway to $HOST..."

# 1. Create remote directory
ssh $HOST "mkdir -p $DIR"

# 2. Upload Files (excluding node_modules)
echo "📦 Uploading source code..."
rsync -avz --exclude 'node_modules' --exclude '.git' ./ $HOST:$DIR/

# 3. Build and Run Docker
echo "🐳 Building Docker Image on Remote..."
ssh $HOST "cd $DIR && docker build -t torrent-gateway ."

echo "🔄 Restarting Container..."
ssh $HOST "docker stop torrent-gateway || true"
ssh $HOST "docker rm torrent-gateway || true"
ssh $HOST "docker run -d --restart=always --name torrent-gateway -p 3000:3000 -v /tmp/webtorrent:/tmp/webtorrent torrent-gateway"

echo "✅ Deployment Complete!"
echo "📡 Gateway is active at http://167.71.53.11:3000"
