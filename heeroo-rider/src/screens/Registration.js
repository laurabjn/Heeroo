import React from 'react';
import { Registration } from '../components';
import { StyleSheet, View, Alert } from 'react-native';
import firebase from 'firebase/compat/app';
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

  // Retour depuis l'écran de profil = abandon de l'inscription : on se déconnecte,
  // l'écouteur d'authentification de AuthLoadingScreen ramène au login.
  cancelRegistration() {
    firebase.auth().signOut();
  }

  updateProfile(data) {
    firebase.auth().currentUser.updateProfile({
      displayName: data.firstName + ' ' + data.lastName,
    }).then(() => {
      firebase.database().ref('users/').child(firebase.auth().currentUser.uid).set(data).then(() => {
        this.props.navigation.reset({ index: 0, routes: [{ name: 'Root' }] });
      });
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
