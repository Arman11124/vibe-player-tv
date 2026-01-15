import React, { useRef, useState } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '../theme/theme';
import LinearGradient from 'react-native-linear-gradient';

interface FocusableProps extends PressableProps {
    children: any; // Allow function or node
    style?: StyleProp<ViewStyle>;
    focusedStyle?: StyleProp<ViewStyle>;
    scaleFactor?: number;
}


export const Focusable: React.FC<FocusableProps> = ({
    children,
    style,
    focusedStyle,
    scaleFactor = 1.1,
    ...props
}) => {
    const [focused, setFocused] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const onFocus = (e: any) => {
        setFocused(true);
        Animated.spring(scaleAnim, {
            toValue: scaleFactor,
            friction: 4,
            useNativeDriver: true,
        }).start();
        props.onFocus?.(e);
    };

    const onBlur = (e: any) => {
        setFocused(false);
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
        }).start();
        props.onBlur?.(e);
    };

    const GradientOverlay = () => (
        <View style={StyleSheet.absoluteFill}>
            <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            />
            <View style={{
                ...StyleSheet.absoluteFillObject,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.3)',
                borderRadius: 12
            }} />
        </View>
    );

    return (
        <Pressable
            {...props}
            // @ts-ignore
            focusable={true}
            onFocus={onFocus}
            onBlur={onBlur}
        >
            <Animated.View
                style={[
                    style,
                    // styles.baseContainer removed to allow prop control
                    { transform: [{ scale: scaleAnim }] },
                    focused && styles.focusedBorder,
                    focused && focusedStyle,
                    { overflow: 'hidden' } // Clip internal gradient to border radius
                ]}
            >
                {typeof children === 'function' ? children({ focused }) : children}
                {focused && (
                    <View style={styles.glassOverlay}>
                        <GradientOverlay />
                    </View>
                )}
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    // baseContainer removed
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 12, // Inner content radius
        // Removed overflow: hidden because layers are self-clipped
    },
    focusedBorder: {
        borderColor: Colors.primary,

        // Super "Neon" Glow
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 30,
        elevation: 40,
    },
});
