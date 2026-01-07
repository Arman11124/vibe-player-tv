import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Colors, GlobalStyles, Spacing } from '../theme/theme';
import { ContentItem, fetchFromTmdb, TMDB_API_KEY } from '../services/TmdbService';
import { MovieCard } from '../components/MovieCard';
import { Focusable } from '../components/Focusable'; // Import added
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import axios from 'axios';
import { MovieDetailsModal } from '../components/MovieDetailsModal';

type SearchScreenNav = StackNavigationProp<RootStackParamList, 'Search'>;

export const SearchScreen: React.FC<{ navigation: SearchScreenNav }> = ({ navigation }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<TextInput>(null);

    // Modal state for search results
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const handleSearch = async (text: string) => {
        setQuery(text);
        if (text.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            // Search Multi (Movies + TV)
            const response = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'ru-RU',
                    query: text,
                    page: 1
                }
            });

            const raw = response.data.results || [];
            // Map and Filter like TmdbService
            const clean = raw.map((item: any) => ({
                id: item.id,
                title: item.title || item.name || 'Unknown',
                original_title: item.original_title || item.original_name,
                poster_path: item.poster_path,
                backdrop_path: item.backdrop_path,
                overview: item.overview,
                release_date: item.release_date || item.first_air_date,
                vote_average: item.vote_average,
                media_type: item.media_type || 'movie',
                genre_ids: item.genre_ids,
            })).filter((i: ContentItem) => i.poster_path != null && (i.media_type === 'movie' || i.media_type === 'tv'));

            setResults(clean);
        } catch (e) {
            console.warn('Search failed', e);
        } finally {
            setLoading(false);
        }
    };

    const handleItemPress = (item: ContentItem) => {
        setSelectedItem(item);
        setModalVisible(true);
    };

    const handlePlay = () => {
        setModalVisible(false);
        if (selectedItem) {
            navigation.navigate('Player', { item: selectedItem });
        }
    };

    const MOODS = [
        { label: "😭 Поплакать", genres: [18, 10749] }, // Drama, Romance
        { label: "🤣 Пересмеять друга", genres: [35] },  // Comedy
        { label: "💩 Наложить в штаны", genres: [27, 53] }, // Horror, Thriller
        { label: "🤗 Пообниматься", genres: [10749, 10751] }, // Romance, Family
        { label: "🤓 Поумничать", genres: [99, 36, 10752] }, // Doc, History, War
        { label: "🧠 Не думать", genres: [28, 12] },    // Action, Adventure
        { label: "🤯 Взорвать мозг", genres: [878, 9648] }, // Sci-Fi, Mystery
    ];

    const handleMoodSelect = async (moodGenres: number[]) => {
        setLoading(true);
        setQuery(MOODS.find(m => m.genres === moodGenres)?.label || "Подборка...");
        try {
            // Use discovery endpoint for moods
            const response = await axios.get(`https://api.themoviedb.org/3/discover/movie`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'ru-RU',
                    with_genres: moodGenres.join(','),
                    sort_by: 'popularity.desc',
                    page: 1
                }
            });

            const raw = response.data.results || [];
            const clean = raw.map((item: any) => ({
                id: item.id,
                title: item.title || item.name || 'Unknown',
                original_title: item.original_title || item.original_name,
                poster_path: item.poster_path,
                backdrop_path: item.backdrop_path,
                overview: item.overview,
                release_date: item.release_date || item.first_air_date,
                vote_average: item.vote_average,
                media_type: 'movie', // Discovery is mostly movies for now
                genre_ids: item.genre_ids,
            })).filter((i: ContentItem) => i.poster_path != null);

            setResults(clean);
        } catch (e) {
            console.warn('Mood fetch failed', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={GlobalStyles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Поиск и Настроение</Text>

                {/* TV-Friendly Search Bar Wrapper */}
                <Focusable
                    style={styles.inputWrapper}
                    focusedStyle={styles.inputWrapperFocused}
                    onPress={() => inputRef.current?.focus()}
                >
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder="Название фильма, сериала или выберите настроение..."
                        placeholderTextColor="#aaa"
                        value={query}
                        onChangeText={handleSearch}
                        // Important for TV:
                        focusable={true} // Allow direct focus too if user navigates precisely
                    />
                    <Text style={{ position: 'absolute', right: 20, color: '#aaa', fontSize: 20 }}>🔍</Text>
                </Focusable>
            </View>

            {/* Mood Selector (Visible when query is empty or short) */}
            {query.length < 2 && (
                <View style={{ padding: 20 }}>
                    <Text style={{ color: '#888', marginBottom: 15, fontSize: 18 }}>Подборка по настроению:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
                        {MOODS.map((mood, idx) => (
                            <Focusable
                                key={idx}
                                onPress={() => handleMoodSelect(mood.genres)}
                                style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 12 }}
                                focusedStyle={{ backgroundColor: Colors.primary, transform: [{ scale: 1.05 }] }}
                            >
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>{mood.label}</Text>
                            </Focusable>
                        ))}
                    </View>
                </View>
            )}

            {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={item => String(item.id)}
                    numColumns={5} // Grid Layout
                    contentContainerStyle={styles.grid}
                    renderItem={({ item }) => (
                        <View style={{ margin: 10 }}>
                            <MovieCard item={item} onPress={handleItemPress} />
                        </View>
                    )}
                    // Only show "Not Found" if query is typed and no results, NOT when just browsing moods
                    ListEmptyComponent={
                        query.length > 2 && results.length === 0 ? (
                            <Text style={styles.emptyText}>Ничего не найдено</Text>
                        ) : null
                    }
                />
            )}

            <MovieDetailsModal
                visible={modalVisible}
                item={selectedItem}
                onClose={() => setModalVisible(false)}
                onPlay={handlePlay}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: {
        padding: Spacing.l,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: Colors.background,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: Spacing.m,
    },
    inputWrapper: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    inputWrapperFocused: {
        borderColor: Colors.primary,
        backgroundColor: 'rgba(255,255,255,0.2)',
        transform: [{ scale: 1.01 }], // Subtle scale
    },
    input: {
        color: 'white',
        fontSize: 20,
        padding: 15,
        width: '100%',
    },
    grid: {
        padding: Spacing.m,
        alignItems: 'center' // Center the grid content
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 50,
        fontSize: 18
    }
});
