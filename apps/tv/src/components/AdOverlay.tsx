import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';

interface Props {
    qrUrl: string;
    ctaText: string;
}

export const AdOverlay: React.FC<Props> = ({ qrUrl, ctaText }) => {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.qrContainer}>
                    <Image
                        source={{ uri: qrUrl }}
                        style={styles.qrCode}
                        resizeMode="contain"
                    />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>СПОНСОР ПОКАЗА</Text>
                    <Text style={styles.cta}>{ctaText}</Text>
                    <Text style={styles.subtext}>Наведите камеру телефона</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000', // Matches the squeeze background
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 60, // TV safe area
        justifyContent: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 30,
        backgroundColor: '#1a1a1a',
        padding: 20,
        paddingRight: 40,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    qrContainer: {
        width: 100,
        height: 100,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 5,
    },
    qrCode: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        justifyContent: 'center',
    },
    title: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
        letterSpacing: 1,
    },
    cta: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtext: {
        color: '#888',
        fontSize: 14,
    },
});
