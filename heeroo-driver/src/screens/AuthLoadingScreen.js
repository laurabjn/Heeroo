import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Alert
} from 'react-native';

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import messaging from '@react-native-firebase/messaging';

import AsyncStorage from '@react-native-async-storage/async-storage';
import GetPushToken from '../common/GetPushToken/';
import languageJSON from '../common/language';
import { colors } from '../common/theme';

export class AuthLoadingScreen extends React.Component {
  constructor(props) {
    super(props);
    this._setSettings();
    this._bootstrapAsync();

  }

  _setSettings = async () => {
    try {
      const settings = firebase.database().ref('settings');
      settings.once('value', settingsData => {
        if (settingsData.val()) {
          AsyncStorage.setItem('currency', JSON.stringify(settingsData.val()));
        }
      });
    } catch (error) {
    }
  };

  // Fetch the token from storage then navigate to our appropriate place
  _bootstrapAsync = () => {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        if (user.displayName) {
          const userData = firebase.database().ref('users/' + user.uid);

          userData.once('value', userData => {
            if (userData.val()) {
              if (userData.val().usertype == 'driver' && userData.val().approved == true) {

                this.props.navigation.navigate('DriverRoot');
                GetPushToken();
              }
              else {
                firebase.auth().signOut();

                this.props.navigation.navigate("Auth");
                alert(languageJSON.driver_account_approve_err);
              }
            } else {
              var data = {};
              data.profile = {
                name: user.name ? user.name : '',
                last_name: user.last_name ? user.last_name : '',
                first_name: user.first_name ? user.first_name : '',
                email: user.email ? user.email : '',
                mobile: user.phoneNumber ? user.phoneNumber.replace('"', '') : '',
              };

              this.props.navigation.navigate("DriverReg", { requireData: data })
            }
          })
        } else {
          var data = {};
          data.profile = {
            name: user.name ? user.name : '',
            last_name: user.last_name ? user.last_name : '',
            first_name: user.first_name ? user.first_name : '',
            email: user.email ? user.email : '',
            mobile: user.phoneNumber ? user.phoneNumber.replace('"', '') : '',
          };
          this.props.navigation.navigate("DriverReg", { requireData: data })
        }
      } else {

        this.props.navigation.navigate('Auth');
      }
    })
  };

  componentDidMount() {

    this.unsubscribe = messaging().onMessage(async remoteMessage => {
      Alert.alert(remoteMessage.notification.title ? remoteMessage.notification.title : 'Titre Notification', remoteMessage.notification.body ? remoteMessage.notification.body : 'Corps Notification')
    });
  }

  componentWillUnmount() {
    this.unsubscribe()
  }
  // Render any loading content that you like here
  render() {
    return (
      <View style={styles.IndicatorStyle}>
        <ActivityIndicator size="large" color={colors.PRIMARY} />
      </View>
    );
  }
}

//style for this component
const styles = StyleSheet.create({
  IndicatorStyle: {
    flex: 1,
    justifyContent: "center"
  }
})