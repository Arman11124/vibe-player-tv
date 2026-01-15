# AndroidTV Torrent Streaming MVP

## Goals
- **Primary:** Stable playback on weak Android TV devices by offloading P2P.
- **Secondary:** Cheap infrastructure, future-proof for SSAI.
- **Architecture:** React Native (TV) -> Cloudflare Worker (Control) -> Torrent Gateway (Docker) -> Torrent Network.

## Work Checklist

### Phase 1: Analysis & Setup
- [x] **T001**: Scan Repository & Analyze Crash Points
    - [x] Analyze `package.json` (Dependencies)
    - [x] Analyze `MagnetService.ts` (Legacy P2P Logic)
    - [x] Locate Video Player component
    - [x] Document crash points (Tracker Flood confirmed in V54)
- [ ] **T002**: Monorepo Structure Setup
    - [ ] Create `apps/tv` (Move current RN app)
    - [ ] Create `services/torrent-gateway` (New Docker service)
    - [ ] Create `services/edge-worker` (Move Worker)
    - [ ] Create `packages/shared`
    - [ ] Configure ESLint/Prettier

### Phase 2: Cloudflare Worker (Control Plane)
- [ ] **T003**: Worker Endpoints & Caching
    - [ ] `/catalog`: Proxy TMDB/Simkl
    - [ ] `/title/:id`: Metadata
    - [ ] `/play/:id`: Redirect to Gateway/R2
    - [ ] `/poster-proxy`: Image caching
- [ ] **T004**: R2 Integration
    - [ ] Signed URLs for protection
    - [ ] Cache-Control logic

### Phase 3: Torrent Gateway (The Engine)
- [ ] **T005**: Gateway Core (Docker/Node/Go)
    - [ ] API: `/resolve`, `/session/create`
    - [ ] Stream: `/session/:id/manifest.m3u8`
    - [ ] Engine: Torrent client with "Fast Start" priority
- [ ] **T006**: Storage Mode
    - [ ] MVP: Direct Stream (RAM/Disk buffer)
    - [ ] Warm Cache: Upload manifest + first N chunks to R2

### Phase 4: Android TV App (Client)
- [ ] **T007**: Refactor Client
    - [ ] **REMOVE** P2P/DHT logic from App
    - [ ] Implement ExoPlayer/Media3 (HLS source)
    - [ ] Error Screens (Graceful handling)
- [ ] **T008**: Audio Ducking (Ads)
    - [ ] Ad Logic Timer
    - [ ] Audio Focus Management

### Phase 5: Observability & CI/CD
- [ ] **T009**: Logs & Metrics
    - [ ] Gateway buffer health
    - [ ] Crash reporting
- [x] **T010**: Deploy to Self-Hosted VPS
    - [x] Provision Docker Droplet (IP: `167.99.201.47`)
    - [x] Deploy Gateway Service & qBittorrent via manual script
    - [x] Configure Cloudflare Worker `GATEWAY_ORIGIN` secret

### Phase- [x] **T015: Implement "Scoped Storage" (Friend's Advice)**
    - [x] Replace `Environment.getExternalStoragePublicDirectory` with `reactContext.getExternalFilesDir(null)`.
    - [x] Verify paths in logcat.

### Phase 6: Optimization (Friend's Advice) <!-- id: 2800 -->
**Goal:** Tuning for low-end hardware.
- [ ] [T016] **Optimization Phase** `(Low-End Device Tuning)`
    - [x] Tune `settings_pack` (active_downloads=1, connections_limit=30, dht=on, lsd/upnp=off)
    - [x] **Scoped Storage** (Fixed Android 10+ permission issues & removed Manifest permissions)
    - [x] **Fix 3 Fatal Errors**: Strict URL (`/stream/<hash>`), Strict File Resolve, Real Status Check.
    - [x] **Activate Brain**: `setPieceDeadline` logic with immediate/prefetch priorities & limits.
    - [x] **Stability Profile**: Restricted Network Security Config (localhost only), tuned low-end engine.
    - [x] **Network & Security**: Bind `127.0.0.1` only, Token Auth (`?t=uuid`), Cleartext blocked globally.
    - [x] **Advanced HTTP Server**: `Retry-After` (503) for missing pieces, Smart MIME types (.mkv/.mp4).
    - [x] **Smart Status**: `getTorrentStatus` checks metadata + first pieces for "Ready" state.
    - [x] **Strict File Selection**: `getTorrentFiles` API + `/stream/<hash>/<index>` URL support.
    - [x] **The Pulse**: `setPulse(hash, index, bytePos)` implemented for proactive seeking/buffering.
- [x] **T017**: [Step 7] Advanced Optimizations Complete

## **Status**
**Phase 5 COMPLETE.** Native P2P compilation and basic HTTP server are working.
**Phase 6 (Optimization) COMPLETE.**
- **Step 1-7**: Full Optimization Suite (Storage, Tuning, Buffering, Strict Files, Pulse).
- **Ready for**: UI Integration (Option 2: Zona UX).

## **Immediate Action (User)**
- **TEST APK:** `apps/tv/android/app/build/outputs/apk/debug/app-debug.apk`
- **VERIFY:**
    1.  Multi-file torrents (Seasons).
    2.  Seek performance (Pulse should prefetch).
    3.  Status updates.

### Phase 6: Verification & Polish
- [x] **T012**: Fix "No Source Found" (Gateway Race Condition)
    - [x] Implement Metadata Polling in Gateway (`waitForMetadata`)
    - [x] Fix `getTorrentInfo` / 500 Stream Error
    - [x] Add detailed debug logs to Worker `/play`
    - [x] End-to-End Playback (User Verification)
    - [x] Gateway Health Check Passed (`167.99.201.47`)
    - [x] Worker Deployment Verified
    - [x] End-to-End Playback (User Verification)
        - [x] Enable Cleartext Traffic (Protocol B)
        - [x] Rebuild & Install APK (v4.1.4)
        - [x] Deploy to Landing Page (R2 + Worker v4.1.4)
        - [x] **Plan B Executed**: VPS Proxy (Port 80) + Local APK Mirror.
        - [x] **Landing Page**: https://ottv.duckdns.org (Secure DuckDNS)
        - [x] **APK**: v4.1.8 (Accessible via HTTPS)
