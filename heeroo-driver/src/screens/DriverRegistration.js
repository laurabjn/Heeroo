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

  updateProfile(data) {

    firebase.auth().currentUser.updateProfile({
      displayName: data.firstName + ' ' + data.lastName,
    }).then(() => {
      firebase.database().ref('users/').child(firebase.auth().currentUser.uid).set(data).then(() => {
        firebase.auth().signOut();
        this.props.navigation.goBack();
        Alert.alert(languageJSON.error, languageJSON.account_successful_done);
      }).catch((error) => {
        console.log("error", error);
      })
    });

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

    let result
    let regData

    firebase.database().ref('settings/').once('value').then((snapshot) => {
      // test si le check du pays passe avant la creation de l'objet regdata

      if (snapshot.exists()) {
        result = this.checkIfCountryAvailable(snapshot.val())

        regData = {
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
          country: result,
        }

        this.updateProfile(regData)
      }

    });
  }

  //upload of picture
  uploadmultimedia = async (fname, lname, mobile, email, vehicleNum, vehicleName, url, companyName, companyAddress) => {
    this.setState({ loading: true })
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response); // when BlobModule finishes reading, resolve with the blob
      };
      xhr.onerror = function () {
        reject(new TypeError('Network request failed')); // error occurred, rejecting
      };
      xhr.responseType = 'blob'; // use BlobModule's UriHandler
      xhr.open('GET', url, true); // fetch the blob from uri in async mode
      xhr.send(null); // no initial data
    });

    if ((blob.size / 1000000) > 2) {
      this.setState({ loading: false }, () => { Alert.alert(languageJSON.error, languageJSON.image_size_error) })
    }
    else {
      var timestamp = new Date().getTime()
      var imageRef = firebase.storage().ref().child(`users/driver_licenses/` + timestamp + `/`);
      return imageRef.put(blob).then(() => {
        blob.close()
        return imageRef.getDownloadURL()
      }).then((dwnldurl) => {
        this.clickRegister(fname, lname, mobile, email, vehicleNum, vehicleName, dwnldurl, companyName, companyAddress);
      })
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