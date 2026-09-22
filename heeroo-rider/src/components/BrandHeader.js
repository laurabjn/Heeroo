import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Keyboard } from 'react-native';
import { colors } from '../common/theme';

// Logo et nom de l'app en tête des écrans de connexion et d'inscription.
// Pendant la saisie, le bloc passe en version réduite (petit logo, sans le nom) :
// il reste visible sans recouvrir le titre de l'écran, y compris sur les petits
// écrans où le clavier occupe la moitié de la hauteur.
export default function BrandHeader() {
    const [compact, setCompact] = useState(false);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setCompact(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setCompact(false));
        return () => { show.remove(); hide.remove(); };
    }, []);

    return (
        <View style={[styles.wrap, compact && styles.wrapCompact]}>
            <Image
                source={require('../../assets/images/appIcon.png')}
                style={compact ? styles.logoCompact : styles.logo}
            />
            {!compact && <Text style={styles.name}>Heeroo</Text>}
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
    wrapCompact: {
        flexGrow: 0,
        paddingVertical: 8,
    },
    logo: {
        width: 96,
        height: 96,
        borderRadius: 24,
    },
    logoCompact: {
        width: 44,
        height: 44,
        borderRadius: 12,
    },
    name: {
        marginTop: 14,
        fontSize: 22,
        fontFamily: 'Montserrat-Bold',
        color: colors.TEXT_DARK || '#161533',
        letterSpacing: -0.3,
    },
});
