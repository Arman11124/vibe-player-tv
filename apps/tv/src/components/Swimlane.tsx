
import React from 'react';
import { FlatList, StyleSheet, Text, View, Dimensions } from 'react-native';
import { ContentItem } from '../services/TmdbService';
import { Colors, Spacing, Typography } from '../theme/theme';
import { MovieCard } from './MovieCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = 120;
const ITEM_SPACING = Spacing.xl; // Increased from m (16) to xl (32) to match MovieCard margin
// Calculate padding to center the first item exactly
// We subtract the item width, then divide the remaining space by 2
const SCREEN_CENTER_PADDING = (SCREEN_WIDTH - ITEM_WIDTH) / 2;

interface SwimlaneProps {
    title: string;
    items: ContentItem[];
    onItemPress: (item: ContentItem) => void;
    onFocus?: () => void;
}

export const Swimlane: React.FC<SwimlaneProps> = ({ title, items, onItemPress, onFocus }) => {
    const flatListRef = React.useRef<FlatList>(null);

    const handleFocus = (index: number) => {
        flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5,
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            {items.length > 0 ? (
                <FlatList
                    ref={flatListRef}
                    horizontal
                    data={items}
                    renderItem={({ item, index }) => (
                        <MovieCard
                            item={item}
                            onPress={onItemPress}
                            onFocus={() => {
                                handleFocus(index);
                                onFocus?.();
                            }}
                        />
                    )}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={{
                        paddingHorizontal: 60,
                        paddingVertical: 40 // Reduced from 100 - optimized for 1.4x zoom
                    }}
                    style={{ overflow: 'visible' }}
                    showsHorizontalScrollIndicator={false}
                    snapToAlignment="center"
                    decelerationRate="fast"
                    getItemLayout={(data, index) => ({
                        length: ITEM_WIDTH + ITEM_SPACING,
                        offset: (ITEM_WIDTH + ITEM_SPACING) * index,
                        index
                    })}
                />
            ) : (
                <View style={{ padding: 60 }}>
                    <Text style={{ color: '#666', fontSize: 18 }}>Пока нет избранного. Лайкните фильм, чтобы добавить.</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: Spacing.m, // Reduced from xxl to prevent "messy" gaps
    },
    title: {
        ...Typography.h2,
        marginLeft: Spacing.m,
        marginBottom: Spacing.s,
    },
    listContent: {
        paddingLeft: Spacing.m,
        paddingRight: Spacing.m,
        paddingTop: 40, // Large space for Top Focus Scale + Glow
        paddingBottom: 40, // Large space for Bottom Focus Scale + Glow
    },
});
