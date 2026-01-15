import React from 'react';
import { View, StyleSheet, Text, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/theme';
import { Focusable } from '../components/Focusable';

type TrailerScreenRouteProp = RouteProp<RootStackParamList, 'Trailer'>;

export const TrailerScreen: React.FC = () => {
    const route = useRoute<TrailerScreenRouteProp>();
    const navigation = useNavigation();
    const { videoId, title } = route.params;

    React.useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            navigation.goBack();
            return true;
        });
        return () => backHandler.remove();
    }, [navigation]);

    // YouTube embed URL - nocookie for privacy and better compatibility
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=0`;

    return (
        <View style={styles.container}>
            {/* Close Button */}
            <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <Focusable
                    onPress={() => navigation.goBack()}
                    style={styles.closeButton}
                    focusedStyle={styles.closeButtonFocused}
                    hasTVPreferredFocus={true}
                >
                    <Text style={styles.closeText}>✕ Закрыть</Text>
                </Focusable>
            </View>

            {/* YouTube Player */}
            <WebView
                source={{ uri: embedUrl }}
                style={styles.webview}
                allowsFullscreenVideo={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mixedContentMode="compatibility"
                onError={(e) => console.log('[Trailer] WebView error:', e.nativeEvent)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.8)',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    title: {
        color: Colors.text.primary,
        fontSize: 24,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 20,
    },
    closeButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    closeButtonFocused: {
        backgroundColor: Colors.primary,
    },
    closeText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    webview: {
        flex: 1,
        backgroundColor: '#000',
    },
});
