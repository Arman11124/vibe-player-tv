import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    ImageBackground,
    ScrollView,
    Dimensions,
} from 'react-native';
import { ContentItem, getImageUrl } from '../services/TmdbService';
import { Colors, Spacing } from '../theme/theme';
import { Focusable } from './Focusable';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

interface MovieDetailsModalProps {
    visible: boolean;
    item: ContentItem | null;
    onClose: () => void;
    onPlay: () => void;
    onSelectRecommendation?: (item: ContentItem) => void;
}

export const MovieDetailsModal: React.FC<MovieDetailsModalProps> = ({
    visible,
    item,
    onClose,
    onPlay,
    onSelectRecommendation,
}) => {
    const navigation = useNavigation<any>();
    const [recommendations, setRecommendations] = React.useState<ContentItem[]>([]);
    const [realRatings, setRealRatings] = React.useState<{ Source: string; Value: string }[]>([]);
    const [duration, setDuration] = React.useState<string>('');
    const [trailerKey, setTrailerKey] = React.useState<string | null>(null);
    const [audioTracks, setAudioTracks] = React.useState<string[]>([]);
    const [subtitles, setSubtitles] = React.useState<string[]>([]);
    const [isFavorite, setIsFavorite] = React.useState(false);

    React.useEffect(() => {
        if (item) {
            // Check Favorite Status
            import('../services/FavoritesService').then(({ FavoritesService }) => {
                FavoritesService.isFavorite(item.id).then(setIsFavorite);
            });

            setRealRatings([]); // Reset
            setAudioTracks([]);
            setSubtitles([]);

            // 1. Fetch Recommendations & Trailers
            import('../services/TmdbService').then(async ({ fetchRecommendations, fetchDetails, fetchVideos }) => {
                if ((item.media_type as string) !== 'person') {
                    try {
                        const recs = await fetchRecommendations(item.id, item.media_type, item.genre_ids);
                        setRecommendations(recs);
                    } catch (error) {
                        console.error("Error fetching recommendations:", error);
                    }
                }

                fetchVideos(item.id, item.media_type).then(key => {
                    setTrailerKey(key);
                });

                // 2. Fetch Details (IMDb ID) -> OMDb Ratings AND Kinopoisk
                fetchDetails(item.id, item.media_type).then(async (details) => {
                    if (details?.runtime) {
                        const h = Math.floor(details.runtime / 60);
                        const m = details.runtime % 60;
                        setDuration(`${h}h ${m}m`);
                    }

                    if (details?.spoken_languages) {
                        const languages = details.spoken_languages.map(l => l.name || l.english_name);
                        setAudioTracks(languages);
                        // Logic: If original audio is not Russian, assume we have Rus subs available too
                        setSubtitles(['Русские']);
                    }

                    // ... (External Fetch logic remains) ...
                    // Parallel External Fetch
                    const fetchPromises = [];

                    // A) OMDb
                    if (details?.imdb_id) {
                        fetchPromises.push(
                            import('../services/OmdbService')
                                .then(({ fetchRatings }) => fetchRatings(details.imdb_id!))
                        );
                    } else {
                        // If no IMDb ID, push a promise that resolves to an error for OMDb
                        fetchPromises.push(Promise.resolve([{ Source: 'Error', Value: 'No OMDb' }]));
                    }

                    // B) Kinopoisk (Real)
                    const year = item.release_date ? item.release_date.split('-')[0] : undefined;
                    fetchPromises.push(
                        import('../services/KinopoiskService')
                            .then(({ fetchKinopoiskRating }) => fetchKinopoiskRating(item.original_title || item.title, year))
                            .then(kpData => kpData ? { Source: 'Kinopoisk', Value: kpData.kp?.toFixed(1) || '?' } : null)
                            .catch(() => null) // Catch Kinopoisk errors gracefully
                    );

                    const results = await Promise.all(fetchPromises);
                    const omdbRatings = results[0] || [];
                    const kpRating = results[1];

                    let finalRatings = Array.isArray(omdbRatings) ? [...omdbRatings] : [];
                    if (kpRating) finalRatings.push(kpRating);

                    setRealRatings(finalRatings);

                }).catch(() => {
                    setRealRatings([{ Source: 'Error', Value: 'Error' }]);
                });
            });
        }
    }, [item]);

    const getRatingMeta = (source: string) => {
        if (source === 'Internet Movie Database') return { label: 'IMDb', color: 'black', bgColor: '#f5c518' };
        if (source === 'Rotten Tomatoes') return { label: '🍅', color: 'white', bgColor: 'rgba(255, 255, 255, 0.1)' };
        if (source === 'Metacritic') return { label: 'M', color: 'white', bgColor: '#66cc33' }; // Metacritic Green
        return { label: '★', color: 'white', bgColor: '#555' };
    };

    if (!item) return null;

    // Smart URL handling - check if already full URL
    const backdropUrl = getImageUrl(item.backdrop_path, 'original') || getImageUrl(item.poster_path, 'w500');

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Backdrop with Overlay */}
                <ImageBackground
                    source={{ uri: backdropUrl || '' }}
                    style={styles.backdrop}
                    resizeMode="cover"
                >
                    <View style={styles.gradientOverlay} />

                    <View style={styles.contentContainer}>
                        <View style={styles.detailsColumn}>
                            <Text style={styles.title}>{item.title}</Text>

                            {/* Tech Specs Row - "Selection" Style */}
                            <View style={{ marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={{ color: '#888', fontSize: 16, width: 100 }}>Аудио:</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {(audioTracks.length > 0 ? audioTracks.slice(0, 3) : ['Original']).map((track, i) => (
                                            <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}>
                                                <Text style={{ color: 'white', fontSize: 14 }}>{track}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: '#888', fontSize: 16, width: 100 }}>Субтитры:</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {(subtitles.length > 0 ? subtitles : ['Нет']).map((sub, i) => (
                                            <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}>
                                                <Text style={{ color: 'white', fontSize: 14 }}>{sub}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <View style={styles.metaRow}>
                                {item.release_date && (
                                    <Text style={styles.metaText}>{item.release_date.split('-')[0]}</Text>
                                )}

                                {/* 1. Real External Ratings (IMDb, RT, Meta) */}
                                {realRatings.filter(r => r.Source !== 'Error' && r.Source !== 'Kinopoisk').map((rating) => {
                                    const meta = getRatingMeta(rating.Source);
                                    return (
                                        <View key={rating.Source} style={[styles.ratingBadge, { backgroundColor: meta.bgColor }]}>
                                            <Text style={[styles.ratingLabel, { color: meta.color }]}>{meta.label}</Text>
                                            <Text style={[styles.ratingValue, { color: meta.color }]}>{rating.Value}</Text>
                                        </View>
                                    );
                                })}

                                {/* 2. KP Rating (Real OR Fake/TMDB) */}
                                {(() => {
                                    const realKp = realRatings.find(r => r.Source === 'Kinopoisk');
                                    // User Request: 'Instead of TMDB rating, write KP - no one will guess'
                                    // So we use TMDB vote_average as a fallback if Real KP is missing.
                                    const rawValue = realKp ? realKp.Value : (item.vote_average || 0);
                                    // Handle string or number inputs safely
                                    const numValue = parseFloat(String(rawValue));
                                    const kpValue = numValue.toFixed(1);

                                    // Hide if 0.0 (Looks like a bug)
                                    if (kpValue === '0.0') return null;

                                    return (
                                        <View style={[styles.ratingBadge, { backgroundColor: '#f60' }]}>
                                            <Text style={[styles.ratingLabel, { color: 'white' }]}>KP</Text>
                                            <Text style={[styles.ratingValue, { color: 'white' }]}>{kpValue}</Text>
                                        </View>
                                    );
                                })()}
                            </View>

                            <ScrollView style={styles.overviewScroll}>
                                <Text style={styles.overview}>
                                    {item.overview ? item.overview : "Описание пока отсутствует для этого фильма."}
                                </Text>
                            </ScrollView>

                            <View style={styles.actionsRow}>
                                <Focusable
                                    onPress={onPlay}
                                    style={styles.playButton}
                                    focusedStyle={styles.playButtonFocused}
                                >
                                    <Text style={styles.playButtonText}>▶ СМОТРЕТЬ</Text>
                                </Focusable>

                                <Focusable
                                    onPress={() => {
                                        // Use Yandex Video - works in Russia without VPN
                                        const searchQuery = encodeURIComponent(item.title + ' трейлер');
                                        Linking.openURL(`https://yandex.ru/video/search?text=${searchQuery}`);
                                    }}
                                    style={styles.actionButton}
                                    focusedStyle={styles.actionButtonFocused}
                                >
                                    <Text style={styles.actionButtonText}>ТРЕЙЛЕР</Text>
                                </Focusable>

                                <Focusable
                                    onPress={async () => {
                                        const FavoritesService = (await import('../services/FavoritesService')).FavoritesService;
                                        const newStatus = await FavoritesService.toggleFavorite(item);
                                        setIsFavorite(newStatus);
                                    }}
                                    style={styles.actionButton}
                                    focusedStyle={styles.actionButtonFocused}
                                >
                                    <Text style={[styles.actionButtonText, { color: isFavorite ? '#ff4081' : 'white' }]}>
                                        {isFavorite ? '♥' : '♡'}
                                    </Text>
                                </Focusable>

                                <Focusable
                                    onPress={() => console.warn('Report Problem clicked')}
                                    style={styles.actionButton}
                                    focusedStyle={styles.actionButtonFocused}
                                >
                                    <Text style={styles.actionButtonText}>⚠</Text>
                                </Focusable>
                            </View>
                        </View>

                        {/* Right Column: Recommendations */}
                        <View style={styles.recommendationsColumn}>
                            <Text style={styles.sectionTitle}>Похожие</Text>
                            {recommendations.length > 0 ? (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingVertical: 60, paddingHorizontal: 60 }}
                                    style={{ flexGrow: 0 }}
                                >
                                    {recommendations.slice(0, 5).map(rec => (
                                        <View key={rec.id} style={{ marginRight: 20 }}>
                                            <Focusable
                                                onPress={() => onSelectRecommendation?.(rec)}
                                                style={{ width: 140, height: 210, borderRadius: 16, backgroundColor: Colors.surface }}
                                                focusedStyle={{
                                                    borderColor: Colors.primary,
                                                    borderWidth: 4,
                                                    borderRadius: 16,
                                                    backgroundColor: Colors.surface
                                                }}
                                                scaleFactor={1.1}
                                            >
                                                <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
                                                    {rec.poster_path ? (
                                                        <ImageBackground
                                                            source={{ uri: getImageUrl(rec.poster_path, 'w500') || undefined }}
                                                            style={{ flex: 1 }}
                                                            imageStyle={{ borderRadius: 12 }}
                                                            resizeMode="cover"
                                                        />
                                                    ) : (
                                                        <View style={{ flex: 1, backgroundColor: '#333', justifyContent: 'center', padding: 4 }}>
                                                            <Text style={{ color: 'white', textAlign: 'center' }}>{rec.title}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </Focusable>
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <View style={{ padding: 20 }}>
                                    <Text style={{ color: '#666', fontSize: 16 }}>Нет похожих фильмов</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </ImageBackground>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    backdrop: {
        width: '100%',
        height: '100%',
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)', // Darken background for readability
    },
    contentContainer: {
        flex: 1,
        flexDirection: 'row',
        padding: Spacing.xl,
        alignItems: 'center',
    },
    detailsColumn: {
        width: '50%', // Occupy left half
    },
    recommendationsColumn: {
        width: '50%',
        height: '100%',
        paddingLeft: Spacing.xl,
        justifyContent: 'center',
        overflow: 'hidden', // Stop list from sliding over text
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: Spacing.m,
    },
    title: {
        color: Colors.text.primary,
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: Spacing.m,
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 10,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
        flexWrap: 'wrap', // Allow wrapping for smaller screens
    },
    metaText: {
        color: Colors.text.secondary,
        fontSize: 20,
        fontWeight: '600',
        marginRight: Spacing.m,
    },
    // Ratings Container
    ratingsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
        gap: Spacing.m,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: Spacing.s,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 6,
    },
    ratingLabel: {
        color: Colors.text.secondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    ratingValue: {
        color: Colors.text.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    // Match Text
    matchText: {
        color: '#46d369',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: Spacing.m,
    },
    yearText: {
        color: Colors.text.secondary,
        fontSize: 18,
        marginRight: Spacing.m,
    },
    ageBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 4,
        borderRadius: 2,
        marginRight: Spacing.m,
    },
    ageText: {
        color: Colors.text.primary,
        fontSize: 14,
    },
    durationText: {
        color: Colors.text.secondary,
        fontSize: 18,
    },

    // Overview
    overviewScroll: {
        maxHeight: 200,
        marginBottom: Spacing.xl,
    },
    overview: {
        color: Colors.text.secondary,
        fontSize: 18,
        lineHeight: 28,
    },

    // Buttons
    actionsRow: {
        flexDirection: 'row',
        gap: Spacing.l,
    },
    playButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 30, // Reduced from 40
        paddingVertical: 15,
        borderRadius: 8,
    },
    playButtonFocused: {
        backgroundColor: '#f40612',
        transform: [{ scale: 1.05 }],
    },
    playButtonText: {
        color: 'white',
        fontSize: 20, // Reduced from 24
        fontWeight: 'bold',
    },
    actionButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 20, // Reduced from 30
        paddingVertical: 15,
        borderRadius: 8,
    },
    actionButtonFocused: {
        backgroundColor: 'rgba(255,255,255,0.4)',
        transform: [{ scale: 1.05 }],
    },
    actionButtonText: {
        color: 'white',
        fontSize: 20, // Reduced from 24
        fontWeight: '600',
    },
});
