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