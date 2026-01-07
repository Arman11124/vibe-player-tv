import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { PlayerScreen } from './src/screens/PlayerScreen';
import { DetailsScreen } from './src/screens/DetailsScreen';
import { LogBox } from 'react-native';
import { ContentItem, ContentType } from './src/services/TmdbService';
import { Colors } from './src/theme/theme';
import { fetchConfig, AppConfig } from './src/services/ConfigService';

export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  Details: { movieId: number; mediaType?: ContentType };
  Player: { item: ContentItem; streamUrl?: string };
};

const Stack = createStackNavigator<RootStackParamList>();

// Type assertion for React Navigation container
const NavigationContainerAny = NavigationContainer as unknown as React.ComponentType<{ children?: React.ReactNode }>;

// Ignore specific annoying logs
LogBox.ignoreLogs([
  '[Kinopoisk] No API Key provided',
  'Kinopoisk fetch failed',
  'Require cycle:',
]);

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const MaintenanceScreen: React.FC = () => (
  <View style={styles.maintenanceContainer}>
    <Text style={styles.maintenanceIcon}>🔧</Text>
    <Text style={styles.maintenanceTitle}>Техническое обслуживание</Text>
    <Text style={styles.maintenanceSubtitle}>
      Приложение временно недоступно.{'\n'}Пожалуйста, попробуйте позже.
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#E50914" />
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      console.log('[App] Loading remote config...');
      const remoteConfig = await fetchConfig();
      setConfig(remoteConfig);
      setIsLoading(false);
      console.log('[App] Config loaded. Maintenance:', remoteConfig.is_maintenance);
    };

    loadConfig();
  }, []);

  // Show loading while fetching config
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show maintenance screen if enabled
  if (config?.is_maintenance) {
    return <MaintenanceScreen />;
  }

  // Normal app flow
  return (
    <NavigationContainerAny>
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // Fullscreen immersion for OTT
          cardStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
      </Stack.Navigator>
    </NavigationContainerAny>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
  },
  maintenanceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B0000', // Deep red background
    padding: 40,
  },
  maintenanceIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  maintenanceTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  maintenanceSubtitle: {
    fontSize: 18,
    color: '#FFCCCC',
    textAlign: 'center',
    lineHeight: 28,
  },
});

export default App;
