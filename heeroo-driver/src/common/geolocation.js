// Adaptateur : expose l'API de @react-native-community/geolocation
// (getCurrentPosition / watchPosition / clearWatch) par-dessus expo-location,
// pour ne pas réécrire les écrans qui l'utilisent.
import * as Location from 'expo-location';

const watchers = {};
let nextWatchId = 1;

function toPosition(location) {
  return { coords: location.coords, timestamp: location.timestamp };
}

function accuracyFor(options) {
  return options && options.enableHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced;
}

async function ensurePermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    const error = new Error('Permission de localisation refusée');
    error.code = 1; // PERMISSION_DENIED, comme l'ancienne API
    throw error;
  }
}

const Geolocation = {
  requestAuthorization() {
    return Location.requestForegroundPermissionsAsync();
  },

  getCurrentPosition(success, error, options) {
    ensurePermission()
      .then(() => Location.getCurrentPositionAsync({ accuracy: accuracyFor(options) }))
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
