/**
 * DohResolver.ts
 * DNS over HTTPS resolver to bypass ISP DNS blocking
 * Uses Google and Cloudflare DoH services
 */

import axios from 'axios';

interface DohResponse {
    Answer?: Array<{
        data: string;
        type: number;
    }>;
}

// DoH Endpoints (usually not blocked because they're HTTPS)
const DOH_ENDPOINTS = [
    'https://dns.google/resolve',           // Google DoH
    'https://cloudflare-dns.com/dns-query', // Cloudflare DoH
    'https://dns.quad9.net:5053/dns-query', // Quad9 DoH
];

// Cache resolved IPs for 10 minutes
const dnsCache: Map<string, { ip: string; expires: number }> = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Resolve domain to IP using DNS over HTTPS
 */
export const resolveWithDoH = async (domain: string): Promise<string | null> => {
    // Check cache first
    const cached = dnsCache.get(domain);
    if (cached && cached.expires > Date.now()) {
        console.log(`[DoH] Cache hit: ${domain} -> ${cached.ip}`);
        return cached.ip;
    }

    // Try each DoH endpoint
    for (const endpoint of DOH_ENDPOINTS) {
        try {
            console.log(`[DoH] Resolving ${domain} via ${endpoint}`);

            const response = await axios.get<DohResponse>(endpoint, {
                params: {
                    name: domain,
                    type: 'A' // IPv4
                },
                headers: {
                    'Accept': 'application/dns-json'
                },
                timeout: 5000
            });

            if (response.data.Answer && response.data.Answer.length > 0) {
                // Find A record (type 1)
                const aRecord = response.data.Answer.find(a => a.type === 1);
                if (aRecord) {
                    const ip = aRecord.data;

                    // Validate IP - reject fake/poisoned responses
                    if (ip.startsWith('127.') || ip === '0.0.0.0' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
                        console.log(`[DoH] Rejected poisoned IP: ${domain} -> ${ip}`);
                        continue; // Try next DoH endpoint
                    }

                    console.log(`[DoH] Resolved: ${domain} -> ${ip}`);

                    // Cache the result
                    dnsCache.set(domain, { ip, expires: Date.now() + CACHE_TTL });
                    return ip;
                }
            }
        } catch (e) {
            console.log(`[DoH] ${endpoint} failed, trying next...`);
        }
    }

    console.log(`[DoH] All endpoints failed for ${domain}`);
    return null;
};

/**
 * Convert URL to use resolved IP (with Host header)
 * This bypasses ISP DNS blocking
 */
export const resolveUrl = async (url: string): Promise<{ url: string; headers?: Record<string, string> }> => {
    try {
        // Parse URL using regex (React Native doesn't have native URL class)
        const match = url.match(/^(https?:\/\/)([^\/]+)(\/.*)?$/);
        if (!match) {
            console.log('[DoH] Invalid URL format:', url);
            return { url };
        }

        const [, protocol, domain, path = ''] = match;

        // Resolve domain via DoH
        const ip = await resolveWithDoH(domain);

        if (ip) {
            // Replace domain with IP and add Host header
            const resolvedUrl = `${protocol}${ip}${path}`;
            console.log(`[DoH] Resolved URL: ${domain} -> ${ip}`);
            return {
                url: resolvedUrl,
                headers: { 'Host': domain }
            };
        }
    } catch (e) {
        console.log('[DoH] URL resolution error:', e);
    }

    // Fallback: return original URL
    return { url };
};
