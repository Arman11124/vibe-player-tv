package com.ottbrowser;

import android.os.Environment;
import android.util.Log;
import android.content.Intent;
import android.os.Build;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import org.libtorrent4j.SessionManager;
import org.libtorrent4j.SettingsPack;
import org.libtorrent4j.SessionParams;
import org.libtorrent4j.AddTorrentParams;
import org.libtorrent4j.swig.settings_pack;
import org.libtorrent4j.swig.error_code;
import org.libtorrent4j.TorrentHandle;
import org.libtorrent4j.TorrentInfo;
import org.libtorrent4j.Sha1Hash;

import java.io.File;
import java.io.IOException;
import java.util.UUID; // Added import

public class TorrentModule extends ReactContextBaseJavaModule {
    private static final String TAG = "TorrentModule";
    private final ReactApplicationContext reactContext;
    private static final SessionManager session = new SessionManager();
    private static TorrentHttpServer server;
    private static final int PORT = 8080;

    TorrentModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "TorrentModule";
    }

    @ReactMethod
    public void startEngine(Promise promise) {
        try {
            if (session.isRunning()) {
                promise.resolve("Already Running");
                return;
            }

            Log.d(TAG, "Starting LibTorrent Engine...");
            
            // 1. Ignite the Immortal Shield (Foreground Service)
            Intent serviceIntent = new Intent(reactContext, TorrService.class);
            serviceIntent.setAction(TorrService.ACTION_START);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                reactContext.startForegroundService(serviceIntent);
            } else {
                reactContext.startService(serviceIntent);
            }

            // 2. Apply "Low-End TV" Expert Settings
            SettingsPack sp = new SettingsPack()
                    .activeDownloads(1)      // Expert: Focus on the ONE movie user is watching
                    .connectionsLimit(60)    // Expert: 60 peers max to save cheap WiFi chips
                    .alertQueueSize(500)     
                    .downloadRateLimit(0)
                    .uploadRateLimit(0);
                    
            // Apply Performance Settings via SWIG
            settings_pack pack = sp.swig();
            // cache_size removed for compatibility with libtorrent4j 2.1.0 (mmap)
            pack.set_bool(settings_pack.bool_types.enable_dht.swigValue(), true);
            pack.set_bool(settings_pack.bool_types.enable_lsd.swigValue(), true);
            pack.set_bool(settings_pack.bool_types.enable_upnp.swigValue(), true);
            pack.set_bool(settings_pack.bool_types.enable_natpmp.swigValue(), true);
            
            // Expert: Suggest Mode for Streaming (Read Cache Priority)
            pack.set_int(settings_pack.int_types.suggest_mode.swigValue(), 
                         settings_pack.suggest_mode_t.suggest_read_cache.swigValue());

            session.start(new SessionParams(sp));

            // Start HTTP Server
            initServer(); 

            promise.resolve("Engine Started");
        } catch (Exception e) {
            Log.e(TAG, "Start Error", e);
            promise.reject("START_ERROR", e);
        }
    }

    @ReactMethod
    public void stopEngine(Promise promise) {
        try {
            if (session.isRunning()) {
                session.stop();
            }
            if (server != null) {
                server.stop();
                server = null;
            }
            
            // Stop the Shield
            Intent serviceIntent = new Intent(reactContext, TorrService.class);
            serviceIntent.setAction(TorrService.ACTION_STOP);
            reactContext.startService(serviceIntent);

            promise.resolve("Engine Stopped");
        } catch (Exception e) {
            promise.reject("STOP_ERROR", e);
        }
    }

    private String authToken; // Store token

    private void initServer() {
        if (server == null) {
            try {
                // Ensure dir exists
                File downloadDir = new File(reactContext.getExternalFilesDir(null), "VibeTorrents");
                if (!downloadDir.exists())
                    downloadDir.mkdirs();

                // Generate Secure Token
                this.authToken = UUID.randomUUID().toString();

                server = new TorrentHttpServer(PORT, session, downloadDir, this.authToken); // Pass Token
                server.start();
                Log.d(TAG, "HTTP Server started on port " + PORT);
            } catch (IOException e) {
                Log.e(TAG, "Server start error", e);
            }
        }
    }

    @ReactMethod
    public void addMagnet(String magnetUrl, Promise promise) {
        try {
            if (!session.isRunning()) {
                promise.reject("ENGINE_OFF", "Engine not started");
                return;
            }

            Log.d(TAG, "Adding magnet: " + magnetUrl);
            File downloadDir = new File(reactContext.getExternalFilesDir(null), "VibeTorrents");
            if (!downloadDir.exists())
                downloadDir.mkdirs();

            // Use AddTorrentParams for Magnet
            AddTorrentParams params = AddTorrentParams.parseMagnetUri(magnetUrl);
            params.setSavePath(downloadDir.getAbsolutePath());
            
            // SUPER-ENGINE: Handled via Brain Pulse (Priority Scheduling)

            // Direct SWIG call
            error_code ec = new error_code();
            session.swig().add_torrent(params.swig(), ec);

            if (ec.value() != 0) {
                Log.e(TAG, "SWIG add_torrent error: " + ec.message());
            }

            // Extract Hash
            String hash = null;
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("xt=urn:btih:([a-fA-F0-9]+)");
            java.util.regex.Matcher matcher = pattern.matcher(magnetUrl);
            if (matcher.find()) {
                hash = matcher.group(1).toLowerCase();
            }

            if (hash == null) {
                promise.reject("HASH_ERROR", "Could not extract hash from magnet");
                return;
            }

            // Default to "unknown" index until metadata.
            // But for backward compatibility/immediate playback attempt, we provide a
            // placeholder URL.
            // Ideally UI waits for metadata, calls getTorrentFiles, then getStreamUrl.
            // Returning simple hash map.
            com.facebook.react.bridge.WritableMap map = com.facebook.react.bridge.Arguments.createMap();
            map.putString("hash", hash);
            // Default URL for immediate play attempts (Server will need to handle "no
            // index" or Client must wait)
            // Strategy: Client SHOULD wait for metadata.
            // We return "url" as empty to signal "Fetch Metadata First" or return a "Master
            // Playlist" equivalent?
            // Let's return the old style URL for now as a fallback, but the server will
            // require index eventually.
            // Actually, let's keep the OLD URL format valid for "Auto Select Largest" if
            // the server supports it,
            // OR strictly force the client to use the new API.
            // User asked for "Strict".
            // So we return NO URL here. The client must call getStreamUrl(hash, index).
            map.putString("url", "");

            promise.resolve(map);
        } catch (Exception e) {
            Log.e(TAG, "Add Magnet Error", e);
            promise.reject("ADD_ERROR", e);
        }
    }

    @ReactMethod
    public void getTorrentFiles(String hash, Promise promise) {
        try {
            if (!session.isRunning()) {
                promise.reject("ENGINE_OFF", "Engine not started");
                return;
            }

            org.libtorrent4j.swig.torrent_handle_vector v = session.swig().get_torrents();
            long size = v.size();
            for (long i = 0; i < size; i++) {
                org.libtorrent4j.swig.torrent_handle th_swig = v.get((int) i);
                if (th_swig.is_valid() && th_swig.info_hash().to_hex().equalsIgnoreCase(hash)) {
                    TorrentHandle th = new TorrentHandle(th_swig);
                    if (th.status().hasMetadata()) {
                        TorrentInfo ti = th.torrentFile();
                        if (ti != null) {
                            org.libtorrent4j.FileStorage fs = ti.files();
                            int numFiles = fs.numFiles();
                            com.facebook.react.bridge.WritableArray files = com.facebook.react.bridge.Arguments
                                    .createArray();

                            for (int j = 0; j < numFiles; j++) {
                                com.facebook.react.bridge.WritableMap fileMap = com.facebook.react.bridge.Arguments
                                        .createMap();
                                fileMap.putInt("index", j);
                                fileMap.putString("name", fs.fileName(j));
                                fileMap.putDouble("size", (double) fs.fileSize(j));
                                files.pushMap(fileMap);
                            }
                            promise.resolve(files);
                            return;
                        }
                    }
                }
            }
            promise.resolve(com.facebook.react.bridge.Arguments.createArray()); // Empty if not found/no metadata
        } catch (Exception e) {
            promise.reject("FILES_ERROR", e);
        }
    }

    @ReactMethod
    public void getStreamUrl(String hash, int fileIndex, Promise promise) {
        // Strict URL Generation
        String url = "http://127.0.0.1:" + PORT + "/stream/" + hash + "/" + fileIndex + "?t=" + this.authToken;
        promise.resolve(url);
    }

    @ReactMethod
    public void getTorrentStatus(String hash, Promise promise) {
        try {
            boolean ready = false;
            double progress = 0.0;
            String state = "idle";
            int seeds = 0;
            int peers = 0;
            int downloadRate = 0;
            int uploadRate = 0;

            if (session.isRunning() && hash != null) {
                org.libtorrent4j.swig.torrent_handle_vector v = session.swig().get_torrents();
                long size = v.size();
                for (long i = 0; i < size; i++) {
                    org.libtorrent4j.swig.torrent_handle th_swig = v.get((int) i);
                    if (th_swig.is_valid() && th_swig.info_hash().to_hex().equalsIgnoreCase(hash)) {
                        TorrentHandle th = new TorrentHandle(th_swig);
                        org.libtorrent4j.TorrentStatus statusObj = th.status(); // Snapshot

                        state = statusObj.hasMetadata() ? "downloading" : "metaDL";
                        progress = statusObj.progress();

                        // Real Stats
                        // Note: libtorrent4j status object might need swig cast for full fields or use
                        // wrappers
                        // Checking available methods in standard libtorrent4j wrapper...
                        // .status() returns TorrentStatus wrapper which has a swig() method
                        org.libtorrent4j.swig.torrent_status ts = statusObj.swig();
                        downloadRate = ts.getDownload_payload_rate();
                        uploadRate = ts.getUpload_payload_rate();
                        seeds = ts.getList_seeds(); // Or num_seeds depending on version
                        peers = ts.getList_peers();

                        if (statusObj.hasMetadata()) {
                            // Smart Ready Check: Do we have the first pieces of the main file?
                            TorrentInfo ti = th.torrentFile();
                            if (ti != null) {
                                org.libtorrent4j.FileStorage fs = ti.files();
                                int numFiles = fs.numFiles();
                                long maxSize = -1;
                                int bestIndex = -1;
                                for (int j = 0; j < numFiles; j++) {
                                    if (fs.fileSize(j) > maxSize) {
                                        String name = fs.fileName(j).toLowerCase();
                                        if (name.endsWith(".mp4") || name.endsWith(".mkv") || name.endsWith(".avi")) {
                                            maxSize = fs.fileSize(j);
                                            bestIndex = j;
                                        }
                                    }
                                }

                                if (bestIndex != -1) {
                                    long fileOffset = fs.fileOffset(bestIndex);
                                    int pieceSize = ti.pieceLength();
                                    int startPiece = (int) (fileOffset / pieceSize);

                                    // Check first 3 pieces (approx 2-12MB buffer depending on piece size)
                                    boolean bufferReady = true;
                                    for (int p = 0; p < 3; p++) {
                                        if (!th.havePiece(startPiece + p)) {
                                            bufferReady = false;
                                            break;
                                        }
                                    }

                                    if (bufferReady) {
                                        ready = true;
                                        state = "ready";
                                    } else {
                                        state = "buffering";
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }

            com.facebook.react.bridge.WritableMap status = com.facebook.react.bridge.Arguments.createMap();
            status.putString("state", state);
            status.putDouble("progress", progress);
            status.putBoolean("ready", ready);
            status.putInt("seeds", seeds);
            status.putInt("peers", peers);
            status.putInt("downloadRate", downloadRate);
            status.putInt("uploadRate", uploadRate);

            promise.resolve(status);
        } catch (Exception e) {
            promise.reject("STATUS_ERROR", e);
        }
    }

    @ReactMethod
    public void setPulse(String hash, int fileIndex, double bytePosition, Promise promise) {
        // "Pulse" logic: Proactive Piece Scheduling triggered by UI Position Updates
        try {
            if (!session.isRunning()) {
                promise.resolve(false);
                return;
            }

            // 1. Find Handle
            org.libtorrent4j.swig.torrent_handle_vector v = session.swig().get_torrents();
            long size = v.size();
            for (long i = 0; i < size; i++) {
                org.libtorrent4j.swig.torrent_handle th_swig = v.get((int) i);
                if (th_swig.is_valid() && th_swig.info_hash().to_hex().equalsIgnoreCase(hash)) {
                    TorrentHandle th = new TorrentHandle(th_swig);
                    TorrentInfo ti = th.torrentFile();

                    if (ti != null) {
                        org.libtorrent4j.FileStorage fs = ti.files();
                        if (fileIndex >= 0 && fileIndex < fs.numFiles()) {
                            long fileOffset = fs.fileOffset(fileIndex);
                            int pieceSize = ti.pieceLength();

                            // 2. Map Byte Position to Absolute Torrent Offset
                            long absoluteStart = fileOffset + (long) bytePosition;
                            long absoluteEnd = absoluteStart + 10 * 1024 * 1024; // +10MB Read Ahead

                            int startPiece = (int) (absoluteStart / pieceSize);
                            int endPiece = (int) (absoluteEnd / pieceSize);

                            // 3. Apply The Brain (Priority Scheduling)
                            // Log.d(TAG, "Brain Pulse: " + startPiece + " -> " + endPiece);

                            int MAX_AHEAD = 32; // Limit pulse aggression
                            if (endPiece - startPiece > MAX_AHEAD)
                                endPiece = startPiece + MAX_AHEAD;

                            for (int p = startPiece; p <= endPiece; p++) {
                                if (p <= startPiece + 3) {
                                    th.setPieceDeadline(p, 800); // Urgent
                                } else {
                                    th.setPieceDeadline(p, 3000); // Steady Prefetch
                                }
                            }
                            promise.resolve(true);
                            return;
                        }
                    }
                    break;
                }
            }
            promise.resolve(false);
        } catch (Exception e) {
            promise.reject("PULSE_ERROR", e);
        }
    }
}
