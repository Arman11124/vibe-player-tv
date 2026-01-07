import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContentItem } from './TmdbService';

const STORAGE_KEY = '@ott_favorites_v1';

export const FavoritesService = {
    async getFavorites(): Promise<ContentItem[]> {
        try {
            const json = await AsyncStorage.getItem(STORAGE_KEY);
            return json ? JSON.parse(json) : [];
        } catch (e) {
            console.error('Failed to load favorites', e);
            return [];
        }
    },

    async isFavorite(id: number): Promise<boolean> {
        try {
            const list = await this.getFavorites();
            return list.some(i => i.id === id);
        } catch (e) {
            return false;
        }
    },

    async addFavorite(item: ContentItem): Promise<boolean> {
        try {
            const list = await this.getFavorites();
            if (list.some(i => i.id === item.id)) return false; // Already exists

            const newList = [item, ...list];
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
            return true;
        } catch (e) {
            console.error('Failed to add favorite', e);
            return false;
        }
    },

    async removeFavorite(id: number): Promise<boolean> {
        try {
            const list = await this.getFavorites();
            const newList = list.filter(i => i.id !== id);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
            return true;
        } catch (e) {
            console.error('Failed to remove favorite', e);
            return false;
        }
    },

    async toggleFavorite(item: ContentItem): Promise<boolean> {
        const exists = await this.isFavorite(item.id);
        if (exists) {
            await this.removeFavorite(item.id);
            return false; // Removed
        } else {
            await this.addFavorite(item);
            return true; // Added
        }
    }
};
