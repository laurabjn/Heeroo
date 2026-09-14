import React from 'react';
import { LogBox } from 'react-native';
import 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import AppContainer from './src/navigation/AppNavigator';

LogBox.ignoreLogs([
  "[react-native-gesture-handler] Seems like you're using an old API with gesture components, check out new Gestures system!",
]);

const firebaseConfig = {
  apiKey: 'AIzaSyCdon7gKg8g-dNoYvuk4_gVy4y1zBKrKUw',
  authDomain: 'projet-test-d7cd9.firebaseapp.com',
  databaseURL: 'https://projet-test-d7cd9-default-rtdb.firebaseio.com',
  projectId: 'projet-test-d7cd9',
  storageBucket: 'projet-test-d7cd9.appspot.com',
  messagingSenderId: '355117543035',
  appId: '1:355117543035:web:b3ee9267f2e3f89bd8fcde',
};

// L'app est initialisée une fois avec l'API modulaire pour brancher la
// persistance de session sur AsyncStorage ; l'API compat (firebase.auth(),
// firebase.database()) utilisée dans les écrans réutilise cette même instance.
const app = initializeApp(firebaseConfig);
initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
firebase.initializeApp(firebaseConfig);

export default class App extends React.Component {
  render() {
    return <AppContainer />;
  }
}
