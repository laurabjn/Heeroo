import React, { Component } from 'react';
import { Platform, StatusBar, StyleSheet, Modal, Alert, View, Dimensions, TouchableOpacity } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { colors } from '../common/theme';
import { google_map_key } from '../common/key';
import { CloseBtn } from '../components';
import { Header } from '@rneui/themed';
import Polyline from '@mapbox/polyline';
const { width, height } = Dimensions.get('window');
import Icon from 'react-native-vector-icons/AntDesign';
import Geolocation from '../common/geolocation';
navigator.geolocation = Geolocation;
import languageJSON from './../common/language'

export default class SearchModal extends Component {

  goMap(data, details) {
    const { state, setState, allCarsData } = this.props;

    if (state.from == 'pickup') {

      if (details) {

        setState(prevState => {
          prevState['region'] = {
            ...prevState.region,
            latitude: details.geometry.location.lat,
            longitude: details.geometry.location.lng,
          }
          prevState['passData'] = {
            ...prevState.passData,
            wherelatitude: details.geometry.location.lat,
            wherelongitude: details.geometry.location.lng,
            whereText: details.formatted_address,
          }
          prevState["whereText"] = details.formatted_address
          prevState["checkCallLocation"] = 'navigation'
          prevState["selected"] = 'pickup'
          prevState["geolocationFetchComplete"] = true
          prevState["searchModalVisible"] = false
          prevState["coords"] = []
          return prevState;
        },
          allCarsData(details.address_components.filter((comp => comp.types.includes('country')))[0].short_name)
        )

        if (state.passData.droplatitude != 0 && state.passData.droplongitude != 0) {
          this.getDirections(details.geometry.location.lat, details.geometry.location.lng, state.passData.droplatitude, state.passData.droplongitude)
        }
      }
    } else {
      if (details) {
        setState(prevState => {
          prevState['passData'] = {
            ...prevState.passData,
            droplatitude: details.geometry.location.lat,
            droplongitude: details.geometry.location.lng,
            droptext: details.formatted_address,
          }
          prevState["dropText"] = details.formatted_address
          prevState["checkCallLocation"] = 'navigation'
          prevState["selected"] = 'drop'
          prevState["geolocationFetchComplete"] = true
          prevState["searchModalVisible"] = false;

          return prevState;
        })
        this.getDirections(state.passData.wherelatitude, state.passData.wherelongitude, details.geometry.location.lat, details.geometry.location.lng)
      }
    }
  }

  getDirections = async (wherelatitude, wherelongitude, lat, lng) => {
    const startLoc = wherelatitude + ', ' + wherelongitude
    const destLoc = lat + ', ' + lng
    const { setState, mapRef } = this.props;
    try {
      var resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc}&destination=${destLoc}&key=${google_map_key}`)
      var respJson = await resp.json();
      console.log(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc}&destination=${destLoc}&key=${google_map_key}`)
      console.log("respJson")
      console.log(respJson)
      if (!respJson.routes || !respJson.routes[0] || !respJson.routes[0].overview_polyline) { console.log('[Directions] pas de trajet :', respJson.status, respJson.error_message || ''); return; }
      var points = Polyline.decode(respJson.routes[0].overview_polyline.points);
      var coords = points.map((point) => {
        return {
          latitude: point[0],
          longitude: point[1]
        }
      })
      setState({ coords: coords })
      if (mapRef) {
        mapRef.fitToCoordinates([{ latitude: wherelatitude, longitude: wherelongitude }, { latitude: lat, longitude: lng }], {
          edgePadding: { top: Platform.OS == "ios" ? 100 : 200, right: 40, bottom: Platform.OS == "ios" ? height / 2 : height / 2.5, left: 40 },
          animated: true,
        })
      }
    }
    catch (error) {
      console.log("error 1233")
      console.log("error", error);
      if (error == "TypeError: Cannot read property 'legs' of undefined") {
        Alert.alert(
          languageJSON.err,
          languageJSON.route_not_found,
          [
            { text: languageJSON.no_driver_found_alert_OK_button },
          ],
          { cancelable: false },
        );
      } else {
        Alert.alert(
          languageJSON.err,
          languageJSON.route_not_found,
          [
            { text: languageJSON.no_driver_found_alert_OK_button },
          ],
          { cancelable: false },
        );
      }
      setState({ coords: [] })
    }
  }
  render() {
    const { state, setState } = this.props;
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={this.props.modalVisible}
        onRequestClose={() => {
          console.log("onRequestClose")
          Alert.alert("Modal has been closed.");
        }}
        statusBarTranslucent={true}

      >
        <View style={styles.content} >
          <TouchableOpacity onPress={() => setState({ searchModalVisible: false })} style={styles.closeBtn}>
            <Icon name="close" size={Platform.OS == "ios" ? 30 : 25} color="#727e8b" />
          </TouchableOpacity>

          <GooglePlacesAutocomplete
            placeholder='Rechercher une adresse '

            onPress={(data, details = null) => { // 'details' is provided when fetchDetails = true
              this.goMap(data, details);
            }}
            query={{
              // available options: https://developers.google.com/places/web-service/autocomplete
              key: google_map_key,
              language: 'en', // language of the results
              // types: '(cities)' // default: 'geocode'      

            }}
            getDefaultValue={() => ''}
            styles={styles}
            minLength={2} // minimum length of text to search
            autoFocus={true}
            fetchDetails={true}
            returnKeyType={"search"} // Can be left out for default return key https://facebook.github.io/react-native/docs/textinput.html#returnkeytype
            listViewDisplayed='auto'  // true/false/undefined
            textInputProps={{ clearButtonMode: 'while-editing' }}
            renderDescription={(row) => row.description || row.formatted_address || row.name}
            currentLocation={true} // Will add a 'Current location' button at the top of the predefined places list
            currentLocationLabel="Votre position actuelle"
            nearbyPlacesAPI='GoogleReverseGeocoding' // Which API to use: GoogleReverseGeocoding or GooglePlacesSearch
            GoogleReverseGeocodingQuery={{
              // available options for GoogleReverseGeocoding API : https://developers.google.com/maps/documentation/geocoding/intro
              key: google_map_key,
              language: 'en',
            }}
            GooglePlacesSearchQuery={{
              // available options for GooglePlacesSearch API : https://developers.google.com/places/web-service/search
              rankby: 'distance',
              types: 'establishment'
            }}
            debounce={200} // debounce the requests in ms. Set to 0 to remove debounce. By default 0ms.
          />
        </View>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Platform.OS != "ios" ? 0 : 30,
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
  },
  headerStyle: {
    backgroundColor: "#fff",
    borderBottomWidth: 0,

  },
  textInputContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 0,
    borderTopWidth: 0,
    padding: 2,
    marginTop: 5,

    borderRadius: 5,

  },
  textInput: {

    backgroundColor: "#f9f9f9",
    marginTop: 0,
    height: 'auto',
    marginLeft: 0,
    marginRight: 0,
    paddingLeft: 10,
    paddingRight: 10,
    fontFamily: "Montserrat-Regular",
    fontWeight: "300",
    color: "#000",
  },
  poweredContainer: {
    backgroundColor: "#f9f9f9",

  },
  separator: {
    backgroundColor: "rgba(170, 193, 202, 0.44)",
  },
  predefinedPlacesDescription: {
    fontFamily: "Montserrat-Regular"
  },
  closeBtn: {
    alignSelf: "flex-end",
    margin: 10
  }
});