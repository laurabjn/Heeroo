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

import AsyncStorage from '@react-native-async-storage/async-storage';
import GetPushToken from '../common/GetPushToken';
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
      if (!user) {
        this.props.navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        return;
      }
      // Le profil en base est la source de vérité (pas le displayName du compte,
      // absent pour un compte créé hors de l'app).
      firebase.database().ref('users/' + user.uid).once('value').then((snapshot) => {
        const profile = snapshot.val();
        if (profile) {
          if (profile.usertype == 'driver' && profile.approved == true) {
            this.props.navigation.reset({ index: 0, routes: [{ name: 'DriverRoot' }] });
            GetPushToken();
          } else {
            firebase.auth().signOut();
            this.props.navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
            alert(languageJSON.driver_account_approve_err);
          }
        } else {
          const data = {
            profile: {
              name: '',
              last_name: '',
              first_name: '',
              email: user.email ? user.email : '',
              mobile: user.phoneNumber ? user.phoneNumber.replace('"', '') : '',
            },
          };
          this.props.navigation.reset({ index: 0, routes: [{ name: 'Auth', state: { index: 0, routes: [{ name: 'DriverReg', params: { requireData: data } }] } }] });
        }
      }).catch((error) => {
        console.log('[AuthLoading] lecture du profil impossible', error);
        firebase.auth().signOut();
        this.props.navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        alert(error.message || String(error));
      });
    });
  };

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