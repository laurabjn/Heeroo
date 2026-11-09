// Le bouton d'urgence, posé pendant la course à côté du message et de
// l'appel au chauffeur.
//
// Deux principes gouvernent ce fichier :
//
//   1. Il propose les SECOURS en premier, pas Heeroo. Un bouton marqué SOS
//      qui composerait le numéro de la société au lieu de celui de la police
//      est un piège : quelqu'un en détresse appuie, et tombe sur une
//      messagerie. Le numéro officiel du pays est donc toujours offert, et
//      il vient du binaire (common/urgences.js), pas de la base.
//   2. Il ne tombe jamais en panne. Le numéro de Heeroo est lu AU MONTAGE de
//      l'écran et non au moment de l'appui : au moment de l'appui, il n'y a
//      plus de temps pour attendre le réseau. Si cette lecture échoue, le
//      choix « Heeroo » disparaît simplement et les secours restent
//      joignables.
import React from 'react';
import { TouchableOpacity, Alert, Linking, StyleSheet } from 'react-native';
import { Icon } from '@rneui/themed';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
import { numeroUrgence, numeroHeeroo, numeroAppelable } from '../common/urgences';

export default class BoutonSOS extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            pays: props.country || null,
            numeroOperateur: null,
        };
        // Le composant est démonté dès que la course se termine : sans ce
        // drapeau, les deux lectures ci-dessous appelleraient setState sur un
        // composant disparu et React se plaindrait dans la console.
        this.monte = false;
    }

    componentDidMount() {
        this.monte = true;
        if (this.state.pays) {
            this._chargerNumeroOperateur(this.state.pays);
        } else {
            this._chargerPaysPuisNumero();
        }
    }

    componentWillUnmount() {
        this.monte = false;
    }

    // Le pays n'est pas toujours passé par l'écran appelant ; il est dans la
    // fiche de l'utilisateur, là où le reste de l'application le lit déjà
    // pour la monnaie et les moyens de paiement.
    _chargerPaysPuisNumero = () => {
        try {
            const utilisateur = firebase.auth().currentUser;
            if (!utilisateur) { return; }
            firebase.database().ref('users/' + utilisateur.uid + '/country').once('value')
                .then(instantane => {
                    const pays = instantane.val();
                    if (!this.monte || !pays) { return; }
                    this.setState({ pays: pays });
                    this._chargerNumeroOperateur(pays);
                })
                .catch(() => { /* les secours restent joignables */ });
        } catch (e) {
            // Rien : l'absence de numéro Heeroo n'empêche pas le bouton de servir.
        }
    };

    _chargerNumeroOperateur = (pays) => {
        try {
            firebase.database().ref('settings/').once('value')
                .then(instantane => {
                    if (!this.monte) { return; }
                    this.setState({ numeroOperateur: numeroHeeroo(instantane.val(), pays) });
                })
                .catch(() => { /* idem */ });
        } catch (e) {
            // Idem.
        }
    };

    _appeler = (numero) => {
        const propre = numeroAppelable(numero);
        if (!propre) { return; }
        Linking.openURL('tel:' + propre).catch(() => {
            Alert.alert('', languageJSON.panic_echec + ' ' + propre);
        });
    };

    _demander = () => {
        const secours = numeroUrgence(this.state.pays);
        const operateur = this.state.numeroOperateur;

        // L'ordre n'est pas esthétique. Sur Android, React Native suit la
        // convention du système : avec trois boutons, le premier est le
        // « neutre » (à gauche) et le dernier le « positif » (à droite, mis
        // en avant). Les secours sont donc EN DERNIER dans ce tableau pour
        // être le bouton le plus visible à l'écran. Sur iOS, « cancel » est
        // de toute façon renvoyé en bas de la liste.
        const choix = [
            { text: languageJSON.cancel, style: 'cancel' },
        ];
        if (operateur) {
            choix.push({
                text: languageJSON.panic_operateur,
                onPress: () => this._appeler(operateur),
            });
        }
        choix.push({
            text: languageJSON.panic_secours + ' (' + secours + ')',
            style: 'destructive',
            onPress: () => this._appeler(secours),
        });

        Alert.alert(languageJSON.panic_text, languageJSON.panic_question, choix);
    };

    render() {
        return (
            <TouchableOpacity
                style={[styles.bouton, this.props.style]}
                onPress={this._demander}
                accessibilityRole="button"
                accessibilityLabel={languageJSON.panic_text}
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
