import React, { useState, useRef, useEffect } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    View,
    ScrollView,
    Dimensions,
    NativeSyntheticEvent,
    NativeScrollEvent
} from 'react-native';
import { ContentItem, getImageUrl } from '../services/TmdbService';
import { ProxyService } from '../services/ProxyService';
import { Colors, Spacing, Typography } from '../theme/theme';
import { Focusable } from './Focusable';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HeroSectionProps {
    items?: ContentItem[];
    item?: ContentItem;
    onPlayPress: (item: ContentItem) => void;
    hasTVPreferredFocus?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ items, item, onPlayPress, hasTVPreferredFocus }) => {
    // Normalize input to array
    const heroItems = items ? items : (item ? [item] : []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<ScrollView>(null);

    // Auto-scroll effect
    useEffect(() => {
        if (heroItems.length <= 1) return;

        const timer = setInterval(() => {
            const nextIndex = (currentIndex + 1) % heroItems.length;
            scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
            setCurrentIndex(nextIndex); // Optimistic update
        }, 5000); // 5 seconds

        return () => clearInterval(timer);
    }, [currentIndex, heroItems.length]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slideIndex = Math.ceil(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (slideIndex !== currentIndex) {
            setCurrentIndex(slideIndex);
        }
    };

    if (heroItems.length === 0) {
        return (
            <View style={{ width: SCREEN_WIDTH, height: 550, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: 'white' }}>Нет данных для отображения</Text>
            </View>
        );
    }

    const renderItem = (item: ContentItem, index: number) => {
        const path = item.backdrop_path || item.poster_path;

        // We handle fallback within the image source if needed, 
        // but for now let's just use the ProxyService's primary logic
        // and add a local state for fallback if we want to be hyper-resilient.
        const [imgError, setImgError] = useState(false);
        const backdropUrl = imgError
            ? (path ? `https://image.tmdb.org/t/p/w1280${path}` : null)
            : (path ? ProxyService.getProxiedImageUrl(path) : null);

        return (
            <View key={item.id} style={styles.slide}>
                {/* 1. Background Image */}
                {backdropUrl ? (
                    <Image
                        source={{ uri: backdropUrl }}
                        defaultSource={{ uri: 'https://via.placeholder.com/1280x720.png?text=Loading' }}
                        style={styles.backgroundImage}
                        resizeMode="cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <View style={[styles.backgroundImage, { backgroundColor: '#333' }]} />
                )}

                {/* 2. Gradient Overlay */}
                <View style={styles.overlay}>
                    <View style={styles.gradient} />
                </View>

                {/* 3. Content */}
                <View style={styles.contentContainer}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.overview} numberOfLines={8}>
                        {item.overview}
                    </Text>

                    <Focusable
                        onPress={() => onPlayPress(item)}
                        style={styles.button}
                        focusedStyle={styles.buttonFocused}
                        scaleFactor={1.05}
                        hasTVPreferredFocus={hasTVPreferredFocus && index === 0}
                    >
                        {({ focused }: { focused: boolean }) => (
                            <Text style={[
                                styles.buttonText,
                                focused && { color: 'black' }
                            ]}>
                                СМОТРЕТЬ
                            </Text>
                        )}
                    </Focusable>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.scrollView}
            >
                {heroItems.map((item, index) => renderItem(item, index))}
            </ScrollView>

            {/* Pagination Dots */}
            {heroItems.length > 1 && (
                <View style={styles.pagination}>
                    {heroItems.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentIndex && styles.activeDot
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 550,
        width: '100%',
    },
    scrollView: {
        flex: 1,
    },
    slide: {
        width: SCREEN_WIDTH,
        height: 550,
        position: 'relative',
        backgroundColor: '#1a1a1a',
    },
    backgroundImage: {
        ...StyleSheet.absoluteFillObject,
        width: SCREEN_WIDTH,
        height: 550,
        zIndex: 0,
        backgroundColor: '#333',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 1,
    },
    gradient: {
        flex: 1,
        backgroundColor: 'transparent',
        // Note: react-native-linear-gradient is preferred, but simple overlay works for now
    },
    contentContainer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        zIndex: 2,
    },
    title: {
        ...Typography.h1,
        marginBottom: 10,
        color: Colors.text.primary,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 5,
    },
    overview: {
        ...Typography.body,
        marginBottom: Spacing.l,
        maxWidth: '80%',
        color: '#ddd',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.m,
        borderRadius: 8,
        alignSelf: 'flex-start',
        elevation: 5,
    },
    buttonFocused: {
        backgroundColor: 'white',
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    buttonText: {
        ...Typography.label,
        fontSize: 16,
        color: 'white',
        fontWeight: 'bold',
    },
    pagination: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: 'white',
        width: 10,
        height: 10,
        borderRadius: 5,
    },
});
