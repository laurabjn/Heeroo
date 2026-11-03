import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { getMessaging, requestPermission, getToken, AuthorizationStatus } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { langue } from './language';


export default async function registerForPushNotificationsAsync() {

  const user = firebase.auth().currentUser;
  if (!user) return;

  // La langue est ecrite avant toute demande de permission, et meme si les
  // notifications sont refusees : le serveur s'en sert pour composer ses
  // messages, et un compte sans ce champ restera traite en francais.
  firebase.database().ref('users/' + user.uid + '/').update({ language: langue });

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
    firebase.database().ref('users/' + user.uid + '/').update({
      pushToken: token,
      userPlatform: Platform.OS == 'ios' ? 'IOS' : 'ANDROID'
    })
  }

}