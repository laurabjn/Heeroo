import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import messaging from '@react-native-firebase/messaging';

import { Platform } from 'react-native';

export default async function registerForPushNotificationsAsync() {

  const authStatus = await messaging().requestPermission();

  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log("notification NOT ENABLED")
    return;
  }

  const token = await messaging().getToken();

  if (token) {
    firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/').update({
      pushToken: token,
      userPlatform: Platform.OS == 'ios' ? 'IOS' : 'ANDROID'
    })
  }

}