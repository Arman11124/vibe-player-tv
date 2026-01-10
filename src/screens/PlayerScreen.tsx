import React, { useState, useRef, useEffect } from 'react';
import { BackHandler, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { WebView } from 'react-native-webview';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/theme';
import { Focusable } from '../components/Focusable';
import { useTVRemote } from '../hooks/useTVRemote';

type PlayerRoute = RouteProp<RootStackParamList, 'Player'>;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    video: {
        width: '100%',
        height: '100%',
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
});

// Removed ControlId and activeControl state. Relying on Native Focus.

export const PlayerScreen: React.FC<{ route: PlayerRoute }> = ({ route }) => {
    const { item, streamUrl } = route.params;
    const navigation = useNavigation();

    const [paused, setPaused] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(1);

    const videoRef = useRef<VideoRef>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const pokeControls = () => {
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
        pokeControls();
        const newTime = currentTime + offset;
        videoRef.current?.seek(newTime);
    };

    const togglePlay = () => {
        pokeControls();
        setPaused(p => !p);
    };

    // Detect if URL is an iframe (embed) or direct stream
    const isIframe = streamUrl && (streamUrl.includes('embed') || streamUrl.includes('iframe') || streamUrl.includes('videoframe'));

    return (
        <SafeAreaView style={styles.container}>
            <View style={StyleSheet.absoluteFill} onTouchEnd={pokeControls}>
                {isIframe ? (
                    // WebView loads our proxy page which embeds the Vibix iframe
                    // This ensures correct Referer header for Vibix domain verification
                    <WebView
                        source={{
                            uri: `https://embed.xn--b1a5a.fun?url=${encodeURIComponent(streamUrl || '')}`
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
                    // Native Video for direct streams
                    <Video
                        ref={videoRef}
                        source={{ uri: streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }}
                        style={styles.video}
                        controls={false}
                        paused={paused}
                        resizeMode="contain"
                        onProgress={(data) => setCurrentTime(data.currentTime)}
                        onLoad={(data) => setDuration(data.duration)}
                        onEnd={() => setShowControls(true)}
                    />
                )}
            </View>

            {showControls && (
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
                            <View style={[styles.progressBarFill, { width: `${(currentTime / duration) * 100}%` }]} />
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};
