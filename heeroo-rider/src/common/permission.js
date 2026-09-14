
import { check, PERMISSIONS, RESULTS, request } from 'react-native-permissions';

export async function checkLocationPermission() {
    if (Platform.OS === "ios") {
        console.log('checking permission for ios')

        await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE)
            .then(async (result) => {
                if (result == RESULTS.DENIED) {
                    console.log('The permission has not been requested / is denied but requestable');
                    await request(PERMISSIONS.IOS.LOCATION_ALWAYS).then((result) => {
                        if (result == RESULTS.GRANTED) {
                            return true
                        } else {
                            return false
                        }
                    });
                } else if (result == RESULTS.GRANTED) {
                    console.log('The permission is granted');
                    return true
                }
            })
    } else if (Platform.OS === "android") {
        await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
            .then(async (result) => {
                if (result == RESULTS.DENIED) {
                    console.log('The permission has not been requested / is denied but requestable');
                    await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION).then((result) => {
                        if (result == RESULTS.GRANTED) {
                            return true
                        } else {
                            return false
                        }
                    });
                } else if (result == RESULTS.GRANTED) {
                    console.log('The permission is granted');
                    return true
                }
            })
    }
}

export async function checkCameraPermission() {
    if (Platform.OS === "ios") {
        check(PERMISSIONS.IOS.CAMERA)
            .then((result) => {
                if (result == RESULTS.DENIED) {
                    console.log('The permission has not been requested / is denied but requestable');
                    request(PERMISSIONS.IOS.CAMERA).then((result) => {
                        if (result == RESULTS.GRANTED) {
                            return true
                        } else {
                            return false
                        }
                    });
                } else if (result == RESULTS.GRANTED) {
                    console.log('The permission is granted');
                    return true
                }
            })
    } else if (Platform.OS === "android") {
        check(PERMISSIONS.ANDROID.CAMERA)
            .then((result) => {
                if (result == RESULTS.DENIED) {
                    console.log('The permission has not been requested / is denied but requestable');
                    request(PERMISSIONS.ANDROID.CAMERA).then((result) => {
                        if (result == RESULTS.GRANTED) {
                            return true
                        } else {
                            return false
                        }
                    });
                } else if (result == RESULTS.GRANTED) {
                    console.log('The permission is granted');
                    return true
                }
            })
    }
}