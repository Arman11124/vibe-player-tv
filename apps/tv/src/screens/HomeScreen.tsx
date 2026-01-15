import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, View, Text, FlatList } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, GlobalStyles } from '../theme/theme';
import {
    fetchTrending,
    fetchTrendingTV,
    fetchNowPlaying,
    fetchTopRatedMovies,
    fetchUpcoming,
    fetchRussianContent,
    fetchUSContent,
    fetchEuropeanContent,
    fetchKoreanContent,
    fetchActionMovies,
    fetchComedyMovies,
    fetchDramaMovies,
    fetchThrillerMovies,
    fetchSciFiMovies,
    fetchCartoons,
    fetchDocumentaries,
    ContentItem
} from '../services/TmdbService';
import { HeroSection } from '../components/HeroSection';
import { Focusable } from '../components/Focusable';
import { Swimlane } from '../components/Swimlane';
import { MovieDetailsModal } from '../components/MovieDetailsModal';
import { RootStackParamList } from '../../App';

type HomeScreenNav = StackNavigationProp<RootStackParamList, 'Home'>;

interface CategoryData {
    title: string;
    data: ContentItem[];
}

export const HomeScreen: React.FC<{ navigation: HomeScreenNav }> = ({ navigation }) => {
    const [loading, setLoading] = useState(true);

    const [heroItems, setHeroItems] = useState<ContentItem[]>([]);

    // Categories State
    const [trending, setTrending] = useState<ContentItem[]>([]);
    const [trendingTV, setTrendingTV] = useState<ContentItem[]>([]);
    const [nowPlaying, setNowPlaying] = useState<ContentItem[]>([]);
    const [topRated, setTopRated] = useState<ContentItem[]>([]);
    const [upcoming, setUpcoming] = useState<ContentItem[]>([]);

    // Regional
    const [russian, setRussian] = useState<ContentItem[]>([]);
    const [us, setUS] = useState<ContentItem[]>([]);
    const [european, setEuropean] = useState<ContentItem[]>([]);
    const [korean, setKorean] = useState<ContentItem[]>([]);

    // Genres
    const [action, setAction] = useState<ContentItem[]>([]);
    const [comedy, setComedy] = useState<ContentItem[]>([]);
    const [drama, setDrama] = useState<ContentItem[]>([]);
    const [thriller, setThriller] = useState<ContentItem[]>([]);
    const [sciFi, setSciFi] = useState<ContentItem[]>([]);
    const [cartoons, setCartoons] = useState<ContentItem[]>([]);
    const [docs, setDocs] = useState<ContentItem[]>([]);

    // Modal State
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        console.log('[Home] Initializing content...');

        // Priority 1: Load Hero & Core Data immediately to show SOMETHING
        const loadCore = async () => {
            try {
                const [trendingData, tvData] = await Promise.all([
                    fetchTrending(),
                    fetchTrendingTV()
                ]);

                if (trendingData.length > 0) {
                    // Take top 10 for Hero Carousel
                    setHeroItems(trendingData.slice(0, 10));
                    // Remaining items for trending row
                    setTrending(trendingData.slice(10));
                } else {
                    console.error('[Home] No trending data found');
                    setHeroItems([]); // Or fallback item logic
                    setTrending(trendingData);
                }
                setTrendingTV(tvData);
                setLoading(false); // Unblock UI immediately after core data
            } catch (e) {
                console.error('Core load failed', e);
                setLoading(false);
            }
        };

        // Priority 2: Load the rest in background
        // Priority 2: Load the rest in batches to avoid Rate Limiting/Network Congestion
        const loadSecondary = async () => {
            console.log('[Home] Starting secondary load...');

            // Batch 1: Main Movie Lists
            try {
                console.log('[Home] Fetching Batch 1 (Movies)...');
                const [_nowPlaying, _topRated, _upcoming] = await Promise.all([
                    fetchNowPlaying(),
                    fetchTopRatedMovies(),
                    fetchUpcoming(),
                ]);
                setNowPlaying(_nowPlaying);
                setTopRated(_topRated);
                setUpcoming(_upcoming);
                console.log('[Home] Batch 1 loaded.');
            } catch (e) {
                console.warn('[Home] Batch 1 failed', e);
            }

            // Batch 2: Regions
            try {
                console.log('[Home] Fetching Batch 2 (Regions)...');
                const [_russian, _us, _european, _korean] = await Promise.all([
                    fetchRussianContent(),
                    fetchUSContent(),
                    fetchEuropeanContent(),
                    fetchKoreanContent(),
                ]);
                setRussian(_russian);
                setUS(_us);
                setEuropean(_european);
                setKorean(_korean);
                console.log('[Home] Batch 2 loaded.');
            } catch (e) {
                console.warn('[Home] Batch 2 failed', e);
            }

            // Batch 3: Genres
            try {
                console.log('[Home] Fetching Batch 3 (Genres)...');
                const [_action, _comedy, _drama, _thriller, _sciFi, _cartoons, _docs] = await Promise.all([
                    fetchActionMovies(),
                    fetchComedyMovies(),
                    fetchDramaMovies(),
                    fetchThrillerMovies(),
                    fetchSciFiMovies(),
                    fetchCartoons(),
                    fetchDocumentaries(),
                ]);
                setAction(_action);
                setComedy(_comedy);
                setDrama(_drama);
                setThriller(_thriller);
                setSciFi(_sciFi);
                setCartoons(_cartoons);
                setDocs(_docs);
                console.log('[Home] Batch 3 loaded.');
            } catch (e) {
                console.warn('[Home] Batch 3 failed', e);
            }

            console.log('[Home] Secondary load complete.');
        };

        loadCore().then(() => loadSecondary());
    }, []);

    const handleItemPress = (item: ContentItem) => {
        // Navigate to Details screen instead of modal
        navigation.navigate('Details', {
            movieId: item.id,
            mediaType: item.media_type
        });
    };

    const handlePlay = () => {
        setModalVisible(false);
        if (selectedItem) {
            navigation.navigate('Player', { item: selectedItem });
        }
    };

    const handleHeroPlay = (item: ContentItem) => {
        navigation.navigate('Player', { item });
    };

    const [favorites, setFavorites] = useState<ContentItem[]>([]);

    // Reload favorites whenever screen gains focus (navigation listener)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            import('../services/FavoritesService').then(({ FavoritesService }) => {
                FavoritesService.getFavorites().then(setFavorites);
            });
        });
        return unsubscribe;
    }, [navigation]);

    // Combine all data into sections
    const sections = React.useMemo(() => [
        { id: 'favorites', title: "❤️ Мои избранные", data: favorites },
        { id: 'trending', title: "⚡️ В тренде (фильмы)", data: trending },
        { id: 'trendingTV', title: "📺 Топ сериалов", data: trendingTV },
        { id: 'nowPlaying', title: "🚀 Новинки кино", data: nowPlaying },
        { id: 'russian', title: "🇷🇺 Наше кино", data: russian },
        { id: 'us', title: "🇺🇸 Голливуд", data: us },
        { id: 'cartoons', title: "🎈 Мультфильмы", data: cartoons },
        { id: 'action', title: "🧨 Боевики", data: action },
        { id: 'comedy', title: "🎭 Комедии", data: comedy },
        { id: 'sciFi', title: "🌌 Фантастика", data: sciFi },
        { id: 'docs', title: "📚 Документальное", data: docs },
    ].filter(s => s.data.length > 0 || s.id === 'favorites'), [
        trending, trendingTV, nowPlaying, russian, us, cartoons, action, comedy, sciFi, docs, favorites
    ]);

    const verticalListRef = React.useRef<FlatList>(null);

    const handleRowFocus = (index: number) => {
        verticalListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5, // Center the row
        });
    };



    // ... inside component

    const renderHeader = () => (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', justifyContent: 'flex-end', padding: 20, backgroundColor: 'transparent' }}>
            <Focusable
                onPress={() => navigation.navigate('Search')}
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                focusedStyle={{ backgroundColor: Colors.primary, borderColor: Colors.primary }}
            >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>🔍 ПОИСК</Text>
            </Focusable>
        </View>
    );

    if (loading) {
        // ...
    }

    console.log('[Home] Render. Hero Items:', heroItems.length);
    if (heroItems.length > 0) {
        console.log('[Home] First Hero Item:', heroItems[0].title);
    }

    return (
        <SafeAreaView style={GlobalStyles.container}>
            {renderHeader()}
            <FlatList
                // ...
                ref={verticalListRef}
                data={sections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollContent}
                ListHeaderComponent={
                    heroItems.length > 0 ? (
                        <HeroSection
                            items={heroItems}
                            onPlayPress={handleHeroPlay}
                            hasTVPreferredFocus={true}
                        />
                    ) : (
                        <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: 'white' }}>Нет данных. Проверьте интернет или API Key.</Text>
                        </View>
                    )
                }

                renderItem={({ item, index }) => (
                    <View style={{ marginBottom: 20 }}>
                        <Swimlane
                            title={item.title}
                            items={item.data}
                            onItemPress={handleItemPress}
                            onFocus={() => handleRowFocus(index)}
                        />
                    </View>
                )}
                showsVerticalScrollIndicator={false}
                // Optimization props
                windowSize={5}
                maxToRenderPerBatch={3}
                initialNumToRender={3}
            />

            <MovieDetailsModal
                visible={modalVisible}
                item={selectedItem}
                onClose={() => setModalVisible(false)}
                onPlay={handlePlay}
                onSelectRecommendation={handleItemPress}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 50,
    },
});
