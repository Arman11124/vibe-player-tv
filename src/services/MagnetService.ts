import axios from 'axios';
import ConfigService from './ConfigService';

export interface MagnetResult {
    title: string;
    magnet: string;
    size: string;
    seeds: number;
    peers: number;
    source: string;
}

class MagnetService {

    /**
     * Search for magnets using the Parser URL from Gist
     */
    public async search(query: string, year?: string): Promise<MagnetResult[]> {
        const config = await ConfigService.fetchConfig();
        const parserUrl = config.parser_url; // e.g. "http://jacred.xyz" or Prowlarr

        if (!parserUrl) {
            console.warn('[Magnet] No parser URL defined');
            return [];
        }

        console.log(`[Magnet] Searching '${query} ${year || ''}' via ${parserUrl}`);

        try {
            // Heuristic: JacRed / Jackett API pattern
            // Adjust this based on the actual "Brain" API you are using.
            const searchQuery = year ? `${query} ${year}` : query;
            const url = `${parserUrl}/search?q=${encodeURIComponent(searchQuery)}`;

            const res = await axios.get(url, { timeout: 8000 });

            if (res.data && Array.isArray(res.data)) {
                const results = res.data.map((item: any) => {
                    let magnet = item.magnet || item.link || '';
                    if (magnet.startsWith('magnet:?')) {
                        // 1. Inject Massive Tracker List (Best of 2025)
                        const trackers = [
                            "udp://tracker.opentrackr.org:1337/announce",
                            "udp://open.stealth.si:80/announce",
                            "udp://tracker.openbittorrent.com:80/announce",
                            "udp://tracker.coppersurfer.tk:6969/announce",
                            "udp://tracker.leechers-paradise.org:6969/announce",
                            "udp://p4p.arenabg.com:1337/announce",
                            "udp://tracker.internetwarriors.net:1337/announce",
                            "udp://9.rarbg.to:2710/announce",
                            "udp://9.rarbg.me:2710/announce",
                            "udp://tracker.cyberia.is:6969/announce",
                            "udp://exodus.desync.com:6969/announce",
                            "udp://tracker.tiny-vps.com:6969/announce",
                            "udp://tracker.torrent.eu.org:451/announce",
                            "udp://tracker.moeking.me:6969/announce",
                            "udp://ipv4.tracker.harry.lu:80/announce",
                            "udp://open.demonii.com:1337/announce",
                            "udp://denis.stalker.upeer.me:6969/announce",
                            "udp://tracker.port443.xyz:6969/announce",
                            "udp://uploads.gamecoast.net:6969/announce"
                        ];
                        const trParams = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');
                        if (!magnet.includes('&tr=')) {
                            magnet += trParams;
                        }

                        // 2. Inject Display Name (DN) for DHT fallback
                        if (!magnet.includes('&dn=')) {
                            const title = item.title || item.name || 'Video';
                            magnet += `&dn=${encodeURIComponent(title)}`;
                        }
                    }

                    return {
                        title: item.title || item.name || 'Unknown',
                        magnet: magnet,
                        size: item.size || '0 MB',
                        seeds: parseInt(item.seeders || item.seeds || '0'),
                        peers: parseInt(item.peers || item.leechers || '0'),
                        source: item.source || item.tracker || 'Unknown'
                    };
                }).filter((m: MagnetResult) => m.magnet.startsWith('magnet:'));

                // Russian audio priority: boost results with Russian keywords
                const ruKeywords = ['rus', 'russian', 'дубляж', 'многоголосый', 'лицензия', 'mvo', 'dub', 'avo'];
                return results.sort((a: MagnetResult, b: MagnetResult) => {
                    const aIsRu = ruKeywords.some(k => a.title.toLowerCase().includes(k));
                    const bIsRu = ruKeywords.some(k => b.title.toLowerCase().includes(k));
                    if (aIsRu && !bIsRu) return -1;
                    if (!aIsRu && bIsRu) return 1;
                    return b.seeds - a.seeds; // Fallback: sort by seeds
                });
            }

            return [];
        } catch (e) {
            console.error('[Magnet] Search failed', e);
            return [];
        }
    }
}

export default new MagnetService();
