// Notifications reçues pendant que l'app est ouverte : Android/iOS ne les
// affichent pas d'eux-mêmes au premier plan, on les montre nous-mêmes.
// Abonnement global, au niveau de l'app (indépendant des écrans).
import { Alert } from 'react-native';
import { getMessaging, onMessage } from '@react-native-firebase/messaging';

let unsubscribe = null;

export function startForegroundNotifications() {
  if (unsubscribe) return;
  unsubscribe = onMessage(getMessaging(), async (remoteMessage) => {
    const notification = remoteMessage.notification || {};
    const title = notification.title || (remoteMessage.data && remoteMessage.data.title) || 'Heeroo';
    const body = notification.body || (remoteMessage.data && remoteMessage.data.body) || '';
    // La sonnerie n'est pas déclenchée ici. La notification du serveur arrive
    // quelques secondes après l'écriture en base, donc après que le chauffeur a
    // souvent déjà accepté : elle faisait sonner une seconde fois une demande
    // qui n'attendait plus. C'est l'écran des demandes qui sonne, lui seul sait
    // si une course attend encore une réponse.
    if (body) Alert.alert(title, body);
  });
}

export function stopForegroundNotifications() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
