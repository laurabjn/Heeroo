import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

export async function checkLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function checkCameraPermission() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}
