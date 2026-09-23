import React from 'react';
import { Registration } from '../components';
import { StyleSheet, View, Alert } from 'react-native';
import languageJSON from '../common/language';
import firebase from 'firebase/compat/app';
import { getAuth, updateProfile as setDisplayName } from 'firebase/auth';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import Geolocation from '../common/geolocation';
import { checkLocationPermission } from '../common/permission';
import Geocoder from 'react-native-geocoding';

export default class RegistrationPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false
    }
  }
  componentDidMount() {
    this.getCountry()
  }
  getCountry = async () => {

    if (checkLocationPermission()) {

      Geolocation.getCurrentPosition(
        position => {

          Geocoder.from(position.coords.latitude, position.coords.longitude)
            .then(json => {
              let isoCountryCode = null;
              json.results[0].address_components.forEach(element => {
                if (element.types[0] == "country") {
                  isoCountryCode = element.short_name
                }
              });

              this.setState({ country: isoCountryCode });
            })
            .catch(error => console.warn(error));
        },
        error => Alert.alert('Error', JSON.stringify(error)),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
      );

    }
  }

  checkIfCountryAvailable(value) {

    let result = null
    // Les paramètres peuvent revenir sous forme de liste ou d'objet selon les
    // clés présentes : on normalise avant de parcourir.
    const data = Array.isArray(value) ? value : Object.values(value || {});

    const dataList = Array.isArray(data) ? data : Object.values(data || {});
    dataList.forEach(element => {


      if (this.state.country == element.country) {
        result = this.state.country
      }
    });

    if (result == null) {
      result = "FR"
    }
    return result

  }

  // Retour depuis l'écran de profil = abandon de l'inscription : on se déconnecte,
  // l'écouteur d'authentification de AuthLoadingScreen ramène au login.
  cancelRegistration() {
    firebase.auth().signOut();
  }

  updateProfile(data) {
    // updateProfile n'existe pas sur l'utilisateur renvoyé par l'API moderne :
    // on passe par la fonction dédiée, et l'échec du nom affiché ne bloque pas
    // la création du compte (le profil en base fait foi).
    const currentUser = getAuth().currentUser || firebase.auth().currentUser;
    setDisplayName(currentUser, {
      displayName: data.firstName + ' ' + data.lastName,
    }).then(() => {
      return firebase.database().ref('users/').child(firebase.auth().currentUser.uid).set(data);
    }).then(() => {
      this.props.navigation.reset({ index: 0, routes: [{ name: 'Root' }] });
    }).catch((error) => {
      console.log('[Registration] échec de la création du profil', error);
      this.setState({ loading: false });
      Alert.alert(languageJSON.Error, error.message || String(error));
    });
  }
  async clickRegister(fname, lname, email, mobile, viaRef, referralVia) {
    this.setState({ loading: true })
    let result
    let regData
    console.log('on tente de register vers firebase')
    firebase.database().ref('settings/').once('value').then((snapshot) => {
      // test si le check du pays passe avant la creation de l'objet regdata

      if (snapshot.exists()) {
        result = this.checkIfCountryAvailable(snapshot.val())


        regData = {
          firstName: fname,
          lastName: lname,
          mobile: mobile,
          email: email,
          usertype: 'rider',
          signupViaReferral: viaRef,
          referarDetails: referralVia,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          country: result
        }
        console.log("clickregister end")
        this.updateProfile(regData)
      }
    });
  }


  render() {
    const registrationData = this.props.route.params.requireData
    return (
      <View style={styles.containerView} >
        <Registration reqData={registrationData ? registrationData : ""}
          onPressRegister={(fname, lname, email, mobile, password, viaRef, referralVia) => this.clickRegister(fname, lname, email, mobile, password, viaRef, referralVia)}
          onPress={() => { this.clickRegister() }} onBack={() => this.cancelRegistration()} navigation={this.props.navigation} loading={this.state.loading}>
        </Registration>
      </View>
    );
  }
}
const styles = StyleSheet.create({
  containerView: { flex: 1 },
  textContainer: { textAlign: "center" },
});
