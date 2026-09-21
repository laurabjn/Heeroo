import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { colors } from '../common/theme';

// Logo et nom de l'app en tête des écrans de connexion et d'inscription.
export default function BrandHeader() {
    return (
        <View style={styles.wrap}>
            <Image source={require('../../assets/images/appIcon.png')} style={styles.logo} />
            <Text style={styles.name}>Heeroo</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    // Occupe l'espace libre au-dessus du formulaire, mais se réduit (flexShrink)
    // plutôt que de comprimer les champs quand le clavier est ouvert.
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
