/**
 * TorrentMetaParser.ts
 * Parses torrent filenames to extract quality, audio track, codec, and source info.
 * Optimized for Russian release naming conventions.
 */

export interface ParsedMeta {
    quality: string;      // "4K", "1080p", "720p", "480p"
    audioTrack: string;   // "Дубляж", "Многоголосый", "Original"
    codec: string;        // "x265", "x264", "HEVC"
    source: string;       // "WEB-DL", "BluRay", "HDRip"
    displayName: string;  // Formatted: "1080p • Дубляж"
}

// Quality patterns (priority order)
const QUALITY_PATTERNS = [
    { regex: /(4K|2160p)/i, label: '4K' },
    { regex: /1080p/i, label: '1080p' },
    { regex: /720p/i, label: '720p' },
    { regex: /480p/i, label: '480p' },
    { regex: /HDRip/i, label: 'HD' },
    { regex: /DVDRip/i, label: 'DVD' },
];

// Russian audio patterns (priority order - higher quality first)
const AUDIO_PATTERNS = [
    { regex: /(Дубляж|DUB|Лицензия)/i, label: 'Дубляж' },
    { regex: /(Многоголосый|MVO)/i, label: 'Многоголосый' },
    { regex: /(Двухголосый|DVO)/i, label: 'Двухголосый' },
    { regex: /(Одноголосый|AVO)/i, label: 'Авторский' },
    { regex: /(Original|ENG)/i, label: 'Original' },
    { regex: /sub(s|titled)?/i, label: 'Субтитры' },
];

// Codec patterns
const CODEC_PATTERNS = [
    { regex: /(x265|HEVC|H\.?265)/i, label: 'HEVC' },
    { regex: /(x264|AVC|H\.?264)/i, label: 'x264' },
    { regex: /AV1/i, label: 'AV1' },
];

// Source patterns
const SOURCE_PATTERNS = [
    { regex: /WEB-DL/i, label: 'WEB-DL' },
    { regex: /WEBRip/i, label: 'WEBRip' },
    { regex: /BluRay|BDRip|Blu-Ray/i, label: 'BluRay' },
    { regex: /HDRip/i, label: 'HDRip' },
    { regex: /DVDRip/i, label: 'DVDRip' },
    { regex: /HDTV/i, label: 'HDTV' },
];

function matchPattern(filename: string, patterns: { regex: RegExp; label: string }[]): string {
    for (const pattern of patterns) {
        if (pattern.regex.test(filename)) {
            return pattern.label;
        }
    }
    return '';
}

export function parseFilename(filename: string): ParsedMeta {
    const quality = matchPattern(filename, QUALITY_PATTERNS) || 'Unknown';
    const audioTrack = matchPattern(filename, AUDIO_PATTERNS) || 'Unknown';
    const codec = matchPattern(filename, CODEC_PATTERNS);
    const source = matchPattern(filename, SOURCE_PATTERNS);

    // Build display name
    const parts = [quality, audioTrack].filter(Boolean);
    const displayName = parts.join(' • ') || filename.slice(0, 30);

    return {
        quality,
        audioTrack,
        codec,
        source,
        displayName,
    };
}

/**
 * Sort files by quality score (best first)
 */
export function sortByQuality(files: { path: string; length: number }[]): { path: string; length: number; meta: ParsedMeta }[] {
    const qualityScore: Record<string, number> = {
        '4K': 100,
        '1080p': 80,
        '720p': 60,
        'HD': 50,
        '480p': 40,
        'DVD': 30,
        'Unknown': 10,
    };

    const audioScore: Record<string, number> = {
        'Дубляж': 100,
        'Многоголосый': 80,
        'Двухголосый': 60,
        'Авторский': 40,
        'Original': 30,
        'Субтитры': 20,
        'Unknown': 10,
    };

    return files
        .map(f => ({ ...f, meta: parseFilename(f.path) }))
        .sort((a, b) => {
            const qScoreA = qualityScore[a.meta.quality] || 0;
            const qScoreB = qualityScore[b.meta.quality] || 0;
            if (qScoreA !== qScoreB) return qScoreB - qScoreA;

            const aScoreA = audioScore[a.meta.audioTrack] || 0;
            const aScoreB = audioScore[b.meta.audioTrack] || 0;
            return aScoreB - aScoreA;
        });
}

export default { parseFilename, sortByQuality };
