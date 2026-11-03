// Crédit chauffeur : solde courant et recharge.
// Le solde est lu en temps réel depuis users/<uid>/walletBalance (écrit par le
// serveur : recharges, commissions). La recharge ouvre la page du prestataire ;
// au retour dans l'app, on demande au serveur de confirmer la session si sa
// notification n'a pas encore crédité le solde.
import React from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, Linking, AppState, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
import { base_url } from '../common/key';

// Les moyens de recharge, tous batis pareil : une page de paiement ouverte
// dans le navigateur, puis le serveur qui credite le solde. L'application
// n'embarque donc aucun module de paiement.
//
// Au Senegal, deux portefeuilles mobiles ; ailleurs, la carte bancaire. Le
// pays ne suffit plus a designer le prestataire, d'ou le choix laisse au
// chauffeur quand les deux sont ouverts.
const WAVE_COUNTRY = 'SN';

const PROVIDERS = {
  wave: {
    presets: [1000, 2500, 5000, 10000],
    min: 1000,
    create: 'createWaveCheckout',
    confirm: 'confirmWaveCheckout',
    label: () => languageJSON.topup_provider_wave,
    confirmLabel: () => languageJSON.topup_confirm,
    hint: () => languageJSON.topup_hint,
    round: (value) => Math.round(value),
  },
  orange: {
    presets: [1000, 2500, 5000, 10000],
    min: 1000,
    create: 'createOrangeCheckout',
    confirm: 'confirmOrangeCheckout',
    label: () => languageJSON.topup_provider_orange,
    confirmLabel: () => languageJSON.topup_confirm_orange,
    hint: () => languageJSON.topup_hint_orange,
    round: (value) => Math.round(value),
  },
  card: {
    presets: [10, 20, 50, 100],
    min: 5,
    create: 'createCardTopup',
    confirm: 'confirmCardTopup',
    label: () => languageJSON.topup_provider_card,
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
  state = { balance: 0, history: null, modalVisible: false, amount: '', loading: false, pendingSession: null, waveEnabled: false, orangeEnabled: false, moyenChoisi: null, moyenEnCours: null, country: null, currencies: [], payoutsEnabled: false, accountStatus: null, apercu: null };

  componentDidMount() {
    const uid = firebase.auth().currentUser.uid;
    this.countryRef = firebase.database().ref('users/' + uid + '/country');
    this.countryRef.on('value', (snapshot) => this.setState({ country: snapshot.val() }));
    // Le crédit prépayé et ses recharges ne s'affichent que si l'exploitant les
    // a activés (credit_settings/waveEnabled, orangeEnabled — une fois les clés
    // du prestataire posées côté serveur). Activable à distance, sans nouveau
    // build, et un drapeau par prestataire : le compte marchand de l'un
    // n'implique pas celui de l'autre.
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
    this.waveEnabledRef = firebase.database().ref('credit_settings/waveEnabled');
    this.waveEnabledRef.on('value', (snapshot) => this.setState({ waveEnabled: snapshot.val() === true }));
    this.orangeEnabledRef = firebase.database().ref('credit_settings/orangeEnabled');
    this.orangeEnabledRef.on('value', (snapshot) => this.setState({ orangeEnabled: snapshot.val() === true }));
    this.balanceRef = firebase.database().ref('users/' + uid + '/walletBalance');
    this.balanceRef.on('value', (snapshot) => this.setState({ balance: Number(snapshot.val()) || 0 }));
    // Etat du dossier bancaire, tenu a jour par le serveur a partir des
    // notifications de Stripe : le chauffeur voit son avancement sans rien faire.
    this.payoutsRef = firebase.database().ref('users/' + uid + '/stripe_payouts_enabled');
    this.payoutsRef.on('value', (snapshot) => this.setState({ payoutsEnabled: snapshot.val() === true }));
    this.statusRef = firebase.database().ref('users/' + uid + '/stripe_account_status');
    this.statusRef.on('value', (snapshot) => this.setState({ accountStatus: snapshot.val() }));
    this.chargerApercu();
    this.appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && this.state.pendingSession) this.confirmPending();
    });
  }

  componentWillUnmount() {
    if (this.countryRef) this.countryRef.off();
    if (this.waveEnabledRef) this.waveEnabledRef.off();
    if (this.orangeEnabledRef) this.orangeEnabledRef.off();
    if (this.balanceRef) this.balanceRef.off();
    if (this.payoutsRef) this.payoutsRef.off();
    if (this.statusRef) this.statusRef.off();
    if (this.appStateSubscription) this.appStateSubscription.remove();
  }

  /**
   * Les moyens de recharge ouverts a ce chauffeur.
   *
   * Au Senegal, les deux portefeuilles mobiles, chacun derriere son drapeau.
   * Ailleurs, la carte bancaire, qui ne depend que de Stripe et n'a donc pas
   * de drapeau : c'est aussi la que le chauffeur voit sa part des courses
   * payees par carte, et masquer l'ecran le priverait de ses gains.
   */
  moyensDeRecharge() {
    if (this.state.country !== WAVE_COUNTRY) return ['card'];
    const moyens = [];
    if (this.state.waveEnabled) moyens.push('wave');
    if (this.state.orangeEnabled) moyens.push('orange');
    return moyens;
  }

  /**
   * Le moyen retenu : celui que le chauffeur a choisi, ou le premier ouvert.
   *
   * Le choix vit dans l'etat, et non plus dans le pays, parce qu'au Senegal il
   * y en a desormais deux. On revient au premier ouvert si le choix ne l'est
   * plus : l'exploitant peut fermer un prestataire pendant que l'ecran est
   * affiche, et il ne faut pas que le bouton ouvre une page morte.
   */
  moyen() {
    const ouverts = this.moyensDeRecharge();
    if (this.state.moyenChoisi && ouverts.includes(this.state.moyenChoisi)) {
      return this.state.moyenChoisi;
    }
    return ouverts[0] || 'card';
  }

  provider() {
    return PROVIDERS[this.moyen()];
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
      Alert.alert(languageJSON.error, languageJSON.topup_min_error.replace('{min}', provider.min.toLocaleString(languageJSON.locale) + ' ' + this.symbol()));
      return;
    }
    this.setState({ loading: true });
    try {
      const data = await callFunction(provider.create, { amount, currency: this.currency() });
      // Le prestataire est retenu avec la session : entre l'ouverture et la
      // confirmation, le chauffeur peut avoir change de moyen dans la fenetre.
      // Interroger celui qui est selectionne a cet instant plutot que celui qui
      // a ouvert la session ferait chercher la recharge chez le mauvais.
      this.setState({ loading: false, modalVisible: false, amount: '', pendingSession: data.sessionId, moyenEnCours: this.moyen() });
      await Linking.openURL(data.launchUrl);
    } catch (error) {
      this.setState({ loading: false });
      Alert.alert(languageJSON.error, error.message || String(error));
    }
  };

  confirmPending = async () => {
    const sessionId = this.state.pendingSession;
    if (!sessionId) return;
    const prestataire = PROVIDERS[this.state.moyenEnCours] || this.provider();
    try {
      const data = await callFunction(prestataire.confirm, { sessionId });
      if (data.status === 'completed') {
        this.setState({ pendingSession: null, moyenEnCours: null });
        Alert.alert(languageJSON.topup_title, languageJSON.topup_success);
      } else if (data.status === 'failed') {
        this.setState({ pendingSession: null, moyenEnCours: null });
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

  // Ce qui partira lundi, demande au serveur a l'ouverture de l'ecran. Le
  // chauffeur ne declenche plus de versement : il consulte.
  chargerApercu = async () => {
    try {
      const apercu = await callFunction('requestDriverPayout', { preview: true });
      this.setState({ apercu });
    } catch (error) {
      // Un apercu indisponible ne doit pas abimer l'ecran : le solde, lui,
      // reste affiche.
      console.log('[Versement] aperçu indisponible', error && error.message);
    }
  };



  render() {
    // Au Senegal, la carte ne s'affiche que si au moins un portefeuille est
    // ouvert : sans aucun, il n'y aurait rien a recharger. Ailleurs,
    // moyensDeRecharge rend toujours la carte bancaire, et le portefeuille
    // reste donc visible quoi qu'il arrive — c'est la que le chauffeur voit sa
    // part des courses payees par carte, et qu'il ouvre son dossier bancaire.
    // Le masquer derriere un drapeau le priverait de ses gains sans explication.
    if (this.moyensDeRecharge().length === 0) return null;
    const provider = this.provider();
    const symbol = this.symbol();
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.soldeBloc}>
            <Text style={styles.label}>{languageJSON.credit_balance}</Text>
            <Text style={styles.balance}>{this.state.balance.toLocaleString(languageJSON.locale)} {symbol}</Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={() => this.setState({ modalVisible: true })}>
            <Text style={styles.buttonText}>{languageJSON.topup_button}</Text>
          </TouchableOpacity>
        </View>
        {/* Deux boutons cote a cote debordaient de l'ecran et recouvraient le
            libelle du solde : « Recevoir mes gains » est long, et la largeur
            d'un telephone ne se negocie pas. L'inscription bancaire prend donc
            sa propre ligne, pleine largeur. */}
        {this.canWithdraw() ? null : (
          <TouchableOpacity style={[styles.button, styles.buttonGhost, styles.buttonWide]} onPress={this.startBankSetup} disabled={this.state.loading}>
            <Text style={[styles.buttonText, styles.buttonGhostText]}>{languageJSON.payout_setup}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.pending}>{languageJSON.credit_commission_note}</Text>
        {this.canWithdraw() ? <Text style={styles.pending}>{languageJSON.payout_weekly}</Text> : null}
        {this.state.apercu && this.state.apercu.available > 0 ? (
          <Text style={styles.pending}>
            {languageJSON.payout_available}
            {this.state.apercu.available.toLocaleString(languageJSON.locale)} {this.state.apercu.currency}
          </Text>
        ) : null}
        {this.state.apercu && this.state.apercu.held > 0 ? (
          <Text style={styles.pending}>
            {languageJSON.payout_held}
            {this.state.apercu.held.toLocaleString(languageJSON.locale)} {this.state.apercu.currency}
            {' — '}{languageJSON.payout_held_note}
          </Text>
        ) : null}
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
              {/* Le choix n'apparait que s'il y a de quoi choisir : un seul
                  prestataire ouvert, et la question ne se pose pas. */}
              {this.moyensDeRecharge().length > 1 ? (
                <View style={styles.moyens}>
                  {this.moyensDeRecharge().map((cle) => (
                    <TouchableOpacity
                      key={cle}
                      style={[styles.moyen, this.moyen() === cle && styles.moyenActif]}
                      onPress={() => this.setState({ moyenChoisi: cle })}>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.moyenTexte, this.moyen() === cle && styles.moyenTexteActif]}>
                        {PROVIDERS[cle].label()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <Text style={styles.sheetHint}>{provider.hint()}</Text>
              <View style={styles.presets}>
                {provider.presets.map((value) => (
                  <TouchableOpacity key={value} style={[styles.preset, String(value) === this.state.amount && styles.presetActive]} onPress={() => this.setState({ amount: String(value) })}>
                    <Text style={[styles.presetText, String(value) === this.state.amount && styles.presetTextActive]}>{value.toLocaleString(languageJSON.locale)}</Text>
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
  soldeBloc: { flex: 1, marginRight: 12 },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.PRIMARY },
  buttonGhostText: { color: colors.PRIMARY },
  buttonText: { fontFamily: 'Montserrat-SemiBold', fontSize: 14, color: colors.WHITE },
  pending: { marginTop: 10, fontFamily: 'Montserrat-Regular', fontSize: 12, color: colors.GREY.secondary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.WHITE, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontFamily: 'Montserrat-Bold', fontSize: 18, color: colors.PRIMARY },
  sheetHint: { fontFamily: 'Montserrat-Regular', fontSize: 13, color: colors.GREY.secondary, marginTop: 4, marginBottom: 16 },
  moyens: { flexDirection: 'row', gap: 8, marginTop: 14 },
  moyen: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.GREY.border, alignItems: 'center' },
  moyenActif: { backgroundColor: colors.PRIMARY, borderColor: colors.PRIMARY },
  moyenTexte: { fontFamily: 'Montserrat-SemiBold', fontSize: 13, color: colors.PRIMARY },
  moyenTexteActif: { color: colors.WHITE },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.GREY.border },
  presetActive: { backgroundColor: colors.PRIMARY, borderColor: colors.PRIMARY },
  presetText: { fontFamily: 'Montserrat-SemiBold', color: colors.PRIMARY },
  presetTextActive: { color: colors.WHITE },
  input: { marginTop: 14, borderWidth: 1, borderColor: colors.GREY.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Montserrat-Regular', fontSize: 16, color: colors.PRIMARY },
  cancel: { alignItems: 'center', marginTop: 14 },
  cancelText: { fontFamily: 'Montserrat-Regular', color: colors.GREY.secondary },
});
