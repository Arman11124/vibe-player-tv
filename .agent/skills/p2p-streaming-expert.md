---
name: p2p-streaming-expert
description: Specialist in P2P protocols, BitTorrent DHT, Tracker injection, and Russian tracker APIs
sasmp_version: "1.3.0"
version: "1.0.0"
bonded_agent: 03-p2p-engineer
bond_type: PRIMARY_BOND
allowed-tools: Read, Write, Bash, Glob, Grep

# Parameter Validation
parameters:
  client:
    type: string
    enum: [webtorrent, libtorrent, vibix]
    default: webtorrent
    description: P2P library preference
---

# P2P Streaming Expert Skill

Engineer high-performance torrent streaming with aggressive peer discovery and tracker management.

## Overview

This skill focuses on the "Cold Start" problem in streaming (minimizing time to first frame). It covers DHT stability, ApiBay/RuTracker integration, and the "Iron Link" methodology for tracker injection.

## When to Use This Skill

Use when you need to:
- Implement magnet link parsing and validation
- Inject stable trackers into existing magnet links
- Fetch torrent metadata from Russian APIs (ApiBay, RuTracker)
- Optimize WebTorrent/LibTorrent configuration for TV memory
- Debug "No Peers" or "Hash None" errors in the search engine

## Quick Reference

```javascript
// Magnet Link Tracker Injection (Iron Link)
const STABLE_TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://bt.t-ru.org:2710/announce",
  "http://retracker.local/announce"
];

const injectTrackers = (hash) => {
  const trackers = STABLE_TRACKERS.map(tr => `&tr=${encodeURIComponent(tr)}`).join('');
  return `magnet:?xt=urn:btih:${hash}${trackers}`;
};

// ApiBay JSON Fetch Pattern
const searchApiBay = async (query) => {
  const response = await fetch(`https://apibay.org/q.php?q=${query}&cat=200`);
  const results = await response.json();
  return results.map(item => ({
    name: item.name,
    hash: item.info_hash,
    seeds: item.seeders
  }));
};
```

## Protocol Optimization

```javascript
// WebTorrent Tuning for TV
const client = new WebTorrent({
  maxConns: 30,         // Keep memory footprint low
  dht: { concurrency: 64 }, // Aggressive DHT search
  tracker: true
});
```

## Useful Commands

```bash
bt-download --info [MAGNET]       # Inspect torrent metadata
nc -zv tracker.opentrackr.org 1337 # Test tracker connectivity
curl -I https://apibay.org/q.php  # Check API availability
grep -r "magnet:" src/            # Audit magnet implementation
```

## P2P Performance Tuning

```bash
# Increase UDP buffer sizes (if native environment allows)
sysctl -w net.core.rmem_max=26214400
sysctl -w net.core.wmem_max=26214400
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Hash None | Verify ApiBay response and fallback to TPB if needed |
| 0 Peers | Check firewall and ensure tracker injection is active |
| Slow Metadata | Fetch seeders/leechers first, then priority metadata |

## Usage

```
Skill("p2p-streaming-expert")
```
