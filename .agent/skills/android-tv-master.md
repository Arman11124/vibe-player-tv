---
name: android-tv-master
description: Expert in Android TV UI, React Native TV, Focus Management, and D-pad navigation
sasmp_version: "1.3.0"
version: "1.0.0"
bonded_agent: 01-tv-ui-architect
bond_type: PRIMARY_BOND
allowed-tools: Read, Write, Bash, Glob, Grep

# Parameter Validation
parameters:
  platform:
    type: string
    enum: [android-tv, fire-tv, tvos]
    default: android-tv
    description: Target TV platform
---

# Android TV Master Skill

Master navigation and UI performance for React Native TV applications.

## Overview

This skill ensures 100% focus stability, smooth spatial navigation, and TV-optimized layouts. It covers focus management using `useFocusEffect`, `NextFocus` properties, and performance optimization for low-memory devices.

## When to Use This Skill

Use when you need to:
- Resolve "Focus Traps" (inability to navigate away)
- Implement D-pad navigation for custom components
- Optimize list rendering (FlatList/SectionList) for TV
- Handle remote control hardware buttons (Back, Menu)
- Debug focus issues in the emulator or on device

## Quick Reference

```tsx
// Focusable Component Pattern
import { TouchableOpacity, TVFocusGuideView } from 'react-native';

const TVButton = ({ label, onFocus, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onFocus={onFocus}
    onPress={onPress}
    style={styles.button}
    nextFocusDown={nextId} // Explicit focus mapping
    nextFocusRight={rightId}
  >
    <Text>{label}</Text>
  </TouchableOpacity>
);

// Focus Guide for Grid/Complex layout
<TVFocusGuideView destinations={[firstItemRef]}>
  <View style={styles.sidebar}>...</View>
</TVFocusGuideView>
```

## D-pad Configuration

```javascript
// app.json or platform-specific config
{
  "expo": {
    "android": {
      "softwareKeyboardLayoutMode": "pan",
      "intentFilters": [
        {
          "action": "android.intent.action.MAIN",
          "category": ["android.intent.category.LEANBACK_LAUNCHER"]
        }
      ]
    }
  }
}
```

## Useful Commands

```bash
adb shell input keyevent 20      # DPAD_DOWN
adb shell input keyevent 21      # DPAD_LEFT
adb shell input keyevent 22      # DPAD_RIGHT
adb shell input keyevent 23      # DPAD_CENTER
adb shell input keyevent 4       # BACK
npx react-native run-android --mode release # Performance test
```

## Focus Optimization

```tsx
// Prevent unnecessary re-renders during rapid navigation
const MemoizedItem = React.memo(({ item }) => (
  <FocusableItem item={item} />
), (prev, next) => prev.isFocused === next.isFocused);
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Focus disappears | Check `focusable={true}` and parent visibility |
| Slow scrolling | Use `windowSize={3}` and `removeClippedSubviews` |
| Multiple focus | Ensure only one `hasTVPreferredFocus={true}` |

## Usage

```
Skill("android-tv-master")
```
