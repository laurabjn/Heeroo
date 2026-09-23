// Notifications reçues pendant que l'app est ouverte : Android/iOS ne les
// affichent pas d'eux-mêmes au premier plan, on les montre nous-mêmes.
// Abonnement global, au niveau de l'app (indépendant des écrans).
import { Alert } from 'react-native';
import { getMessaging, onMessage } from '@react-native-firebase/messaging';
import { setRideAlert } from './rideAlert';

let unsubscribe = null;

export function startForegroundNotifications() {
  if (unsubscribe) return;
  unsubscribe = onMessage(getMessaging(), async (remoteMessage) => {
    const notification = remoteMessage.notification || {};
    const title = notification.title || (remoteMessage.data && remoteMessage.data.title) || 'Heeroo';
    const body = notification.body || (remoteMessage.data && remoteMessage.data.body) || '';
    // Une demande de course reçue alors que le chauffeur est sur un autre écran
    // doit sonner : l'alerte seule est muette, et il conduit.
    const isRideRequest = remoteMessage.data && remoteMessage.data.type === 'booking_request';
    if (isRideRequest) setRideAlert(true);
    if (body) {
      Alert.alert(title, body, [{ text: 'OK', onPress: () => setRideAlert(false) }]);
    }
  });
}

export function stopForegroundNotifications() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
