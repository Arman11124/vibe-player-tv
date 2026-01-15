import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';

export class FileServer {
    private downloadDir: string;

    constructor(downloadDir: string) {
        this.downloadDir = downloadDir;
    }

    /**
     * Serves a file with HTTP Range support.
     * @param filePath Relative path from downloads dir (e.g. "MyMovie/movie.mp4")
     */
    async serveFile(req: Request, res: Response, filePath: string) {
        const fullPath = path.join(this.downloadDir, filePath);

        // Security check: Prevent directory traversal
        if (!fullPath.startsWith(this.downloadDir)) {
            res.status(403).send('Access denied');
            return;
        }

        if (!fs.existsSync(fullPath)) {
            // File might not be allocated yet by qBittorrent
            res.status(404).send('File not found (or not allocated yet)');
            return;
        }

        const stat = fs.statSync(fullPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            // Partial Content (206)
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            const file = fs.createReadStream(fullPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4', // Simplification for MVP
            };

            res.writeHead(206, head);
            file.pipe(res);
        } else {
            // Full Content (200)
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(fullPath).pipe(res);
        }
    }
}

// Singleton
export const fileServer = new FileServer(process.env.DOWNLOAD_DIR || '/downloads');
