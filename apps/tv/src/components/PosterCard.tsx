/**
 * PosterCard.tsx
 * @FrontendSquad - MVP Resurrection: UI Resilience
 * 
 * Android TV Master Skill Applied:
 * ✅ Focus management via Focusable wrapper
 * ✅ Animated scale (1.0 -> 1.1) with native driver
 * ✅ onError handler -> fallback to local placeholder
 * ✅ shouldRasterizeIOS for layer optimization
 * ✅ Memo for preventing re-renders during rapid D-pad navigation
 */
import React, { memo, useCallback, useState } from 'react';
import {
    Image,
    ImageStyle,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { ContentItem, getImageUrl } from '../services/TmdbService';
import { Colors, Spacing } from '../theme/theme';
import { Focusable } from './Focusable';

// ============================================================
// TYPES
// ============================================================
interface PosterCardProps {
    /** Content item with poster_path and title */
    item: ContentItem;
    /** Callback when card is pressed */
    onPress: (item: ContentItem) => void;
    /** Optional callback when card receives focus */
    onFocus?: () => void;
    /** Card width in pixels (default: 150) */
    width?: number;
    /** Card height in pixels (default: 225) - 2:3 poster ratio */
    height?: number;
    /** Focus scale factor (default: 1.1 per Android TV Master) */
    scaleFactor?: number;
    /** Test ID for automation */
    testID?: string;
}

// ============================================================
// CONSTANTS
// ============================================================
const DEFAULT_WIDTH = 150;
const DEFAULT_HEIGHT = 225; // 2:3 poster aspect ratio
const DEFAULT_SCALE_FACTOR = 1.1;

// ============================================================
// COMPONENT
// ============================================================
const PosterCardComponent: React.FC<PosterCardProps> = ({
    item,
    onPress,
    onFocus,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    scaleFactor = DEFAULT_SCALE_FACTOR,
    testID,
}) => {
    // 0: Elite, 1: Fallback (wsrv), 2: Placeholder
    const [imageLevel, setImageLevel] = useState(0);

    // Stable callback refs to prevent re-renders
    const handlePress = useCallback(() => {
        onPress(item);
    }, [onPress, item]);

    const handleImageError = useCallback(() => {
        if (imageLevel < 2) {
            console.log(`[PosterCard] Fallback level ${imageLevel} -> ${imageLevel + 1} for:`, item.title);
            setImageLevel(imageLevel + 1);
        }
    }, [imageLevel, item.title]);

    const getUri = () => {
        if (!item.poster_path) return null;
        const { ProxyService } = require('../services/ProxyService');
        if (imageLevel === 0) return ProxyService.getProxiedImageUrl(item.poster_path);
        if (imageLevel === 1) return ProxyService.getFallbackImageUrl(item.poster_path);
        return null;
    };

    const imageUri = getUri();

    return (
        <Focusable
            onPress={handlePress}
            onFocus={onFocus}
            style={[styles.container, { width, height }]}
            focusedStyle={styles.focusedState}
            scaleFactor={scaleFactor}
            testID={testID}
        >
            <View
                style={styles.inner}
                // iOS: Rasterize the layer for GPU-cached rendering
                // Critical for smooth 60fps focus animations on Apple TV
                shouldRasterizeIOS={true}
            >
                {imageUri ? (
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.poster as ImageStyle}
                        resizeMode="cover"
                        onError={handleImageError}
                        // Android: Prevent overdraw by not drawing areas behind
                        fadeDuration={0}
                    />
                ) : (
                    <PlaceholderView title={item.title} />
                )}
            </View>
        </Focusable>
    );
};

// ============================================================
// PLACEHOLDER COMPONENT (Memoized)
// ============================================================
interface PlaceholderProps {
    title: string;
}

const PlaceholderView: React.FC<PlaceholderProps> = memo(({ title }) => (
    <View style={[styles.poster, styles.placeholder]}>
        {/* Placeholder icon */}
        <Text style={styles.placeholderIcon}>🎬</Text>
        <Text style={styles.placeholderText} numberOfLines={3}>
            {title}
        </Text>
    </View>
));

PlaceholderView.displayName = 'PlaceholderView';

// ============================================================
// MEMOIZED EXPORT
// Prevents re-renders during rapid D-pad navigation
// Only re-renders if item.id changes or focus state changes
// ============================================================
export const PosterCard = memo(PosterCardComponent, (prevProps, nextProps) => {
    // Custom comparison: only re-render if meaningful props change
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.width === nextProps.width &&
        prevProps.height === nextProps.height &&
        prevProps.scaleFactor === nextProps.scaleFactor
    );
});

PosterCard.displayName = 'PosterCard';

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
    container: {
        marginRight: Spacing.l,
        borderRadius: 12,
        backgroundColor: Colors.surface,
        // Shadow for depth (subtle)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    } as ViewStyle,

    focusedState: {
        borderColor: Colors.primary,
        borderWidth: 3,
        borderRadius: 12,
        // "Neon Glow" effect for focused state
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 25,
        elevation: 25,
    } as ViewStyle,

    inner: {
        flex: 1,
        borderRadius: 10, // Slightly smaller than container for border inset
        overflow: 'hidden',
    } as ViewStyle,

    poster: {
        width: '100%',
        height: '100%',
        backgroundColor: Colors.surface,
    } as ViewStyle,

    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    } as ViewStyle,

    placeholderIcon: {
        fontSize: 36,
        marginBottom: 8,
        opacity: 0.6,
    },

    placeholderText: {
        color: Colors.text.secondary,
        fontSize: 13,
        textAlign: 'center',
        paddingHorizontal: 8,
        fontWeight: '500',
    },
});
