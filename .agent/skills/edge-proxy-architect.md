---
name: edge-proxy-architect
description: Master of Cloudflare Workers, R2 Storage, CORS sanitization, and Edge Proxy Swarms
sasmp_version: "1.3.0"
version: "1.0.0"
bonded_agent: 02-edge-computing-specialist
bond_type: PRIMARY_BOND
allowed-tools: Read, Write, Bash, Glob, Grep

# Parameter Validation
parameters:
  deployment:
    type: string
    enum: [wrangler, dashboard]
    default: wrangler
    description: Preferred CF deployment method
---

# Edge Proxy Architect Skill

Architect resilient, high-performance proxies using Cloudflare Workers and R2.

## Overview

This skill covers the design and implementation of API proxies that bypass CPU limits (10ms free tier), handle CORS headers for TV clients, and provide failover logic for metadata providers like TMDB.

## When to Use This Skill

Use when you need to:
- Deploy or update Cloudflare Workers
- Implement CORS sanitization (Header stripping/spoofing)
- Manage R2 buckets for caching metadata/images
- Handle TMDB 403 errors or 1102 CPU timeouts
- Create "Edge Unified" proxy swarms for load balancing

## Quick Reference

```javascript
// universal_tmdb_proxy.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tmdbUrl = `https://api.themoviedb.org/3${url.pathname}${url.search}`;
    
    // Header Spoofing for Geo-bypass/CORS
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Referer", "https://www.themoviedb.org/");
    newHeaders.set("Origin", "https://www.themoviedb.org");
    
    try {
      const response = await fetch(tmdbUrl, {
        headers: {
          "Authorization": `Bearer ${env.TMDB_TOKEN}`,
          ...Object.fromEntries(newHeaders)
        }
      });
      
      // Inject CORS for TV apps
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
```

## Wrangler Configuration

```toml
# wrangler.toml
name = "vibe-proxy-edge"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
API_BASE = "https://api.themoviedb.org/3"

[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "vibe-metadata-cache"
```

## Useful Commands

```bash
wrangler dev                     # Local testing
wrangler deploy                  # Production deploy
wrangler secret put TMDB_TOKEN   # Securely store keys
wrangler r2 bucket create cache  # Create storage
wrangler tail                    # Live logs for debugging
```

## Performance Optimization

```javascript
// 302 Redirect Pattern to save CPU time on Free Tier
if (shouldRedirect) {
  return Response.redirect(targetUrl, 302);
}

// Gzip stripping for binary compatibility
newHeaders.delete("Accept-Encoding");
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 1102 CPU Limit | Use redirects or simplify regex/logic |
| 403 Forbidden | Rotate User-Agent and check Referer header |
| CORS Error | Ensure `Access-Control-Allow-Origin: *` in response |

## Usage

```
Skill("edge-proxy-architect")
```
