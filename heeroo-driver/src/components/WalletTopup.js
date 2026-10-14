// Crédit chauffeur : solde courant et recharge via Wave.
// Le solde est lu en temps réel depuis users/<uid>/walletBalance (écrit par le
// serveur : recharges Wave, commissions). La recharge ouvre l'app Wave ; au
// retour dans l'app, on demande au serveur de confirmer la session si le
// webhook n'a pas encore crédité le solde.
import React from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, Linking, AppState, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
import { base_url } from '../common/key';

// Deux moyens de recharge selon le pays : Wave la ou il opere (Senegal), la
// carte bancaire ailleurs. Les deux suivent le meme chemin — une page de
// paiement ouverte dans le navigateur, puis le serveur qui credite le solde —
// de sorte que l'application n'embarque aucun module de paiement.
const WAVE_COUNTRY = 'SN';


const PROVIDERS = {
  wave: {
    presets: [1000, 2500, 5000, 10000],
    min: 1000,
    create: 'createWaveCheckout',
    confirm: 'confirmWaveCheckout',
    confirmLabel: () => languageJSON.topup_confirm,
    hint: () => languageJSON.topup_hint,
    round: (value) => Math.round(value),
  },
  card: {
    presets: [10, 20, 50, 100],
    min: 5,
    create: 'createCardTopup',
    confirm: 'confirmCardTopup',
    confirmLabel: () => languageJSON.topup_confirm_card,
    hint: () => languageJSON.topup_hint_card,
    round: (value) => Math.round(value * 100) / 100,
  },
};

async function callFunction(name, body) {
  const idToken = await firebase.auth().currentUser.getIdToken();
  const response = await fetch(base_url + name, {
    method: 'post',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

export default class WalletTopup extends React.Component {
  state = { balance: 0, history: null, modalVisible: false, amount: '', loading: false, pendingSession: null, enabled: false, country: null, currencies: [], payoutsEnabled: false, accountStatus: null };

  componentDidMount() {
    const uid = firebase.auth().currentUser.uid;
    this.countryRef = firebase.database().ref('users/' + uid + '/country');
    this.countryRef.on('value', (snapshot) => this.setState({ country: snapshot.val() }));
    // Le crédit prépayé et sa recharge Wave ne s'affichent que si l'exploitant
    // les a activés (credit_settings/waveEnabled = true, une fois la clé Wave
    // posée côté serveur). Activable à distance, sans nouveau build.
    //
    // Sous credit_settings et non sous settings : ce dernier est un tableau de
    // pays, et y ajouter une clé nommée le convertirait en objet, ce qui casse
    // les parcours de liste dans les écrans.
    // Le pays arrive de facon asynchrone : on garde la table des monnaies et on
    // en deduit le symbole a l'affichage, quand les deux sont connus.
    firebase.database().ref('settings').once('value', (snapshot) => {
      const list = snapshot.val();
      this.setState({ currencies: Array.isArray(list) ? list : Object.values(list || {}) });
    });
    this.enabledRef = firebase.database().ref('credit_settings/waveEnabled');
    this.enabledRef.on('value', (snapshot) => this.setState({ enabled: snapshot.val() === true }));
    this.balanceRef = firebase.database().ref('users/' + uid + '/walletBalance');
    this.balanceRef.on('value', (snapshot) => this.setState({ balance: Number(snapshot.val()) || 0 }));
    // Etat du dossier bancaire, tenu a jour par le serveur a partir des
    // notifications de Stripe : le chauffeur voit son avancement sans rien faire.
    this.payoutsRef = firebase.database().ref('users/' + uid + '/stripe_payouts_enabled');
    this.payoutsRef.on('value', (snapshot) => this.setState({ payoutsEnabled: snapshot.val() === true }));
    this.statusRef = firebase.database().ref('users/' + uid + '/stripe_account_status');
    this.statusRef.on('value', (snapshot) => this.setState({ accountStatus: snapshot.val() }));
    this.appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && this.state.pendingSession) this.confirmPending();
    });
  }

  componentWillUnmount() {
    if (this.countryRef) this.countryRef.off();
    if (this.enabledRef) this.enabledRef.off();
    if (this.balanceRef) this.balanceRef.off();
    if (this.payoutsRef) this.payoutsRef.off();
    if (this.statusRef) this.statusRef.off();
    if (this.appStateSubscription) this.appStateSubscription.remove();
  }

  /** Wave au Senegal, carte bancaire ailleurs. */
  provider() {
    return this.state.country === WAVE_COUNTRY ? PROVIDERS.wave : PROVIDERS.card;
  }

  /**
   * Code ISO de la monnaie du chauffeur, d'apres son pays.
   *
   * Le back-office laisse saisir ce code librement et contient par exemple
   * « FCFA », qui n'est pas un code ISO : on ne le retient que s'il en a la
   * forme, sinon on retombe sur la monnaie du pays.
   */
  currency() {
    const row = this.state.currencies.find((entry) => entry && entry.country === this.state.country);
    const code = row && row.code ? String(row.code).trim().toUpperCase() : '';
    if (/^[A-Z]{3}$/.test(code)) return code;
    return this.state.country === WAVE_COUNTRY ? 'XOF' : 'EUR';
  }

  /** Symbole affiche a cote du solde. */
  symbol() {
    const row = this.state.currencies.find((entry) => entry && entry.country === this.state.country);
    return (row && row.symbol && String(row.symbol).trim()) || (this.state.country === WAVE_COUNTRY ? 'FCFA' : '');
  }

  startTopup = async () => {
    const provider = this.provider();
    const amount = provider.round(Number(this.state.amount));
    if (!(amount >= provider.min)) {
      Alert.alert(languageJSON.error, languageJSON.topup_min_error.replace('{min}', provider.min.toLocaleString('fr-FR') + ' ' + this.symbol()));
      return;
    }
    this.setState({ loading: true });
    try {
      const data = await callFunction(provider.create, { amount, currency: this.currency() });
      this.setState({ loading: false, modalVisible: false, amount: '', pendingSession: data.sessionId });
      await Linking.openURL(data.launchUrl);
    } catch (error) {
      this.setState({ loading: false });
      Alert.alert(languageJSON.error, error.message || String(error));
    }
  };

  confirmPending = async () => {
    const sessionId = this.state.pendingSession;
    if (!sessionId) return;
    try {
      const data = await callFunction(this.provider().confirm, { sessionId });
      if (data.status === 'completed') {
        this.setState({ pendingSession: null });
        Alert.alert(languageJSON.topup_title, languageJSON.topup_success);
      } else if (data.status === 'failed') {
        this.setState({ pendingSession: null });
        Alert.alert(languageJSON.topup_title, languageJSON.topup_failed);
      }
      // 'pending' : le prestataire n'a pas encore confirmé ; le solde se mettra à jour tout seul.
    } catch (error) {
      console.log('[recharge] confirmation', error);
    }
  };

  // Inscription bancaire du chauffeur. Le parcours est tenu par Stripe, dans le
  // navigateur : piece d'identite et IBAN ne passent jamais par l'application.
  // Le lien expire en quelques minutes, on le redemande a chaque fois.
  startBankSetup = async () => {
    this.setState({ loading: true });
    try {
      const result = await callFunction('startDriverStripeOnboarding', {});
      await Linking.openURL(result.url);
    } catch (error) {
      Alert.alert(languageJSON.payout_setup_title, error && error.message ? error.message : '');
    } finally {
      this.setState({ loading: false });
    }
  };

  // Retrait du crédit vers le compte Wave du chauffeur. Le serveur débite le
  // solde avant d'appeler Wave et le restitue si le versement échoue : l'écran
  // n'a donc rien à rattraper, il affiche ce qui s'est passé.
  /** Un versement est possible des qu'un canal existe : Wave, ou un compte bancaire valide. */
  canWithdraw() {
    return this.state.country === WAVE_COUNTRY || this.state.payoutsEnabled;
  }

  // On demande d'abord au serveur ce qui est reellement retirable : une part de
  // course payee par carte reste bloquee quelques jours. Afficher le solde
  // entier puis n'en verser qu'une partie serait incomprehensible.
  askPayout = async () => {
    this.setState({ loading: true });
    let apercu;
    try {
      apercu = await callFunction('requestDriverPayout', { preview: true });
    } catch (error) {
      Alert.alert(languageJSON.payout_title, error && error.message ? error.message : '');
      return;
    } finally {
      this.setState({ loading: false });
    }

    const devise = ' ' + apercu.currency;
    if (apercu.available < apercu.minimum) {
      const detail = apercu.held > 0
        ? '\n\n' + languageJSON.payout_held + apercu.held.toLocaleString('fr-FR') + devise + '\n' + languageJSON.payout_held_note
        : '';
      Alert.alert(languageJSON.payout_title, languageJSON.payout_min + detail);
      return;
    }

    const retenu = apercu.held > 0
      ? '\n' + languageJSON.payout_held + apercu.held.toLocaleString('fr-FR') + devise
      : '';
    Alert.alert(
      languageJSON.payout_title,
      languageJSON.payout_question + '\n\n' + apercu.available.toLocaleString('fr-FR') + devise + retenu + '\n\n' + languageJSON.payout_hint,
      [
        { text: languageJSON.cancel, style: 'cancel' },
        { text: languageJSON.payout_confirm, onPress: this.doPayout },
      ],
    );
  };

  doPayout = async () => {
    this.setState({ loading: true });
    try {
      const result = await callFunction('requestDriverPayout', {});
      Alert.alert(languageJSON.payout_title, languageJSON.payout_done + Number(result.amount).toLocaleString('fr-FR') + ' ' + result.currency);
    } catch (error) {
      Alert.alert(languageJSON.payout_title, languageJSON.payout_failed + (error && error.message ? error.message : ''));
    } finally {
      this.setState({ loading: false });
    }
  };

  render() {
    // Le drapeau credit_settings/waveEnabled commande la recharge Wave, donc le
    // Senegal. Ailleurs, le portefeuille doit rester visible quoi qu'il arrive :
    // c'est la que le chauffeur voit sa part des courses payees par carte, et
    // qu'il ouvre son dossier bancaire. Le masquer derriere un drapeau Wave le
    // priverait de ses gains sans explication.
    if (this.state.country === WAVE_COUNTRY && !this.state.enabled) return null;
    const provider = this.provider();
    const symbol = this.symbol();
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>{languageJSON.credit_balance}</Text>
            <Text style={styles.balance}>{this.state.balance.toLocaleString('fr-FR')} {symbol}</Text>
          </View>
          <View style={styles.actions}>
            {this.canWithdraw() ? (
              <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={this.askPayout} disabled={this.state.loading}>
                <Text style={[styles.buttonText, styles.buttonGhostText]}>{languageJSON.payout_button}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={this.startBankSetup} disabled={this.state.loading}>
                <Text style={[styles.buttonText, styles.buttonGhostText]}>{languageJSON.payout_setup}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.button} onPress={() => this.setState({ modalVisible: true })}>
              <Text style={styles.buttonText}>{languageJSON.topup_button}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.pending}>{languageJSON.credit_commission_note}</Text>
        {!this.canWithdraw() && this.state.accountStatus === 'en_verification' ? (
          <Text style={styles.pending}>{languageJSON.payout_pending_check}</Text>
        ) : null}
        {!this.canWithdraw() && this.state.accountStatus === 'pieces_manquantes' ? (
          <Text style={styles.pending}>{languageJSON.payout_missing_docs}</Text>
        ) : null}
        {this.state.pendingSession ? <Text style={styles.pending}>{languageJSON.topup_pending}</Text> : null}

        <Modal animationType="slide" transparent visible={this.state.modalVisible} onRequestClose={() => this.setState({ modalVisible: false })}>
          <View style={styles.backdrop}>
            {/* La marge basse suit la barre de navigation du telephone : avec une
                valeur fixe, le bouton d'annulation passait dessous et devenait
                inatteignable. */}
            <SafeAreaView edges={['bottom']} style={styles.sheet}>
              <Text style={styles.sheetTitle}>{languageJSON.topup_title}</Text>
              <Text style={styles.sheetHint}>{provider.hint()}</Text>
              <View style={styles.presets}>
                {provider.presets.map((value) => (
                  <TouchableOpacity key={value} style={[styles.preset, String(value) === this.state.amount && styles.presetActive]} onPress={() => this.setState({ amount: String(value) })}>
                    <Text style={[styles.presetText, String(value) === this.state.amount && styles.presetTextActive]}>{value.toLocaleString('fr-FR')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder={languageJSON.topup_amount_placeholder.replace('{devise}', symbol)}
                placeholderTextColor={colors.GREY.secondary}
                value={this.state.amount}
                onChangeText={(amount) => this.setState({ amount: amount.replace(/[^0-9]/g, '') })}
              />
              <TouchableOpacity style={[styles.button, styles.buttonWide]} onPress={this.startTopup} disabled={this.state.loading}>
                {this.state.loading ? <ActivityIndicator color={colors.WHITE} /> : <Text style={styles.buttonText}>{provider.confirmLabel()}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancel} onPress={() => this.setState({ modalVisible: false })}>
                <Text style={styles.cancelText}>{languageJSON.cancel}</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </Modal>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, backgroundColor: colors.WHITE, borderWidth: 1, borderColor: colors.GREY.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: 'Montserrat-Regular', fontSize: 12, color: colors.GREY.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  balance: { fontFamily: 'Montserrat-Bold', fontSize: 22, color: colors.PRIMARY, marginTop: 2 },
  button: { backgroundColor: colors.PRIMARY, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonWide: { marginTop: 14 },
  actions: { flexDirection: 'row', gap: 8 },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.PRIMARY },
  buttonGhostText: { color: colors.PRIMARY },
  buttonText: { fontFamily: 'Montserrat-SemiBold', fontSize: 14, color: colors.WHITE },
  pending: { marginTop: 10, fontFamily: 'Montserrat-Regular', fontSize: 12, color: colors.GREY.secondary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.WHITE, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontFamily: 'Montserrat-Bold', fontSize: 18, color: colors.PRIMARY },
  sheetHint: { fontFamily: 'Montserrat-Regular', fontSize: 13, color: colors.GREY.secondary, marginTop: 4, marginBottom: 16 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.GREY.border },
  presetActive: { backgroundColor: colors.PRIMARY, borderColor: colors.PRIMARY },
  presetText: { fontFamily: 'Montserrat-SemiBold', color: colors.PRIMARY },
  presetTextActive: { color: colors.WHITE },
  input: { marginTop: 14, borderWidth: 1, borderColor: colors.GREY.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Montserrat-Regular', fontSize: 16, color: colors.PRIMARY },
  cancel: { alignItems: 'center', marginTop: 14 },
  cancelText: { fontFamily: 'Montserrat-Regular', color: colors.GREY.secondary },
});
