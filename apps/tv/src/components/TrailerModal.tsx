/**
 * TrailerModal.tsx
 * Full-screen modal for playing YouTube trailers via WebView
 */

import React from 'react';
import {
    Modal,
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
    visible: boolean;
    trailerKey: string | null;
    onClose: () => void;
}

export const TrailerModal: React.FC<Props> = ({ visible, trailerKey, onClose }) => {
    // Handle hardware back button
    React.useEffect(() => {
        if (!visible) return;

        const backAction = () => {
            onClose();
            return true;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [visible, onClose]);

    if (!trailerKey) return null;

    // YouTube embed URL (no ads, autoplay)
    const youtubeUrl = `https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Close Button */}
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    activeOpacity={0.7}
                >
                    <Text style={styles.closeText}>✕ Закрыть</Text>
                </TouchableOpacity>

                {/* YouTube WebView */}
                <WebView
                    source={{ uri: youtubeUrl }}
                    style={styles.webview}
                    allowsFullscreenVideo={true}
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    closeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    webview: {
        flex: 1,
    },
});
