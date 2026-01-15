import React from 'react';
import {
    Image,
    ImageStyle,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ContentItem } from '../services/TmdbService';
import { ProxyService } from '../services/ProxyService';
import { Colors, Spacing } from '../theme/theme';
import { Focusable } from './Focusable';

interface MovieCardProps {
    item: ContentItem;
    onPress: (item: ContentItem) => void;
    onFocus?: () => void;
    width?: number;
    height?: number;
}

export const MovieCard: React.FC<MovieCardProps> = ({
    item,
    onPress,
    onFocus,
    width = 120,
    height = 180
}) => {
    // 0: Elite, 1: Fallback (wsrv), 2: Placeholder
    const [imageLevel, setImageLevel] = React.useState(0);

    const handleImageError = () => {
        if (imageLevel < 2) {
            console.log(`[MovieCard] Fallback level ${imageLevel} -> ${imageLevel + 1} for:`, item.title);
            setImageLevel(imageLevel + 1);
        }
    };

    const getUri = () => {
        if (!item.poster_path) return null;
        if (imageLevel === 0) return ProxyService.getProxiedImageUrl(item.poster_path);
        if (imageLevel === 1) return ProxyService.getFallbackImageUrl(item.poster_path);
        return null;
    };

    const uri = getUri();

    return (
        <Focusable
            onPress={() => onPress(item)}
            onFocus={onFocus}
            style={[styles.container, { width, height }]}
            focusedStyle={styles.focusedState}
            scaleFactor={1.4}
        >
            <View style={styles.inner}>
                {uri ? (
                    <Image
                        source={{ uri }}
                        style={styles.poster as ImageStyle}
                        resizeMode="cover"
                        onError={handleImageError}
                    />
                ) : (
                    <View style={[styles.poster, styles.placeholder]}>
                        <Text style={styles.placeholderText} numberOfLines={3}>
                            {item.title}
                        </Text>
                    </View>
                )}
            </View>
        </Focusable>
    );
};

const styles = StyleSheet.create({
    container: {
        marginRight: Spacing.xl, // Increased from m (16) to xl (32)
        borderRadius: 16, // Match Focusable base radius
        backgroundColor: Colors.surface,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    focusedState: {
        borderColor: Colors.primary,
        borderWidth: 4,
        borderRadius: 16, // Match container (Outer Radius)
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 20,
        elevation: 20,
    },
    inner: {
        flex: 1,
        borderRadius: 12, // Match container
        overflow: 'hidden',
    },
    poster: {
        width: '100%',
        height: '100%',
        backgroundColor: Colors.surface,
        borderRadius: 12, // Force radius on Image for Android
    },
    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        flex: 1,
    },
    placeholderText: {
        color: Colors.text.secondary,
        fontSize: 12,
        textAlign: 'center',
        padding: 4,
    },
});
