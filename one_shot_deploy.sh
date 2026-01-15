#!/bin/bash

IP="209.97.182.128"
USER="root"
TARGET_DIR="/opt/ott-gateway"

echo "============================================"
echo "🚀 Deploying OTT Gateway to $IP"
echo "You will be asked for the password 3 times."
echo "Password: Docker!2026Serverx"
echo "============================================"

echo ""
echo "--- [1/3] Packing Files Locally ---"
# Create a single archive to minimize connections
tar -czf gateway_payload.tar.gz services/torrent-gateway infra/docker-compose.gateway.yml

echo ""
echo "--- [2/3] Uploading Payload (Single Connection) ---"
# Uploading one file is much safer against rate limits
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null gateway_payload.tar.gz $USER@$IP:/tmp/gateway_payload.tar.gz

echo ""
echo "--- [3/3] unpacking & Launching ---"
# Single command to unpack and run
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $USER@$IP "
    mkdir -p $TARGET_DIR
    tar -xzf /tmp/gateway_payload.tar.gz -C $TARGET_DIR
    cd $TARGET_DIR/infra
    docker compose -f docker-compose.gateway.yml up -d --build
"
# Clean up local file
rm gateway_payload.tar.gz

echo ""
echo "✅ Deployment Complete!"
echo "Verify functionality: http://$IP:3000/health"
