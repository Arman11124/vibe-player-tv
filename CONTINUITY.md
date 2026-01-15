# CONTINUITY LEDGER

## [2026-01-13] - EMERGENCY FIX: TMDB Cloudflare Blocking (Error 1102 & 1003)

### 🔴 The Problem
**Symptoms**:
- VibePlayer clients (APK v4.1.1) in Russia/Moscow region reported "No Content" / "Undefined Status".
- Cloudflare Worker Logs showed persistent **Error 1102** ("Worker exceeded CPU limit" - misleading) and **Error 1003** ("Direct IP Access Forbidden").
- `network_errors`: "DNS points to local or disallowed IPv6 address".

**Root Cause Diagnosis**:
1. **Regional DNS Poisoning**: In the Moscow Cloudflare region, resolving `api.themoviedb.org` returned `127.0.0.1` or `::1`. This caused the Worker to try connecting to itself, triggering the 1102 loop protection.
2. **Direct IP Blocking**: Attempting to bypass DNS by resolving the IP manually (via Google DoH) and fetching `https://<IP>/` resulted in **Error 1003** from TMDB's Cloudflare shield.
3. **External Proxy Blocks**: Trying to route via single proxies like `corsproxy.io` resulted in them blocking the Worker or being blocked by Cloudflare (Orange-to-Orange restrictions).

### 🟢 The Solution: V27 "The Proxy Swarm"
**Architecture**:
Instead of a direct connection or a single point of failure, we implemented a **Failover Proxy Swarm**. The Worker iterates through a prioritized list of public CORS proxies until one succeeds.

**The "Winning" Chain**:
1. **Primary**: `https://corsproxy.org/?<Encoded_TMDB_URL>` (Currently functional).
2. **Secondary**: `https://corsproxy.io/?url=...` (Blocked, but kept as backup).
3. **Tertiary**: `https://api.codetabs.com/v1/proxy...`
4. **Quaternary**: `https://api.allorigins.win/raw?url=...`
5. **Fallback**: Direct Connection (fails in RU, works elsewhere).

### 📝 Critical Code Pattern (Do Not change unless broken)
Located in `docs/tmdb-api-worker.js`:

```javascript
// 3. TMDB API PROXY (V27: The Proxy Swarm)
const proxies = [
    { name: 'corsproxy.org', url: `https://corsproxy.org/?${encodedUrl}` },
    { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${encodedUrl}` },
    { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}` },
    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodedUrl}` },
    { name: 'direct', url: targetUrl }
];

for (const proxy of proxies) {
    try {
        const response = await fetch(proxy.url, { ... });
        if (response.status === 200 || response.status === 401) {
            // Success! Return immediately.
            return new Response(response.body, ...);
        }
    } catch (e) {
        // Log and continue to next proxy
    }
}
```

### ⚠️ Maintenance Note
- This relies on **Public Infrastructure**. If `corsproxy.org` goes down, the worker will automatically switch to the next one, but latency may vary.
- **Verification**: If users report "No Content", check the Worker Logs. If *all* proxies fail (502), we need to add new proxy services to the list.
- **Do NOT revert to direct `fetch`** unless confirming via `curl` that `api.themoviedb.org` resolves correctly in the Moscow Data Center.

---

## [2026-01-13] - ARCHITECTURE PIVOT: The Torrent Gateway (V5 System)

### 🔴 The Problem
**Symptoms**:
-   **Persistent Crashes/Freezes**: Android TV devices (low RAM/Network) crashed immediately upon "Connecting to Peers".
-   **Root Cause**: Client-side P2P (even with 1 tracker) overwhelmed the Network Stack (UDP Flood / Binder Transaction Limit).
-   **Conclusion**: **Client-side P2P is unviable** for high-quality streaming on low-end hardware.

### 🟢 The Solution: Server-Side Gatway (Offloading)
We executed a complete architectural pivot, moving **100%** of the P2P workload to a remote server.

**Changes Implemented**:

1.  **Monorepo Restructuring**:
    -   Converted project to NPM Workspaces (`apps/tv`, `services/edge-worker`, `services/torrent-gateway`).

2.  **Client Refactor (The "Dumb" Terminal)**:
    -   **DELETED**: `MagnetService.ts` (The crash source).
    -   **ADDED**: `GatewayService.ts` (Simple HTTP Client).
    -   **UPDATED**: `PlayerScreen.tsx` (Removes source selection, directly plays stream URL).

3.  **Control Plane Upgrade (Edge Worker)**:
    -   Ported logic from `tmdb-api-worker.js` to `services/edge-worker`.
    -   The Worker now:
        1.  Accepts `/play/:id`.
        2.  Searches SolidTorrents/ApiBay internally.
        3.  Selects the **Best Source**.
        4.  Returns a **Gateway URL** to the client.

4.  **The Torrent Gateway (New Service)**:
    -   Created a Node.js + WebTorrent service (`services/torrent-gateway`).
    -   Endpoints: `/add` (Start Torrent), `/stream/:hash/:index` (Stream Video).
    -   Dockerized for VPS deployment.

### 📝 Next Steps (Immediate)
1.  **Deploy Gateway**: The deployment script (`./services/torrent-gateway/deploy.sh`) exists but requires SSH authentication to `167.71.53.11`.
2.  **Verify Flow**: Once the Gateway is up, the Client -> Worker -> Gateway chain should result in instant, crash-free playback.


## [2026-01-14] - DEPLOYMENT SUCCESS: Self-Hosted Production

### 🟢 Status: MVP Deployed & Verified
The "Server-Side Gateway" pivot is now fully operational in production.

### **Infrastructure Stats**:
*   **VPS**: DigitalOcean Droplet (`167.99.201.47`, London, 1GB RAM)
*   **Security**: UFW enabled (Ports 22, 3000, 6881, 8080 open). Root/qBit passwords secured.
*   **Services**:
    *   **Control Plane (Worker)**: `services/edge-worker` (Routes `/play/:id` -> Gateway).
    *   **Torrent Engine (VPS)**: `docker compose` stack with `qbittorrent` + `torrent-gateway`.

### **Operational Workflow**:
1.  **TV App** requests `api.worker/play/{tmdb_id}`.
2.  **Worker** finds magnet link and POSTs to `http://167.99.201.47:3000/add`.
3.  **Gateway** adds magnet to qBittorrent via internal Docker network (`http://qbittorrent:8080`).
4.  **Worker** returns stream URL: `http://167.99.201.47:3000/stream/{hash}/{file_index}`.
5.  **TV App** plays stream directly via ExoPlayer/VLC.

### ⚠️ Maintenance & "Nuclear Options"
*   **If VPS IP is Banned**:
    1.  Destroy Droplet & Create New.
    2.  Manual SSH + Paste Payload (See `artifacts/manual_setup_vps.sh`).
    3.  Update Worker Secret: `npx wrangler secret put GATEWAY_ORIGIN`.
*   **If Logs Needed**:
    *   `ssh root@167.99.201.47`
    *   `cd /opt/ott-gateway/infra && docker compose logs -f gateway`

---

## [2026-01-14] - ARCHITECTURE PIVOT II: Project Zero-Cost (Native P2P)

### 🔴 The Problem
**Feedback**:
-   **Cost/Scalability**: The VPS Gateway ($5/mo, 10-50 simultaneous users limit) is incompatible with the goal of 100k users.
-   **Concept Mismatch**: User expected P2P distribution, not central hosting.
-   **APK Issues**: "APK download issues" reported (though `curl` verified 200 OK).

### 🟢 The Solution: Embedded Native Engine (V6)
We are moving to **Architecture V6**: Running `libtorrent` (C++) directly on the Android device via JNI/Native Modules.

**Why this works (vs V1 JS P2P)**:
1.  **Efficiency**: C++ `libtorrent` is orders of magnitude more efficient than `webtorrent-hybrid` (Node/JS) or `react-native-webtorrent`.
2.  **Stability**: Used by major Android torrent clients (LibreTorrent, Zona).
3.  **Cost**: $0 operational cost. User hardware carries the load.

**Implementation Vectors**:
-   **Library**: `libtorrent4j` (proven JNI wrapper).
-   **Mechanism**:
    1.  React Native calls `NativeModules.Torrent.start(magnet)`.
    2.  Java Layer spins up `libtorrent` session.
    3.  Java Layer starts a micro HTTP server (`AsyncHttpServer`).
    4.  Java Layer returns `http://127.0.0.1:port/stream` to JS.
    5.  ExoPlayer plays the local stream.

### 📝 Next Steps
1.  Add `libtorrent4j` to Gradle.
2.  Implement `TorrentModule.java`.
3.  Bridge to React Native.