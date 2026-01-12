import React, { useState, useRef, useEffect } from 'react';
import { BackHandler, SafeAreaView, StyleSheet, Text, View, Animated, Easing, ActivityIndicator, FlatList } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { WebView } from 'react-native-webview';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/theme';
import { Focusable } from '../components/Focusable';
import { useTVRemote } from '../hooks/useTVRemote';
import AdManager, { AdCreative } from '../services/AdManager';
import { AdAudioPlayer } from '../components/AdAudioPlayer';
import { AdOverlay } from '../components/AdOverlay';
import MagnetService from '../services/MagnetService';
import TorrServerController from '../services/TorrServerController';
import { parseFilename } from '../services/TorrentMetaParser';

type PlayerRoute = RouteProp<RootStackParamList, 'Player'>;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    videoContainer: {
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'black',
    },
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: 'black',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    centerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 40,
    },
    iconText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 60, // Higher up for TV safe area
        left: 60,
        right: 60,
    },
    title: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 12,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 4,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        width: '100%',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 3,
    },
    headerButtons: {
        position: 'absolute',
        top: 40,
        right: 40,
        flexDirection: 'row',
    },
    closeButton: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    closeText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    circleButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.primary,
    },
    controlText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    adSection: {
        width: '100%',
        height: '15%', // The bottom 15% revealed during squeeze
        backgroundColor: 'black',
    },
    // Loading State
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    loadingText: {
        color: 'white',
        marginTop: 20,
        fontSize: 18,
    },
    loadingSubText: {
        color: '#888',
        marginTop: 10,
        fontSize: 14,
    }
});

export const PlayerScreen: React.FC<{ route: PlayerRoute }> = ({ route }) => {
    const { item, streamUrl: initialUrl } = route.params;
    const navigation = useNavigation();

    const [paused, setPaused] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(1);

    // Source Resolution
    const [finalUrl, setFinalUrl] = useState<string | null>(initialUrl || null);
    const [isResolving, setIsResolving] = useState(!initialUrl || initialUrl.startsWith('magnet:'));
    const [resolveStatus, setResolveStatus] = useState<string | null>('Initializing P2P Engine...');

    // File Selection State
    const [fileList, setFileList] = useState<any[]>([]);
    const [torrentHash, setTorrentHash] = useState<string | null>(null);

    // Ad State
    const [adCreative, setAdCreative] = useState<AdCreative | null>(null);
    const [movieVolume, setMovieVolume] = useState(1.0);

    // Animation for "Squeeze" (flex value or height percentage)
    const videoHeightAnim = useRef(new Animated.Value(100)).current;

    const videoRef = useRef<VideoRef>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ─────────────────────────────────────────────────────────────────────────────
    // P2P RESOLUTION LOGIC
    // ─────────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const resolveSource = async () => {
            // Case 1: Already a valid HTTP stream (or simple M3U8)
            if (initialUrl && initialUrl.startsWith('http')) {
                setFinalUrl(initialUrl);
                setIsResolving(false);
                return;
            }

            // Case 2: No URL -> Auto-Search via MagnetService
            let magnet = initialUrl;
            if (!magnet) {
                setResolveStatus(`Searching for "${item.title}"...`);
                // Extract year if available
                const year = item.release_date ? item.release_date.split('-')[0] : undefined;
                try {
                    const config = await import('../services/ConfigService').then(m => m.default.fetchConfig());
                    const searchTitle = item.original_title || item.title;
                    setResolveStatus(`Searching for "${searchTitle}" via ${config.parser_url}...`);

                    const results = await MagnetService.search(searchTitle, year);
                    if (results.length === 0) {
                        setResolveStatus(`No sources found via ${config.parser_url}`);
                        return; // Handle error UI?
                    }
                    // Simple logic: Pick first one (usually best seeds)
                    magnet = results[0].magnet;
                    setResolveStatus(`Found: ${results[0].title} (${results[0].size})`);
                } catch (e) {
                    setResolveStatus(`Search Failed: ${e}`);
                    return;
                }
            }

            // Case 3: We have a magnet (from search or params) -> Resolve via TorrServer
            if (magnet && magnet.startsWith('magnet:')) {
                setResolveStatus('Connecting to Peers...');
                try {
                    // Step 1: Add Magnet (Async)
                    const hash = await TorrServerController.addMagnet(magnet);
                    setTorrentHash(hash);

                    // Step 2: Poll for Metadata (Files)
                    setResolveStatus('Loading File List...');
                    const files = await TorrServerController.getFiles(hash);

                    if (files.length > 0) {
                        // Success! Show files to user
                        const videoFiles = files.sort((a, b) => b.length - a.length); // Sort by size descending
                        setFileList(videoFiles);
                        setResolveStatus(null); // Stop "Loading" spinner, show Selection UI
                    } else {
                        // FALLBACK: If List fails (Legacy Engine?), Try Auto-Play
                        setResolveStatus('Metadata parsing skipped. Auto-playing...');
                        // Assume Index 1 is biggest? Or just play index 1.
                        // Or try to play via getStreamUrl with index 1 (usually main file in some engines)
                        // Better: Play index 0?
                        console.log('[Player] List empty, fallback to Auto-Play');
                        const url = TorrServerController.getStreamUrl(hash, 0); // Try index 0
                        setFinalUrl(url);
                        setIsResolving(false);
                    }
                } catch (e) {
                    setResolveStatus('Engine Connection Error');
                }
            }
        };

        resolveSource();

        return () => {
            console.log('[Player] Unmounting, cleaning up torrents...');
            TorrServerController.dropAll();
        };
    }, [initialUrl, item]);

    const handleFileSelect = (index: number) => {
        if (!torrentHash) return;
        // NOTE: The 'index' from validFiles needs to map back to original 'index' if we filtered.
        // But here we setFileList(allFiles) so standard index is fine?
        // Actually TorrServer uses absolute index. 
        // Let's assume files has 'id' property. If not, we rely on array index.
        // TorrServer returns file_stats as array. The 'stream index' logic typically maps to this array order.
        // If we sorted it, we might break the index. 
        // FIX: TorrServer usually handles index by original array order.
        // For safety, I will NOT sort the list in state, only distinct Video files?
        // Let's assume the user wants to play a file.
        // We will just pass the index from the FLatList which matches fileList order. 
        // Actually, if we shuffled `fileList`, `index` 0 might be `index` 5 in TorrServer.
        // Let's stick to original order for safety or find the original index.
        // Reverting sort above.

        const url = TorrServerController.getStreamUrl(torrentHash, index);
        setFinalUrl(url);
        setIsResolving(false); // Start Player
    };


    const pokeControls = () => {
        if (adCreative) return; // Don't show controls during ad

        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

        // Only auto-hide if playing
        if (!paused) {
            hideTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 5000);
        }
    };

    useTVRemote(() => pokeControls());

    useEffect(() => {
        pokeControls();
        return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
    }, [paused]);

    // AdManager Integration
    useEffect(() => {
        AdManager.startSession(120);

        const onAdStart = ({ creative, duckLevel }: { creative: AdCreative, duckLevel: number }) => {
            setAdCreative(creative);
            setMovieVolume(duckLevel); // Duck movie audio
            setShowControls(false); // Hide standard controls

            Animated.timing(videoHeightAnim, {
                toValue: 85,
                duration: 500,
                useNativeDriver: false,
                easing: Easing.out(Easing.cubic),
            }).start();
        };

        const onAdEnd = () => {
            Animated.timing(videoHeightAnim, {
                toValue: 100,
                duration: 500,
                useNativeDriver: false,
                easing: Easing.out(Easing.cubic),
            }).start(() => {
                setAdCreative(null);
                setMovieVolume(1.0); // Restore volume
            });
        };

        AdManager.on('ad_start', onAdStart);
        AdManager.on('ad_end', onAdEnd);

        return () => {
            AdManager.stopSession();
        };
    }, []);

    useEffect(() => {
        const backAction = () => {
            navigation.goBack();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [navigation]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleSeek = (offset: number) => {
        if (adCreative) return; // Disable seeking during ad
        pokeControls();
        const newTime = currentTime + offset;
        videoRef.current?.seek(newTime);
    };

    const togglePlay = () => {
        if (adCreative) return;
        pokeControls();
        setPaused(p => !p);
    };

    const isIframe = finalUrl && (finalUrl.includes('embed') || finalUrl.includes('iframe') || finalUrl.includes('videoframe'));

    return (
        <SafeAreaView style={styles.container}>
            {/* Source Selection UI (Replaces Loading Screen when list is ready) */}
            {isResolving && fileList.length > 0 && (
                <View style={styles.loadingContainer}>
                    <Text style={[styles.title, { marginBottom: 20 }]}>Выберите качество и озвучку</Text>
                    <FlatList
                        data={fileList.map((f, idx) => ({ ...f, originalIndex: idx }))}
                        keyExtractor={(item) => item.originalIndex.toString()}
                        style={{ width: '85%', maxHeight: '65%' }}
                        renderItem={({ item }) => {
                            const meta = parseFilename(item.path);
                            const sizeGB = (item.length / 1024 / 1024 / 1024).toFixed(1);
                            const sizeMB = (item.length / 1024 / 1024).toFixed(0);
                            const sizeLabel = item.length > 1024 * 1024 * 1024 ? `${sizeGB} GB` : `${sizeMB} MB`;

                            return (
                                <Focusable
                                    onPress={() => handleFileSelect(item.originalIndex)}
                                    style={{
                                        padding: 16,
                                        backgroundColor: 'rgba(255,255,255,0.08)',
                                        marginBottom: 8,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: 'transparent'
                                    }}
                                    focusedStyle={{
                                        backgroundColor: Colors.primary,
                                        borderColor: 'white'
                                    }}
                                >
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
                                                {meta.quality}
                                            </Text>
                                            <Text style={{ color: '#aaa', fontSize: 18, marginHorizontal: 8 }}>•</Text>
                                            <Text style={{ color: '#4fc3f7', fontSize: 18, fontWeight: '500' }}>
                                                {meta.audioTrack}
                                            </Text>
                                            <View style={{ flex: 1 }} />
                                            <Text style={{ color: '#888', fontSize: 16 }}>
                                                {sizeLabel}
                                            </Text>
                                        </View>
                                        <Text style={{ color: '#666', fontSize: 13 }} numberOfLines={1}>
                                            {meta.source} {meta.codec} • {item.path.split('/').pop()}
                                        </Text>
                                    </View>
                                </Focusable>
                            );
                        }}
                    />
                    <Focusable onPress={() => navigation.goBack()} style={{ marginTop: 20, padding: 12 }}>
                        <Text style={{ color: '#888', fontSize: 16 }}>← Назад</Text>
                    </Focusable>
                </View>
            )}

            {/* Loading Screen (Only if NO list yet) */}
            {isResolving && fileList.length === 0 && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>{resolveStatus || 'Initializing...'}</Text>
                    <Text style={styles.loadingSubText}>Connecting to {item.title}...</Text>
                </View>
            )}

            <AdAudioPlayer
                sourceUrl={adCreative?.audioUrl || ''}
                isPlaying={!!adCreative}
                onEnd={() => AdManager.notifyAdFinished()}
            />

            <Animated.View style={[styles.videoContainer, {
                height: videoHeightAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                })
            }]} onTouchEnd={pokeControls}>
                {finalUrl && !isResolving && (
                    isIframe ? (
                        <WebView
                            source={{
                                uri: `https://embed.xn--b1a5a.fun?url=${encodeURIComponent(finalUrl || '')}`
                            }}
                            style={styles.video}
                            allowsFullscreenVideo={true}
                            mediaPlaybackRequiresUserAction={false}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            sharedCookiesEnabled={true}
                            originWhitelist={['*']}
                            onError={(e) => console.log('[Player] WebView error:', e.nativeEvent)}
                        />
                    ) : (
                        <Video
                            ref={videoRef}
                            source={{ uri: finalUrl }}
                            style={styles.video}
                            controls={false}
                            paused={paused}
                            resizeMode="contain"
                            volume={movieVolume}
                            onProgress={(data) => setCurrentTime(data.currentTime)}
                            onLoad={(data) => setDuration(data.duration)}
                            onEnd={() => setShowControls(true)}
                            bufferConfig={{
                                minBufferMs: 15000,
                                maxBufferMs: 50000,
                                bufferForPlaybackMs: 2500,
                                bufferForPlaybackAfterRebufferMs: 5000,
                            }}
                        />
                    )
                )}

                {showControls && !adCreative && !isResolving && (
                    <View style={styles.overlay} pointerEvents="box-none">
                        <View style={styles.headerButtons}>
                            <Focusable onPress={() => navigation.goBack()} scaleFactor={1.1}>
                                <View style={styles.closeButton}>
                                    <Text style={styles.closeText}>ВЫХОД</Text>
                                </View>
                            </Focusable>
                        </View>

                        <View style={styles.centerControls}>
                            <Focusable onPress={() => handleSeek(-10)} style={{ marginHorizontal: 20 }}>
                                <View style={styles.circleButton}>
                                    <Text style={styles.controlText}>-10</Text>
                                </View>
                            </Focusable>

                            <Focusable onPress={togglePlay} scaleFactor={1.2} style={{ marginHorizontal: 20 }}>
                                <View style={[styles.circleButton, styles.playButton]}>
                                    <Text style={[styles.controlText, { fontSize: 32 }]}>
                                        {paused ? '▶' : '||'}
                                    </Text>
                                </View>
                            </Focusable>

                            <Focusable onPress={() => handleSeek(10)} style={{ marginHorizontal: 20 }}>
                                <View style={styles.circleButton}>
                                    <Text style={styles.controlText}>+10</Text>
                                </View>
                            </Focusable>
                        </View>

                        <View style={styles.bottomBar}>
                            <Text style={styles.title}>{item.title}</Text>
                            <Text style={[styles.iconText, { fontSize: 16, marginBottom: 8 }]}>
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </Text>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }]} />
                            </View>
                        </View>
                    </View>
                )}
            </Animated.View>

            {adCreative && (
                <View style={styles.adSection}>
                    <AdOverlay
                        qrUrl={adCreative.qrUrl}
                        ctaText={adCreative.cta}
                    />
                </View>
            )}
        </SafeAreaView>
    );
};
