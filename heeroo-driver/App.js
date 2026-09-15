import React from 'react';
import { LogBox } from 'react-native';
import 'react-native-gesture-handler';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import Geocoder from 'react-native-geocoding';
import { google_map_key } from './src/common/key';
import AppContainer from './src/navigation/AppNavigator';

LogBox.ignoreLogs(['new NativeEventEmitter']);
LogBox.ignoreLogs([
  "[react-native-gesture-handler] Seems like you're using an old API with gesture components, check out new Gestures system!",
]);

// Projet Firebase choisi au build par app.config.js (APP_ENV) :
// développement par défaut, production uniquement pour le profil EAS "production".
const firebaseConfig = Constants.expoConfig.extra.firebase;
if (Constants.expoConfig.extra.appEnv !== 'production') {
  console.log('[Heeroo] environnement', Constants.expoConfig.extra.appEnv, '->', firebaseConfig.projectId);
}

// L'app est initialisée une fois avec l'API modulaire pour brancher la
// persistance de session sur AsyncStorage ; l'API compat (firebase.auth(),
// firebase.database()) utilisée dans les écrans réutilise cette même instance.
const app = initializeApp(firebaseConfig);
initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
firebase.initializeApp(firebaseConfig);

// Géocodage inverse (pays de l'utilisateur, adresses) : initialisé une seule fois ici,
// les écrans l'utilisent avant même que la carte ne soit montée.
Geocoder.init(google_map_key, { language: 'fr' });

export default class App extends React.Component {
  render() {
    return <AppContainer />;
  }
}
