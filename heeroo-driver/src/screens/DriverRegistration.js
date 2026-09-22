import React from 'react';
import {
  StyleSheet,
  View,
  Alert
} from 'react-native';
import { DiverReg } from '../components';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import languageJSON from '../common/language';
import { google_map_key } from '../common/key';
import { checkLocationPermission, checkCameraPermission } from "../common/permission";
import Geolocation from '../common/geolocation';
import Geocoder from 'react-native-geocoding';

export default class DriverRegistrationPage extends React.Component {
  constructor(props) {
    super(props);
    Geocoder.init(google_map_key);
    this.state = {
      loading: false,
      country: null
    }
  }

  componentDidMount() {
    console.log('check permission')
    checkLocationPermission().then((result) => {
      checkCameraPermission().then((result) => {
        this.getCountry()
      })
    })

  }

  getCountry = async () => {


    Geolocation.getCurrentPosition(
      position => {

        Geocoder.from(position.coords.latitude, position.coords.longitude)
          .then(json => {

            let isoCountryCode = null;

            json.results[0].address_components.forEach(element => {
              if (element.types[0] == "country") {
                isoCountryCode = element.short_name
                this.setState({ country: isoCountryCode });
              }
            });


          })
          .catch((error) => {
            console.log('error')
            console.log(error)
          });
      },
      error => {
        console.log('error from current pos from driver reg')
        console.log(error)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
    );
  }



  checkIfCountryAvailable(value) {

    let result = null
    let data = value

    data.forEach(element => {


      if (this.state.country == element.country) {
        result = this.state.country
      }
    });

    if (result == null) {
      result = "FR"
    }
    return result

  }


  //register button click after all validation
  // Retour depuis l'inscription = abandon : déconnexion, l'écouteur
  // d'authentification de AuthLoadingScreen ramène au login.
  cancelRegistration = () => {
    firebase.auth().signOut();
  }

  clickRegister = async (fname, lname, mobile, email, vehicleNum, vehicleName, image, companyName, companyAddress, file_identity_front,
    file_identity_back, carteGrise, permis, carteVTC, rir, attestation, carteVerte, assuranceRC, photoAvantVehicule, photoChauffeur
  ) => {
    // Chaque échec était silencieux (paramètres absents, session expirée,
    // écriture refusée) : le bouton « S'inscrire » paraissait sans effet.
    try {
      this.setState({ loading: true });
      const snapshot = await firebase.database().ref('settings/').once('value');
      if (!snapshot.exists()) throw new Error("paramètres de l'application indisponibles");

      const regData = {
        firstName: fname,
        lastName: lname,
        mobile: mobile,
        email: email,
        vehicleNumber: vehicleNum,
        vehicleModel: vehicleName,
        licenseImage: image,
        usertype: 'driver',
        approved: false,
        queue: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        companyAddress,
        companyName,
        file_identity_front,
        file_identity_back,
        carteGrise,
        permis,
        carteVTC,
        rir,
        attestation,
        carteVerte,
        assuranceRC,
        photoAvantVehicule,
        photoChauffeur,
        country: this.checkIfCountryAvailable(snapshot.val()),
      };

      const user = firebase.auth().currentUser;
      if (!user) throw new Error("session expirée, reconnectez-vous avant de finaliser l'inscription");
      await user.updateProfile({ displayName: regData.firstName + ' ' + regData.lastName });
      await firebase.database().ref('users/').child(user.uid).set(regData);
      await firebase.auth().signOut();

      this.setState({ loading: false });
      this.props.navigation.goBack();
      Alert.alert(languageJSON.register_link || 'Inscription', languageJSON.account_successful_done);
    } catch (error) {
      console.log('[Inscription chauffeur] échec', error && error.code, error && error.message);
      this.setState({ loading: false });
      Alert.alert(languageJSON.error || 'Erreur', "L'inscription n'a pas pu être enregistrée : " + ((error && error.message) || 'erreur inconnue'));
    }
  }

  //upload of picture
  uploadmultimedia = async (fname, lname, mobile, email, vehicleNum, vehicleName, uri, companyName, companyAddress) => {
    this.setState({ loading: true });
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      if ((blob.size / 1000000) > 2) {
        this.setState({ loading: false });
        Alert.alert(languageJSON.error, languageJSON.image_size_error);
        return;
      }
      const timestamp = new Date().getTime();
      const imageRef = firebase.storage().ref().child('users/driver_licenses/' + timestamp + '/');
      await imageRef.put(blob);
      const dwnldurl = await imageRef.getDownloadURL();
      this.clickRegister(fname, lname, mobile, email, vehicleNum, vehicleName, dwnldurl, companyName, companyAddress);
    } catch (error) {
      console.log('[DriverRegistration] upload licence échoué', error);
      this.setState({ loading: false });
      Alert.alert(languageJSON.error || 'Erreur', "L'envoi de l'image a échoué. Réessayez.");
    }
  }

  render() {
    const registrationData = this.props.route.params.requireData
    return (
      <View style={styles.containerView}>
        <DiverReg reqData={registrationData ? registrationData : ""} onPressRegister={this.clickRegister} onBack={() => this.cancelRegistration()} navigation={this.props.navigation} loading={this.state.loading}></DiverReg>
      </View>
    );
  }
}
//
//Screen Styling
const styles = StyleSheet.create({
  containerView: {
    flex: 1,
  },
  textContainer: { textAlign: "center" },
});