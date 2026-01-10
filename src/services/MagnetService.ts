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
            // Assuming simplified JacRed style: /search?q=...
            const searchQuery = year ? `${query} ${year}` : query;
            const url = `${parserUrl}/search?q=${encodeURIComponent(searchQuery)}`;

            const res = await axios.get(url, { timeout: 8000 });

            if (res.data && Array.isArray(res.data)) {
                // Map/Normalize results
                return res.data.map((item: any) => ({
                    title: item.title || item.name || 'Unknown',
                    magnet: item.magnet || item.link || '',
                    size: item.size || '0 MB',
                    seeds: parseInt(item.seeders || item.seeds || '0'),
                    peers: parseInt(item.peers || item.leechers || '0'),
                    source: item.tracker || 'Unknown'
                })).filter((m: MagnetResult) => m.magnet.startsWith('magnet:'));
            }

            return [];
        } catch (e) {
            console.error('[Magnet] Search failed', e);
            return [];
        }
    }
}

export default new MagnetService();
