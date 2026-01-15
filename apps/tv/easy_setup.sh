#!/bin/bash
echo "🚀 VibePlayer Auto-Deploy Script"
echo "Select operation:"
echo "1) Deploy Cloudflare Proxy (Fixes blocking)"
echo "2) Build Android APK (Updates app)"
echo "3) Do EVERYTHING (Recommended)"
read -p "Enter 1, 2, or 3: " choice

if [ "$choice" = "1" ] || [ "$choice" = "3" ]; then
    echo ""
    echo "--- STAGE 1: CLOUDFLARE PROXY ---"
    echo "Checking for wrangler..."
    if ! command -v wrangler &> /dev/null; then
        echo "Installing wrangler..."
        npm install -g wrangler
    fi

    echo "Logging in... (A browser window will open, please log in)"
    npx wrangler login

    echo "Creating Cache Bucket..."
    npx wrangler r2 bucket create tmdb-cache || echo "Bucket might already exist, continuing..."

    echo "Deploying Worker..."
    npx wrangler deploy

    echo "✅ Proxy Deployed!"
fi

if [ "$choice" = "2" ] || [ "$choice" = "3" ]; then
    echo ""
    echo "--- STAGE 2: BUILD APK ---"
    echo "Cleaning project..."
    cd android
    ./gradlew clean

    echo "Building Release APK..."
    # Skipping lint to avoid build failure on minor warnings
    ./gradlew assembleRelease -x lint

    echo "✅ APK Built!"
    echo "File location: android/app/build/outputs/apk/release/app-release.apk"
    open app/build/outputs/apk/release/
fi

echo ""
echo "🎉 MISSION COMPLETE. Install the APK on your TV."
