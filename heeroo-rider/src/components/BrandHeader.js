import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Keyboard } from 'react-native';
import { colors } from '../common/theme';

// Logo et nom de l'app en tête des écrans de connexion et d'inscription.
// Masqué pendant la saisie : sur les petits écrans, le clavier ne laisse pas
// assez de place et le bloc débordait sur le titre de l'écran.
export default function BrandHeader() {
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
        return () => { show.remove(); hide.remove(); };
    }, []);

    if (keyboardOpen) return null;

    return (
        <View style={styles.wrap}>
            <Image source={require('../../assets/images/appIcon.png')} style={styles.logo} />
            <Text style={styles.name}>Heeroo</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,
        paddingVertical: 24,
    },
    logo: {
        width: 96,
        height: 96,
        borderRadius: 24,
    },
    name: {
        marginTop: 14,
        fontSize: 22,
        fontFamily: 'Montserrat-Bold',
        color: colors.TEXT_DARK || '#161533',
        letterSpacing: -0.3,
    },
});
