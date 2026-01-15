/**
 * MagnetService - P2P Streaming Expert
 * Implements "Iron Link" methodology for tracker injection and magnet link optimization.
 * Resolves the "Cold Start" problem by ensuring magnets always have stable trackers.
 */

// Iron Link: Stable Trackers (UDP + HTTP) - Verified 2025
const STABLE_TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://bt.t-ru.org:2710/announce',           // RuTracker official
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.moeking.me:6969/announce',
    'http://retracker.local/announce',
    'http://tracker.gbitt.info:80/announce',
    'udp://explodie.org:6969/announce',
    'udp://tracker.tiny-vps.com:6969/announce'
];

export class MagnetService {
    /**
     * Resolves and optimizes a magnet link.
     * - Injects "Iron Link" tracker list into EVERY magnet link
     * - Ensures xt parameter is strictly urn:btih:HASH
     * - URL-encodes the dn (display name) parameter
     * @param magnetLink - Original magnet link (may be incomplete or missing trackers)
     * @returns Optimized magnet link with all trackers injected
     */
    static resolveMagnet(magnetLink: string): string {
        if (!magnetLink || !magnetLink.startsWith('magnet:?')) {
            throw new Error('Invalid magnet link format');
        }

        // Parse the magnet link
        const url = new URL(magnetLink);
        const params = url.searchParams;

        // Extract info hash (xt parameter)
        let xt = params.get('xt');
        if (!xt) {
            throw new Error('Missing xt parameter in magnet link');
        }

        // Enforce strict urn:btih:HASH format
        // Extract the hash (remove any prefix like "urn:btih:" or "urn:btmh:")
        const hashMatch = xt.match(/(?:urn:btih:)?([a-fA-F0-9]{40}|[a-zA-Z0-9]{32})/i);
        if (!hashMatch) {
            throw new Error('Invalid info hash format in xt parameter');
        }
        const hash = hashMatch[1];
        xt = `urn:btih:${hash}`;

        // Extract display name (dn parameter) and URL-encode it
        let dn = params.get('dn');
        if (dn) {
            // Re-encode to ensure proper encoding
            dn = encodeURIComponent(decodeURIComponent(dn));
        }

        // Build the optimized magnet link
        let optimizedMagnet = `magnet:?xt=${xt}`;

        // Add display name if present
        if (dn) {
            optimizedMagnet += `&dn=${dn}`;
        }

        // Inject all stable trackers
        for (const tracker of STABLE_TRACKERS) {
            optimizedMagnet += `&tr=${encodeURIComponent(tracker)}`;
        }

        // Preserve any existing trackers from the original magnet (avoid duplicates)
        const existingTrackers = params.getAll('tr');
        for (const existingTracker of existingTrackers) {
            // Only add if not already in STABLE_TRACKERS
            if (!STABLE_TRACKERS.includes(existingTracker)) {
                optimizedMagnet += `&tr=${encodeURIComponent(existingTracker)}`;
            }
        }

        return optimizedMagnet;
    }

    /**
     * Creates a magnet link from just a hash (useful for ApiBay/RuTracker APIs).
     * @param hash - Info hash (40-char SHA1 or 32-char base32)
     * @param displayName - Optional display name for the torrent
     * @returns Complete magnet link with Iron Link trackers
     */
    static createMagnetFromHash(hash: string, displayName?: string): string {
        // Validate hash format
        if (!/^[a-fA-F0-9]{40}$|^[a-zA-Z0-9]{32}$/i.test(hash)) {
            throw new Error('Invalid hash format (expected 40-char SHA1 or 32-char base32)');
        }

        let magnet = `magnet:?xt=urn:btih:${hash}`;

        if (displayName) {
            magnet += `&dn=${encodeURIComponent(displayName)}`;
        }

        // Inject all stable trackers
        for (const tracker of STABLE_TRACKERS) {
            magnet += `&tr=${encodeURIComponent(tracker)}`;
        }

        return magnet;
    }
}
