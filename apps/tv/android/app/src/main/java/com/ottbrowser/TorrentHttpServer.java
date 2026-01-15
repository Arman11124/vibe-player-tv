package com.ottbrowser;

import android.util.Log;
import fi.iki.elonen.NanoHTTPD;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import org.libtorrent4j.SessionManager; // Corrected import
import org.libtorrent4j.Sha1Hash; // Added import for Sha1Hash
import org.libtorrent4j.TorrentHandle; // Added import for TorrentHandle
import org.libtorrent4j.TorrentInfo; // Added import for TorrentInfo
import org.libtorrent4j.FileStorage;

public class TorrentHttpServer extends NanoHTTPD {
    private static final String TAG = "TorrentHttpServer";
    private SessionManager session;
    private File rootDir;
    private volatile String targetHash;
    private String authToken;

    // Helper Class to hold Context
    private static class VideoContext {
        File file;
        TorrentHandle th;
        TorrentInfo ti;
        int fileIndex;
        long fileTotalOffset; // Byte offset where this file starts in the torrent
    }

    public TorrentHttpServer(int port, SessionManager session, File rootDir, String authToken) {
        super("127.0.0.1", port); // BIND TO LOCALHOST ONLY
        this.session = session;
        this.rootDir = rootDir;
        this.authToken = authToken;
    }

    public void setTargetHash(String hash) {
        this.targetHash = hash;
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        // Log.d(TAG, "Request: " + uri); // Comment out to reduce log spam

        // 1. Security Check: Token
        String token = session.getParms().get("t");
        if (authToken != null && !authToken.equals(token)) {
            Log.w(TAG, "Unauthorized Access Attempt from " + session.getRemoteIpAddress());
            return newFixedLengthResponse(Response.Status.FORBIDDEN, NanoHTTPD.MIME_PLAINTEXT, "Forbidden");
        }

        // API: /stream/<HASH>/<INDEX>
        String targetHash = null;
        int fileIndex = -1;

        if (uri.startsWith("/stream/")) {
            String[] parts = uri.split("/");
            // parts[0] = ""
            // parts[1] = "stream"
            // parts[2] = hash
            // parts[3] = index (optional for legacy, but we are enforcing strict)
            if (parts.length >= 3) {
                targetHash = parts[2];
            }
            if (parts.length >= 4) {
                try {
                    fileIndex = Integer.parseInt(parts[3]);
                } catch (NumberFormatException e) {
                    Log.w(TAG, "Invalid File Index: " + parts[3]);
                }
            }
        }

        if (targetHash == null) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, NanoHTTPD.MIME_PLAINTEXT,
                    "Invalid Stream URL. Use /stream/<HASH>/<INDEX>");
        }

        // 2. Resolve File & Context
        VideoContext ctx = resolveVideoContext(targetHash, fileIndex);
        if (ctx == null || !ctx.file.exists()) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, NanoHTTPD.MIME_PLAINTEXT,
                    "File Not Found (or Metadata missing)");
        }

        // 3. Serve with Brain
        return serveFile(ctx, session.getHeaders());
    }

    private VideoContext resolveVideoContext(String hash, int strictIndex) {
        if (hash == null)
            return null;
        if (this.session == null || !this.session.isRunning())
            return null;

        try {
            org.libtorrent4j.swig.torrent_handle_vector v = this.session.swig().get_torrents();
            long size = v.size();
            for (long i = 0; i < size; i++) {
                org.libtorrent4j.swig.torrent_handle th_swig = v.get((int) i);
                if (th_swig.is_valid()) {
                    String h = th_swig.info_hash().to_hex();
                    if (h.equalsIgnoreCase(hash)) {
                        TorrentHandle th = new TorrentHandle(th_swig);
                        TorrentInfo ti = th.torrentFile();
                        if (ti != null) {
                            org.libtorrent4j.FileStorage fs = ti.files();
                            int numFiles = fs.numFiles();

                            // STRICT MODE: If index provided, use it.
                            if (strictIndex >= 0 && strictIndex < numFiles) {
                                VideoContext ctx = new VideoContext();
                                ctx.th = th;
                                ctx.ti = ti;
                                ctx.fileIndex = strictIndex;
                                ctx.file = new File(this.rootDir, fs.filePath(strictIndex));
                                ctx.fileTotalOffset = fs.fileOffset(strictIndex);
                                return ctx;
                            }

                            // LEGACY FALLBACK (Only if strictIndex == -1, e.g. from old code)
                            if (strictIndex == -1) {
                                // HEURISTIC: Find Largest Video File
                                long maxSize = -1;
                                int bestIndex = -1;
                                for (int j = 0; j < numFiles; j++) {
                                    long fSize = fs.fileSize(j);
                                    if (fSize > maxSize) {
                                        String name = fs.fileName(j).toLowerCase();
                                        if (name.endsWith(".mp4") || name.endsWith(".mkv") || name.endsWith(".avi")) {
                                            maxSize = fSize;
                                            bestIndex = j;
                                        }
                                    }
                                }
                                if (bestIndex != -1) {
                                    VideoContext ctx = new VideoContext();
                                    ctx.th = th;
                                    ctx.ti = ti;
                                    ctx.fileIndex = bestIndex;
                                    ctx.file = new File(this.rootDir, fs.filePath(bestIndex));
                                    ctx.fileTotalOffset = fs.fileOffset(bestIndex);
                                    return ctx;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Resolve Error for " + hash, e);
        }
        return null;
    }

    private Response serveFile(VideoContext ctx, Map<String, String> header) {
        File file = ctx.file;
        Response res;
        String mime = "video/mp4"; // Default
        String name = file.getName().toLowerCase();
        if (name.endsWith(".mkv"))
            mime = "video/x-matroska";

        try {
            String etag = Integer
                    .toHexString((file.getAbsolutePath() + file.lastModified() + "" + file.length()).hashCode());
            long startFrom = 0;
            long endAt = -1;
            String range = header.get("range");

            if (range != null && range.startsWith("bytes=")) {
                range = range.substring("bytes=".length());
                int minus = range.indexOf('-');
                try {
                    if (minus > 0) {
                        startFrom = Long.parseLong(range.substring(0, minus));
                        endAt = Long.parseLong(range.substring(minus + 1));
                    }
                } catch (NumberFormatException ignored) {
                }
            }

            // 503 BRAIN CHECK: Is the piece ready?
            // Calculate absolute byte offset in the torrent
            long absoluteByteOffset = ctx.fileTotalOffset + startFrom;
            int pieceIndex = (int) (absoluteByteOffset / ctx.ti.pieceLength());

            // Allow a small buffer (check strict piece availability)
            // If the piece is NOT downloaded, return 503 to force ExoPlayer to retry
            // instead of reading garbage zeros/EOF.
            if (!ctx.th.havePiece(pieceIndex)) {
                // Log.w(TAG, "Brain: 503 - Piece " + pieceIndex + " NOT READY. Waiting...");
                Response retry = newFixedLengthResponse(Response.Status.SERVICE_UNAVAILABLE, NanoHTTPD.MIME_PLAINTEXT,
                        "Buffering...");
                retry.addHeader("Retry-After", "1"); // Retry in 1 second
                return retry;
            }

            // Schedule Priorities for this request (The Brain)
            schedulePieces(ctx.th, ctx.ti, ctx.fileIndex, ctx.fileTotalOffset, startFrom, endAt);

            long fileLen = file.length();
            if (endAt < 0) {
                endAt = fileLen - 1;
            }
            long newLen = endAt - startFrom + 1;
            if (newLen < 0) {
                newLen = 0;
            }

            final long finalLen = newLen;
            FileInputStream fis = new FileInputStream(file) {
                @Override
                public int available() throws IOException {
                    // This is a hack for NanoHTTPD's internal handling of available()
                    // It expects available() to return the number of bytes that can be read
                    // without blocking. For a FileInputStream, this is usually the remaining
                    // bytes in the stream. We want it to reflect the 'newLen' for the partial
                    // content.
                    // However, this might not be strictly correct for all scenarios,
                    // especially if the underlying file is still being written to.
                    // For streaming, we want to tell NanoHTTPD how much we *intend* to serve.
                    return (int) finalLen;
                }
            };
            fis.skip(startFrom);

            res = newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, mime, fis, finalLen);
            res.addHeader("Accept-Ranges", "bytes");
            res.addHeader("Content-Length", "" + finalLen);
            res.addHeader("Content-Range", "bytes " + startFrom + "-" + endAt + "/" + fileLen);
            res.addHeader("ETag", etag);
        } catch (IOException e) {
            res = newFixedLengthResponse(Response.Status.FORBIDDEN, NanoHTTPD.MIME_PLAINTEXT, e.getMessage());
        }

        return res;
    }

    private void schedulePieces(TorrentHandle th, TorrentInfo ti, int fileIndex, long fileOffset, long startByte,
            long endByte) {
        try {
            // "The Brain" - Reactive Piece Scheduling Logic
            if (endByte == -1)
                endByte = startByte + 10_000_000; // Look ahead 10MB approx

            long absoluteStart = fileOffset + startByte;
            long absoluteEnd = fileOffset + endByte;

            int pieceLength = ti.pieceLength();
            int startPiece = (int) (absoluteStart / pieceLength);
            int endPiece = (int) (absoluteEnd / pieceLength);

            // Log.d(TAG, "Brain: Scheduling Pieces " + startPiece + " to " + endPiece);

            int MAX_PIECES = 64;
            int count = 0;

            for (int p = startPiece; p <= endPiece; p++) {
                if (count >= MAX_PIECES)
                    break;

                int deadline = 2500; // Default: 2.5s prefetch
                if (p <= startPiece + 3)
                    deadline = 800; // Immediate: 800ms

                th.setPieceDeadline(p, deadline);
                count++;
            }
        } catch (Exception e) {
            Log.e(TAG, "Brain Error", e);
        }
    }
}
