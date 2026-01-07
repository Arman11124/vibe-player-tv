
import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

export const Colors = {
  background: '#000000', // Deep Black
  surface: '#141414',    // Card Backgrounds
  primary: '#E50914',    // Netflix Red
  text: {
    primary: '#FFFFFF',
    secondary: '#B3B3B3',
  },
  overlay: {
    dark: 'rgba(0, 0, 0, 0.7)',
    glass: 'rgba(20, 20, 20, 0.9)',
  },
  border: {
    focused: '#E50914',
    unfocused: 'transparent',
  },
};

export const Spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  h1: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  } as TextStyle,
  h2: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
  } as TextStyle,
  body: {
    fontSize: 14,
    color: Colors.text.secondary,
  } as TextStyle,
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  } as TextStyle,
};

export const GlobalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  focusedBorder: {
    borderWidth: 2,
    borderColor: Colors.border.focused,
  } as ViewStyle,
});
