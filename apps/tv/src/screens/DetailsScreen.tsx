/**
 * DetailsScreen.tsx
 * Netflix-style movie/TV details with backdrop, trailer, and favorites
 */

import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Dimensions,
    ActivityIndicator,
    BackHandler,
    ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { BlurView } from '@react-native-community/blur';
import { RootStackParamList } from '../../App';
import { getMovieDetails, fetchRecommendations, MovieDetails, ContentType, ContentItem, getImageUrl } from '../services/TmdbService';
import { FavoritesService } from '../services/FavoritesService';
import { Focusable } from '../components/Focusable';
import { TrailerModal } from '../components/TrailerModal';
import { Swimlane } from '../components/Swimlane';
import { Colors } from '../theme/theme';
import { fetchConfig, AppConfig } from '../services/ConfigService';
import { executePlugin } from '../services/PluginService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BACKDROP_HEIGHT = SCREEN_HEIGHT * 0.7; // Increased backdrop height

type DetailsScreenNav = StackNavigationProp<RootStackParamList, 'Details'>;
type DetailsScreenRoute = RouteProp<RootStackParamList, 'Details'>;

interface Props {
    navigation: DetailsScreenNav;
    route: DetailsScreenRoute;
}

export const DetailsScreen: React.FC<Props> = ({ navigation, route }) => {
    const { movieId, mediaType = 'movie' } = route.params;

    const [details, setDetails] = useState<MovieDetails | null>(null);
    const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
    const [realRatings, setRealRatings] = useState<{ Source: string; Value: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFavorite, setIsFavorite] = useState(false);
    const [trailerVisible, setTrailerVisible] = useState(false);

    // Handle hardware back button (TV remote)
    useEffect(() => {
        const backAction = () => {
            navigation.goBack();
            return true; // Prevent default behavior
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [navigation]);

    // Load movie details & recommendations & ratings
    useEffect(() => {
        const loadDetails = async () => {
            console.log('[Details] Loading movie:', movieId);
            setLoading(true);
            setRealRatings([]); // Reset

            const [data, recs] = await Promise.all([
                getMovieDetails(movieId, mediaType as ContentType),
                fetchRecommendations(movieId, mediaType as ContentType)
            ]);

            setDetails(data);
            setRecommendations(recs);

            // Fetch External Ratings (Parallel)
            if (data) {
                const fetchPromises = [];

                // A) OMDb (IMDb, RT)
                if (data.imdb_id) {
                    fetchPromises.push(
                        import('../services/OmdbService')
                            .then(({ fetchRatings }) => fetchRatings(data.imdb_id!))
                    );
                } else {
                    fetchPromises.push(Promise.resolve([]));
                }

                // B) Kinopoisk
                const year = data.release_date ? data.release_date.split('-')[0] : undefined;
                fetchPromises.push(
                    import('../services/KinopoiskService')
                        .then(({ fetchKinopoiskRating }) => fetchKinopoiskRating(data.title, year))
                        .then(kpData => kpData ? { Source: 'Kinopoisk', Value: kpData.kp?.toFixed(1) || '?' } : null)
                        .catch(() => null)
                );

                Promise.all(fetchPromises).then(results => {
                    const omdbRatings = results[0] || [];
                    const kpRating = results[1];
                    let finalRatings = Array.isArray(omdbRatings) ? [...omdbRatings] : [];
                    if (kpRating) finalRatings.push(kpRating);
                    setRealRatings(finalRatings);
                });
            }

            setLoading(false);

            // Check favorite status
            const favStatus = await FavoritesService.isFavorite(movieId);
            setIsFavorite(favStatus);
        };
        loadDetails();
    }, [movieId, mediaType]);

    // Helper for Rating Colors
    const getRatingMeta = (source: string) => {
        if (source === 'Internet Movie Database') return { label: 'IMDb', color: 'black', bgColor: '#f5c518' };
        if (source === 'Rotten Tomatoes') return { label: '🍅', color: 'white', bgColor: 'rgba(255, 255, 255, 0.2)' };
        if (source === 'Kinopoisk') return { label: 'KP', color: 'white', bgColor: '#f60' };
        return { label: '★', color: 'white', bgColor: '#555' };
    };

    // Searching State
    const [isSearching, setIsSearching] = useState(false);

    // Handle Play button with Plugin Search
    const handlePlay = async () => {
        if (!details) return;

        setIsSearching(true);
        try {
            const config = await fetchConfig();
            let foundUrl: string | null = null;

            console.log('[Details] Searching plugins...', config.plugins);

            // 1. Try Vibix directly (Built-in handler)
            if (details.imdb_id) {
                console.log('[Details] Trying Vibix with IMDb:', details.imdb_id);
                foundUrl = await executePlugin('vibix', {
                    imdb_id: details.imdb_id,
                    tmdb_id: details.id,
                    title: details.title,
                    year: details.release_date?.split('-')[0],
                    type: details.media_type
                }, config);
            }

            // 2. If Vibix failed, try configured plugins
            if (!foundUrl) {
                for (const plugin of config.plugins || []) {
                    if (!plugin.active) continue;

                    foundUrl = await executePlugin(plugin.js_bundle_url, {
                        imdb_id: details.imdb_id,
                        tmdb_id: details.id,
                        title: details.title,
                        year: details.release_date?.split('-')[0],
                        type: details.media_type
                    }, config);

                    if (foundUrl) {
                        console.log('[Details] Source found:', plugin.name);
                        break;
                    }
                }
            }

            // 2. Navigate or Fail
            // 3. Always Navigate (Let PlayerScreen handle P2P search)
            navigation.navigate('Player', {
                item: {
                    id: details.id,
                    title: details.title,
                    original_title: details.original_title,
                    poster_path: details.poster_path,
                    backdrop_path: details.backdrop_path,
                    overview: details.overview,
                    vote_average: details.vote_average,
                    media_type: details.media_type,
                },
                streamUrl: foundUrl || '' // Pass empty string if null
            });

        } catch (e) {
            console.error('[Details] Play error:', e);
        } finally {
            setIsSearching(false);
        }
    };

    // Handle Trailer button - opens Yandex Video search (works in Russia without VPN)
    const handleTrailer = () => {
        if (details) {
            const searchQuery = encodeURIComponent(details.title + ' трейлер');
            console.log('[Details] Opening Yandex Video:', searchQuery);
            import('react-native').then(({ Linking }) => {
                Linking.openURL(`https://yandex.ru/video/search?text=${searchQuery}`);
            });
        }
    };

    // Handle Favorite toggle
    const handleFavorite = async () => {
        if (details) {
            const newStatus = await FavoritesService.toggleFavorite({
                id: details.id,
                title: details.title,
                poster_path: details.poster_path,
                backdrop_path: details.backdrop_path,
                overview: details.overview,
                vote_average: details.vote_average,
                media_type: details.media_type,
            });
            setIsFavorite(newStatus);
        }
    };

    // Handle Back
    const handleBack = () => {
        navigation.goBack();
    };

    // Handle Recommendation Press
    const handleRecommendationPress = (item: ContentItem) => {
        navigation.push('Details', {
            movieId: item.id,
            mediaType: item.media_type
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!details) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Не удалось загрузить данные</Text>
                <Focusable
                    onPress={handleBack}
                    style={styles.backButton}
                    focusedStyle={styles.backButtonFocused}
                    hasTVPreferredFocus
                >
                    <Text style={styles.buttonText}>← Назад</Text>
                </Focusable>
            </View>
        );
    }

    const backdropUri = getImageUrl(details.backdrop_path, 'original');

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Backdrop Image */}
                {backdropUri ? (
                    <Image
                        source={{ uri: backdropUri }}
                        style={styles.backdrop}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.backdrop, styles.backdropPlaceholder]} />
                )}

                {/* Gradient Overlay */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)', '#000000']}
                    style={styles.gradient}
                />

                {/* Main Content Area */}
                <View style={styles.content}>
                    {/* Left Side: Info */}
                    <View style={styles.infoSection}>
                        <Text style={styles.title} numberOfLines={2}>
                            {details.title}
                        </Text>

                        <View style={styles.metaRow}>
                            {/* Real Ratings Loop */}
                            {realRatings.filter(r => r.Source !== 'Error' && r.Source !== 'Kinopoisk').map(rating => {
                                const meta = getRatingMeta(rating.Source);
                                return (
                                    <View key={rating.Source} style={[styles.ratingBadge, { backgroundColor: meta.bgColor }]}>
                                        <Text style={[styles.ratingLabel, { color: meta.color }]}>{meta.label}</Text>
                                        <Text style={[styles.ratingValue, { color: meta.color }]}>{rating.Value}</Text>
                                    </View>
                                );
                            })}

                            {/* Kinopoisk (Real or Fallback) */}
                            {(() => {
                                const realKp = realRatings.find(r => r.Source === 'Kinopoisk');
                                // Fallback: Use TMDB vote_average if Real KP is missing
                                const rawValue = realKp ? realKp.Value : (details.vote_average || 0);
                                const numValue = parseFloat(String(rawValue));
                                const kpValue = numValue.toFixed(1);

                                if (kpValue === '0.0') return null;

                                return (
                                    <View style={[styles.ratingBadge, { backgroundColor: '#f60' }]}>
                                        <Text style={[styles.ratingLabel, { color: 'white' }]}>KP</Text>
                                        <Text style={[styles.ratingValue, { color: 'white' }]}>{kpValue}</Text>
                                    </View>
                                );
                            })()}

                            {/* Original TMDB Rating */}
                            <View style={[styles.ratingBadge, { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: '#FFD700', borderWidth: 1 }]}>
                                <Text style={styles.ratingStar}>⭐</Text>
                                <Text style={styles.ratingText}>{details.vote_average.toFixed(1)}</Text>
                            </View>

                            {details.release_date && (
                                <Text style={styles.metaText}>
                                    {details.release_date.substring(0, 4)}
                                </Text>
                            )}
                            {details.runtime > 0 && (
                                <Text style={styles.metaText}>{details.runtime} мин</Text>
                            )}
                            {/* HD Badge */}
                            <View style={styles.hdBadge}>
                                <Text style={styles.hdText}>HD</Text>
                            </View>
                        </View>

                        <Text style={styles.overview}>
                            {details.overview}
                        </Text>
                    </View>

                    {/* Right Side: Actions with Glass Effect */}
                    <View style={styles.actionsSection}>
                        {/* Video/Trailer Button (Replaces Back) */}
                        {details.trailerKey && (
                            <Focusable
                                onPress={handleTrailer}
                                style={styles.glassButton}
                                focusedStyle={styles.glassButtonFocused}
                                hasTVPreferredFocus
                            >
                                <BlurView
                                    style={styles.absoluteBlur}
                                    blurType="light"
                                    blurAmount={10}
                                    reducedTransparencyFallbackColor="rgba(229, 9, 20, 0.3)"
                                />
                                <Text style={styles.actionIcon}>🎬</Text>
                                <Text style={styles.actionLabel}>Трейлер</Text>
                            </Focusable>
                        )}

                        {/* Play Button (Solid Red) */}
                        <Focusable
                            onPress={handlePlay}
                            style={[styles.glassButton, styles.playButton]} // playButton overrides glass color
                            focusedStyle={styles.playButtonFocused}
                        >
                            {isSearching ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text style={styles.actionIcon}>▶</Text>
                                    <Text style={styles.actionLabel}>Смотреть</Text>
                                </>
                            )}
                        </Focusable>

                        {/* Favorite Button (Red Glass) */}
                        <Focusable
                            onPress={handleFavorite}
                            style={styles.glassButton}
                            focusedStyle={styles.glassButtonFocused}
                        >
                            <BlurView
                                style={styles.absoluteBlur}
                                blurType="light"
                                blurAmount={10}
                                reducedTransparencyFallbackColor="rgba(229, 9, 20, 0.3)"
                            />
                            <Text style={styles.actionIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
                            <Text style={styles.actionLabel}>
                                {isFavorite ? 'В избранном' : 'Избранное'}
                            </Text>
                        </Focusable>
                    </View>
                </View>

                {/* Recommendations Section */}
                <View style={styles.recommendationsContainer}>
                    {recommendations.length > 0 && (
                        <Swimlane
                            title="Похожие"
                            items={recommendations}
                            onItemPress={handleRecommendationPress}
                        />
                    )}
                </View>
            </ScrollView>

            {/* Trailer WebView Modal */}
            <TrailerModal
                visible={trailerVisible}
                trailerKey={details.trailerKey}
                onClose={() => setTrailerVisible(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 50,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        padding: 40,
    },
    errorText: {
        color: '#fff',
        fontSize: 20,
        marginBottom: 20,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_WIDTH,
        height: BACKDROP_HEIGHT,
    },
    backdropPlaceholder: {
        backgroundColor: '#1a1a1a',
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BACKDROP_HEIGHT + 100, // extend gradient further down
    },
    content: {
        flexDirection: 'row',
        paddingTop: BACKDROP_HEIGHT * 0.45,
        paddingHorizontal: 60,
        paddingBottom: 20,
        marginBottom: 20,
    },
    infoSection: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingRight: 40,
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 16,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    ratingLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        marginRight: 4,
    },
    ratingValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    ratingStar: {
        fontSize: 16,
        marginRight: 4,
    },
    ratingText: {
        fontSize: 18,
        color: '#FFD700',
        fontWeight: 'bold',
    },
    metaText: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
    },
    hdBadge: {
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.6)',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    hdText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: 'bold',
    },
    overview: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 28,
        maxWidth: '100%',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    actionsSection: {
        width: 250,
        justifyContent: 'flex-end',
        gap: 16,
    },
    glassButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        overflow: 'hidden', // Essential for BlurView
        borderWidth: 1,
        borderColor: 'rgba(229, 9, 20, 0.5)', // Red border
        backgroundColor: 'rgba(229, 9, 20, 0.3)', // Red tint glass
        height: 56,
    },
    glassButtonFocused: {
        borderColor: '#fff',
        transform: [{ scale: 1.05 }],
        backgroundColor: 'rgba(229, 9, 20, 0.6)', // Bright red highlight
    },
    absoluteBlur: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
    },
    playButton: {
        backgroundColor: Colors.primary, // Red overrides glass
        borderColor: Colors.primary,
        justifyContent: 'center',
    },
    playButtonFocused: {
        backgroundColor: '#ff1a1a',
        borderColor: '#fff',
        transform: [{ scale: 1.05 }],
    },
    actionIcon: {
        fontSize: 20,
        marginRight: 12,
        color: '#fff',
    },
    actionLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    backButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    backButtonFocused: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderColor: '#fff',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
    },
    recommendationsContainer: {
        marginTop: 20,
        marginBottom: 40,
    },
});
