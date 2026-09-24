// Adaptateur : expose l'API de @mauron85/react-native-background-geolocation
// (configure / on / start / stop / checkStatus / startTask / endTask) utilisée par
// DriverStartTrip, par-dessus expo-location + expo-task-manager.
//
// - Avec la permission "arrière-plan" accordée : suivi par tâche système et
//   service de premier plan Android (notification persistante), qui continue
//   quand l'app n'est plus à l'écran.
// - Sinon : suivi classique au premier plan uniquement.
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import languageJSON from './language';

const TASK_NAME = 'heeroo-driver-location';

const listeners = {};
let config = {};
let foregroundWatch = null;
let running = false;

/**
 * Information prealable a la demande de position en arriere-plan.
 *
 * Google l'exige avant la fenetre du systeme : elle doit dire quelle donnee est
 * relevee, a quoi elle sert, et que le relevement continue application fermee,
 * puis recueillir un accord explicite. Une application qui demande la
 * permission sans cette etape est refusee a la publication.
 *
 * Un refus n'est pas bloquant : le suivi se poursuit au premier plan.
 */
function askBackgroundConsent() {
  return new Promise((resolve) => {
    Alert.alert(
      languageJSON.background_location_title,
      languageJSON.background_location_message,
      [
        { text: languageJSON.background_location_refuse, style: 'cancel', onPress: () => resolve(false) },
        { text: languageJSON.background_location_accept, onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });
}

function emit(event, payload) {
  (listeners[event] || []).forEach((fn) => {
    try { fn(payload); } catch (e) { console.log('[backgroundGeolocation] listener', event, e); }
  });
}

function toLocation(location) {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    bearing: location.coords.heading,
    altitude: location.coords.altitude,
    time: location.timestamp,
  };
}

// La tâche reçoit les positions même quand l'app est en arrière-plan.
TaskManager.defineTask(TASK_NAME, ({ data, error }) => {
  if (error) {
    emit('error', error);
    return;
  }
  if (data && data.locations) {
    data.locations.forEach((location) => emit('location', toLocation(location)));
  }
});

function watchOptions() {
  return {
    accuracy: Location.Accuracy.High,
    timeInterval: config.interval || 2000,
    distanceInterval: config.distanceFilter || 1,
  };
}

const BackgroundGeolocation = {
  HIGH_ACCURACY: 0,
  DISTANCE_FILTER_PROVIDER: 0,
  ACTIVITY_PROVIDER: 1,
  RAW_PROVIDER: 2,

  configure(options) {
    config = options || {};
  },

  on(event, fn) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(fn);
    return { remove: () => { listeners[event] = (listeners[event] || []).filter((f) => f !== fn); } };
  },

  removeAllListeners(event) {
    if (event) {
      listeners[event] = [];
    } else {
      Object.keys(listeners).forEach((k) => { listeners[k] = []; });
    }
  },

  async start() {
    if (running) return;
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      emit('error', { code: 1, message: 'Permission de localisation refusée' });
      return;
    }
    running = true;
    emit('start');

    let backgroundStarted = false;
    try {
      const already = await Location.getBackgroundPermissionsAsync();
      // L'information n'est presentee qu'une fois : inutile de la repeter a
      // chaque course si le chauffeur a deja accorde la permission.
      const consent = already.status === 'granted' || (await askBackgroundConsent());
      const bg = consent ? await Location.requestBackgroundPermissionsAsync() : already;
      if (bg.status === 'granted') {
        await Location.startLocationUpdatesAsync(TASK_NAME, {
          ...watchOptions(),
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: config.notificationTitle || 'Heeroo Driver',
            notificationBody: config.notificationText || 'Course en cours',
            notificationColor: '#181717',
          },
        });
        backgroundStarted = true;
      }
    } catch (e) {
      emit('error', e);
    }

    if (!backgroundStarted) {
      foregroundWatch = await Location.watchPositionAsync(watchOptions(), (location) => {
        emit('location', toLocation(location));
      });
    }
  },

  async stop() {
    running = false;
    if (foregroundWatch) {
      foregroundWatch.remove();
      foregroundWatch = null;
    }
    try {
      if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(TASK_NAME);
      }
    } catch (e) {
      // la tâche n'existe pas encore : rien à arrêter
    }
    emit('stop');
  },

  // L'ancienne API iOS encadrait les traitements longs dans une "tâche" ; ici, no-op.
  startTask(callback) {
    callback(1);
  },
  endTask() {},

  checkStatus(callback) {
    Location.hasStartedLocationUpdatesAsync(TASK_NAME)
      .then((isRunning) => callback({ isRunning: isRunning || running, locationServicesEnabled: true, authorization: 1 }))
      .catch(() => callback({ isRunning: running, locationServicesEnabled: true, authorization: 1 }));
  },
};

export default BackgroundGeolocation;
