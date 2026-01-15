# OttBrowser (VibePlayer) Monorepo

Welcome to the **VibePlayer** Project.
**Current Status:** Pivoting to **Architecture V6 (Native P2P)**.

## 🏗 Architecture Goals (Project Zero-Cost)

The goal is to run a full BitTorrent engine directly on Android TV devices, removing the need for a central Gateway server.

### 1. `apps/tv` (The Smart Client)
-   **Stack:** React Native + **Native Modules (Java/C++)**.
-   **Engine:** `libtorrent4j` (JNI wrapper for libtorrent).
-   **Role:** 
    -   Downloads torrent contents directly to RAM/Disk using C++ native code.
    -   Runs an internal HTTP server (`127.0.0.1`) to stream video to ExoPlayer.
    -   **Zero Cost:** No extensive server infrastructure required.

### 2. `services/edge-worker` (The Indexer)
-   **Role:** Resolves magnets and metadata only. No heavy traffic.

### 3. `services/torrent-gateway` (Deprecated)
-   **Status:** Archived (v4.1.3).
-   **Reason:** High operational cost ($) and lack of scalability for 100k users.

## 🚀 Getting Started

### Prerequisites
-   Node.js 18+
-   Android Studio & NDK (Side-by-side)
-   JDK 17

### Commands
```bash
npm install
npm run tv
```

## 📜 History
See `CONTINUITY.md` for the evolution from Client-JS P2P -> Gateway VPS -> Native C++ P2P.
