import React, { useState, useRef, useEffect } from 'react';
import { BackHandler, SafeAreaView, StyleSheet, Text, View, Animated, Easing, ActivityIndicator } from 'react-native';
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
    const [resolveStatus, setResolveStatus] = useState('Initializing P2P Engine...');

    // Ad State
    const [adCreative, setAdCreative] = useState<AdCreative | null>(null);
    const [movieVolume, setMovieVolume] = useState(1.0);

    // Animation for "Squeeze" (flex value or height percentage)
    // Using height percentage animation: 100 -> 85
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
                    const results = await MagnetService.search(item.title, year);
                    if (results.length === 0) {
                        setResolveStatus('No sources found.');
                        return; // Handle error UI?
                    }
                    // Simple logic: Pick first one (usually best seeds)
                    magnet = results[0].magnet;
                    setResolveStatus(`Found: ${results[0].title} (${results[0].size})`);
                } catch (e) {
                    setResolveStatus('Search Failed');
                    return;
                }
            }

            // Case 3: We have a magnet (from search or params) -> Resolve via TorrServer
            if (magnet && magnet.startsWith('magnet:')) {
                setResolveStatus('Starting P2P Stream...');
                try {
                    const streamLink = await TorrServerController.playMagnet(magnet);
                    if (streamLink) {
                        setFinalUrl(streamLink);
                        setIsResolving(false);
                    } else {
                        setResolveStatus('TorrServer Error: Could not resolve file.');
                    }
                } catch (e) {
                    setResolveStatus('Engine Error');
                }
            }
        };

        resolveSource();
    }, [initialUrl, item]);


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
        // Init AdManager session
        AdManager.startSession(120);

        const onAdStart = ({ creative, duckLevel }: { creative: AdCreative, duckLevel: number }) => {
            setAdCreative(creative);
            setMovieVolume(duckLevel); // Duck movie audio
            setShowControls(false); // Hide standard controls

            // Animate Squeeze: 100% -> 85%
            Animated.timing(videoHeightAnim, {
                toValue: 85,
                duration: 500,
                useNativeDriver: false,
                easing: Easing.out(Easing.cubic),
            }).start();
        };

        const onAdEnd = () => {
            // Animate Restore: 85% -> 100%
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

    // Detect if URL is an iframe (embed) or direct stream
    const isIframe = finalUrl && (finalUrl.includes('embed') || finalUrl.includes('iframe') || finalUrl.includes('videoframe'));

    return (
        <SafeAreaView style={styles.container}>
            {/* Loading Screen */}
            {isResolving && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Opening Engine...</Text>
                    <Text style={styles.loadingSubText}>{resolveStatus}</Text>
                </View>
            )}

            {/* Audio Player for Ads (Invisible) */}
            <AdAudioPlayer
                sourceUrl={adCreative?.audioUrl || ''}
                isPlaying={!!adCreative}
                onEnd={() => AdManager.notifyAdFinished()}
            />

            {/* Main Video Container with Squeeze Animation */}
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

                            // 🚀 PERFORMANCE TUNING FOR 4K + P2P
                            bufferConfig={{
                                minBufferMs: 15000,
                                maxBufferMs: 50000,
                                bufferForPlaybackMs: 2500,
                                bufferForPlaybackAfterRebufferMs: 5000,
                            }}

                            // 🚀 TUNELING (Android TV Only)
                            // Allows video to bypass standard Android media stack
                            // Tunneled renderers write directly to the hardware video path.
                            tunnelingEnabled={true}
                        />
                    )
                )}

                {/* Standard Controls Overlay */}
                {showControls && !adCreative && !isResolving && (
                    <View style={styles.overlay} pointerEvents="box-none">
                        {/* Top Right Close Button */}
                        <View style={styles.headerButtons}>
                            <Focusable onPress={() => navigation.goBack()} scaleFactor={1.1}>
                                <View style={styles.closeButton}>
                                    <Text style={styles.closeText}>ВЫХОД</Text>
                                </View>
                            </Focusable>
                        </View>

                        {/* Center Replay / Play / Forward */}
                        <View style={styles.centerControls}>
                            {/* Rewind */}
                            <Focusable onPress={() => handleSeek(-10)} style={{ marginHorizontal: 20 }}>
                                <View style={styles.circleButton}>
                                    <Text style={styles.controlText}>-10</Text>
                                </View>
                            </Focusable>

                            {/* Play/Pause */}
                            <Focusable onPress={togglePlay} scaleFactor={1.2} style={{ marginHorizontal: 20 }}>
                                <View style={[styles.circleButton, styles.playButton]}>
                                    <Text style={[styles.controlText, { fontSize: 32 }]}>
                                        {paused ? '▶' : '||'}
                                    </Text>
                                </View>
                            </Focusable>

                            {/* Forward */}
                            <Focusable onPress={() => handleSeek(10)} style={{ marginHorizontal: 20 }}>
                                <View style={styles.circleButton}>
                                    <Text style={styles.controlText}>+10</Text>
                                </View>
                            </Focusable>
                        </View>

                        {/* Bottom Progress */}
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

            {/* Ad Overlay Area (Revealed during squeeze) */}
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
