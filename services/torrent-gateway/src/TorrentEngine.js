import WebTorrent from 'webtorrent';

class TorrentEngine {
    constructor() {
        this.client = new WebTorrent();
        this.torrents = new Map(); // hash -> torrent
    }

    async addMagnet(magnetURI) {
        return new Promise((resolve, reject) => {
            // Check if already exists
            const existing = this.client.get(magnetURI);
            if (existing) {
                console.log(`[Engine] Torrent already active: ${existing.infoHash}`);
                resolve(this._formatTorrentInfo(existing));
                return;
            }

            console.log(`[Engine] Adding magnet...`);
            const torrent = this.client.add(magnetURI, {
                path: '/tmp/webtorrent', // Ephemeral storage
                destroyStoreOnDestroy: true
            });

            // Metadata Timeout
            const timeout = setTimeout(() => {
                console.warn(`[Engine] Metadata timeout for ${magnetURI}`);
                // Don't destroy immediately, maybe it's slow?
                // But for MVP, reject.
                // torrent.destroy();
                // reject(new Error('Metadata timeout'));
            }, 15000);

            torrent.on('metadata', () => {
                clearTimeout(timeout);
                console.log(`[Engine] Metadata loaded for ${torrent.infoHash}: ${torrent.name}`);
                resolve(this._formatTorrentInfo(torrent));
            });

            torrent.on('error', (err) => {
                console.error(`[Engine] Torrent Error:`, err);
                reject(err);
            });
        });
    }

    getStream(infoHash, fileIndex, range = null) {
        const torrent = this.client.get(infoHash);
        if (!torrent) {
            throw new Error('Torrent not found');
        }

        if (fileIndex >= torrent.files.length) {
            throw new Error('File index out of bounds');
        }

        const file = torrent.files[fileIndex];
        console.log(`[Engine] Streaming ${file.name} (Range: ${range ? JSON.stringify(range) : 'All'})`);

        return {
            stream: file.createReadStream(range),
            file: file
        };
    }

    _formatTorrentInfo(torrent) {
        return {
            infoHash: torrent.infoHash,
            name: torrent.name,
            files: torrent.files.map((f, idx) => ({
                index: idx,
                name: f.name,
                length: f.length
            }))
        };
    }
}

export default new TorrentEngine();
