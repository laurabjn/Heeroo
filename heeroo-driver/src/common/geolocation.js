// Adaptateur : expose l'API de @react-native-community/geolocation
// (getCurrentPosition / watchPosition / clearWatch) par-dessus expo-location,
// pour ne pas réécrire les écrans qui l'utilisent.
//
// getCurrentPosition est tolérant : dernière position connue si elle est
// récente (réponse immédiate), sinon position courante avec délai maximal,
// puis repli sur la dernière position connue quel que soit son âge.
import * as Location from 'expo-location';

const watchers = {};
let nextWatchId = 1;

function toPosition(location) {
  return { coords: location.coords, timestamp: location.timestamp };
}

function accuracyFor(options) {
  return options && options.enableHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Délai de localisation dépassé'), { code: 3 })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function ensurePermission() {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    const error = new Error(canAskAgain
      ? 'Permission de localisation refusée'
      : 'Localisation refusée : activez-la dans les réglages Android de l\'application');
    error.code = 1; // PERMISSION_DENIED, comme l'ancienne API
    throw error;
  }
}

async function currentPosition(options) {
  const maximumAge = options && typeof options.maximumAge === 'number' ? options.maximumAge : 60000;
  const timeout = options && options.timeout ? options.timeout : 15000;

  // 1. Dernière position connue, si assez récente : réponse immédiate.
  const last = await Location.getLastKnownPositionAsync({ maxAge: Math.max(maximumAge, 1000) }).catch(() => null);
  if (last) return last;

  // 2. Position courante, avec délai maximal.
  try {
    return await withTimeout(Location.getCurrentPositionAsync({ accuracy: accuracyFor(options) }), timeout);
  } catch (error) {
    // 3. Repli : n'importe quelle position connue plutôt que rien.
    const any = await Location.getLastKnownPositionAsync().catch(() => null);
    if (any) return any;
    throw error;
  }
}

const Geolocation = {
  requestAuthorization() {
    return Location.requestForegroundPermissionsAsync();
  },

  getCurrentPosition(success, error, options) {
    ensurePermission()
      .then(() => currentPosition(options))
      .then((location) => success(toPosition(location)))
      .catch((e) => { if (error) error(e); });
  },

  watchPosition(success, error, options) {
    const id = nextWatchId++;
    ensurePermission()
      .then(() => Location.watchPositionAsync(
        {
          accuracy: accuracyFor(options),
          timeInterval: options && options.interval ? options.interval : 5000,
          distanceInterval: options && options.distanceFilter ? options.distanceFilter : 10,
        },
        (location) => success(toPosition(location)),
      ))
      .then((subscription) => { watchers[id] = subscription; })
      .catch((e) => { if (error) error(e); });
    return id;
  },

  clearWatch(id) {
    if (watchers[id]) {
      watchers[id].remove();
      delete watchers[id];
    }
  },
};

export default Geolocation;
