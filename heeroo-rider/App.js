import React from 'react';
import AppContainer from './src/navigation/AppNavigator';
import {
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import 'react-native-gesture-handler'

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  "[react-native-gesture-handler] Seems like you\'re using an old API with gesture components, check out new Gestures system!",
]);

var firebaseConfig = {
  apiKey: "AIzaSyCdon7gKg8g-dNoYvuk4_gVy4y1zBKrKUw",
  authDomain: "projet-test-d7cd9.firebaseapp.com",
  databaseURL: "https://projet-test-d7cd9-default-rtdb.firebaseio.com",
  projectId: "projet-test-d7cd9",
  storageBucket: "projet-test-d7cd9.appspot.com",
  messagingSenderId: "355117543035",
  appId: "1:355117543035:web:b3ee9267f2e3f89bd8fcde"
};

firebase.initializeApp(firebaseConfig);

export default class App extends React.Component {

  render() {
    return (
      <AppContainer />
    )

  }
}