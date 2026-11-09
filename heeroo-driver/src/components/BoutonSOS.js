// Le bouton d'urgence du chauffeur : un triangle rouge qui ouvre le dialogue
// d'appel. Toute la mécanique est dans common/sos.js — ici il n'y a que
// l'apparence et le chargement au montage.
//
// Il est pose a plusieurs endroits, parce que « accessible tout le temps » ne
// se satisfait pas d'un seul : en-tete de l'ecran d'accueil (une touche), et
// sur les ecrans de course. Le menu lateral porte la meme action, et couvre
// les ecrans ou ce bouton n'est pas.
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '@rneui/themed';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
import { chargerSOS, ouvrirSOS } from '../common/sos';

export default class BoutonSOS extends React.Component {

    constructor(props) {
        super(props);
        // Actif tant qu'on ne sait pas : sans cette valeur de depart, le
        // bouton clignoterait — absent le temps du chargement, puis
        // apparaissant. Il ne disparait que si le back-office l'a coupe.
        this.state = { sos: { pays: null, operateur: null, actif: true } };
        // Le composant disparait des que la course se termine : sans ce
        // drapeau, le chargement appellerait setState sur un composant demonte.
        this.monte = false;
    }

    componentDidMount() {
        this.monte = true;
        chargerSOS().then(sos => {
            if (this.monte) { this.setState({ sos: sos }); }
        });
    }

    componentWillUnmount() {
        this.monte = false;
    }

    render() {
        // Coupe depuis le back-office : rien n'est affiche, et aucune place
        // n'est reservee dans l'en-tete.
        if (this.state.sos && this.state.sos.actif === false) { return null; }
        return (
            <TouchableOpacity
                style={[styles.bouton, this.props.style]}
                // Tant que le chargement n'a pas abouti, l'etat ne porte que
                // des valeurs de depart, et ouvrirSOS sait s'en passer : les
                // secours sont joignables des la premiere seconde d'affichage.
                onPress={() => ouvrirSOS(this.state.sos)}
                accessibilityRole="button"
                accessibilityLabel={languageJSON.panic_text}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Icon
                    name="alert-triangle"
                    type="feather"
                    color={colors.RED}
                    size={this.props.size || 22}
                />
            </TouchableOpacity>
        );
    }
}

const styles = StyleSheet.create({
    bouton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
