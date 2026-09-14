import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { getMessaging, requestPermission, getToken, AuthorizationStatus } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';


export default async function registerForPushNotificationsAsync() {

  const messaging = getMessaging();
  const authStatus = await requestPermission(messaging);

  const enabled =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log("notification NOT ENABLED")
    return;
  }

  const token = await getToken(messaging);
  if (token) {
    firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/').update({
      pushToken: token,
      userPlatform: Platform.OS == 'ios' ? 'IOS' : 'ANDROID'
    })
  }

}