import React from 'react';
import {
    Image,
    ImageStyle,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ContentItem } from '../services/TmdbService';
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
    const [imageError, setImageError] = React.useState(false);

    return (
        <Focusable
            onPress={() => onPress(item)}
            onFocus={onFocus}
            style={[styles.container, { width, height }]}
            focusedStyle={styles.focusedState}
            scaleFactor={1.4}
        >
            <View style={styles.inner}>
                {item.poster_path && !imageError ? (
                    <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w500/${item.poster_path}` }}
                        style={styles.poster as ImageStyle}
                        resizeMode="cover"
                        onError={(e) => {
                            console.log('[MovieCard] Image Load Error:', e.nativeEvent.error);
                            setImageError(true);
                        }}
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
