
import React from 'react';
import { StyleSheet, View, PermissionsAndroid, Dimensions } from 'react-native';
import haversine from "haversine";
import MapView, {
    Marker,
    AnimatedRegion,
    PROVIDER_GOOGLE,
    Polyline as MapViewPolyline
} from "react-native-maps";
import { RequestPushMsg } from '../common/RequestPushMsg';
import { colors, customMapStyle } from '../common/theme';
import Polyline from '@mapbox/polyline';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import Geolocation from '@react-native-community/geolocation';

import { google_map_key } from '../common/key';
import language from '../common/language';
const LATITUDE_DELTA = 0.009;
const LONGITUDE_DELTA = 0.009;
const LATITUDE = 46;
const LONGITUDE = 2;
import languageJSON from '../common/language';
import { getDistance } from 'geolib';
import { Car, Pin } from '../icons';
const { width, height } = Dimensions.get('window');

export default class TrackNow extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            latitude: LATITUDE,
            longitude: LONGITUDE,
            routeCoordinates: [],
            distanceTravelled: 0,
            prevLatLng: {},
            coordinate: new AnimatedRegion({
                latitude: LATITUDE,
                longitude: LONGITUDE,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA
            }),
        };
        const { duid, alldata } = this.props;

    }

    async componentDidMount() {
        const { duid, alldata, bookingStatus } = this.props;
        this.getDirections(alldata.wherelatitude + ',' + alldata.wherelongitude, alldata.droplatitude + ',' + alldata.droplongitude);
        if (duid && alldata) {
            let paramData = alldata;
            const dat = firebase.database().ref('users/' + duid + '/');
            //setInterval(() => {

            dat.on('value', snapshot => {
                if (snapshot.val() && snapshot.val().location) {
                    var data = snapshot.val().location;
                    if (data) {
                        this.setState({
                            allData: paramData,
                            latitude: data.lat, longitude: data.lng
                        }, () => {
                            if (bookingStatus == 'ACCEPTED') {
                                var location1 = [paramData.wherelatitude, paramData.wherelongitude];
                                var location2 = [data.lat, data.lng];
                                var distance = getDistance(location1, location2);
                                var originalDistance = distance * 1000;
                                // alert(originalDistance)
                                if (originalDistance && originalDistance < 50) {
                                    if (!this.state.allData.flag) {
                                        this.setState({
                                            flag: false
                                        })
                                        const dat = firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/');
                                        dat.once('value', snapshot => {
                                            if (snapshot.val() && snapshot.val().pushToken) {
                                                RequestPushMsg(snapshot.val().pushToken, languageJSON.driver_near, null, languageJSON.alert_title)
                                                paramData.flag = true;
                                            }
                                        })
                                    }

                                }
                            }
                        })
                    }

                }


            })

            //},10000)

        }
    }



    async getLocationAsync() {
        const status = await Geolocation.requestAuthorization()

        if (status === 'granted') {
        } else {
            throw new Error('Location permission not granted');
        }
    }

    calcDistance = newLatLng => {
        const { prevLatLng } = this.state;
        return haversine(prevLatLng, newLatLng) || 0;
    };


    requestCameraPermission = async () => {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                // {
                //     title: languageJSON.location_permission,
                //     buttonNeutral: languageJSON.ask_me_later,
                //     buttonNegative: languageJSON.cancel,
                //     buttonPositive: languageJSON.no_driver_found_alert_OK_button
                // }
            );
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                console.log("You can use the camera");
            } else {
                console.log("Camera permission denied");
            }
        } catch (err) {
            console.warn(err);
        }
    };

    // find your origin and destination point coordinates and pass it to our method.
    async getDirections(startLoc, destinationLoc) {
        try {
            let resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc}&destination=${destinationLoc}&key=${google_map_key}`)
            let respJson = await resp.json();
            let points = Polyline.decode(respJson.routes[0].overview_polyline.points);
            let coords = points.map((point, index) => {
                return {
                    latitude: point[0],
                    longitude: point[1]
                }
            })
            this.setState({ coords: coords }, () => {
                setTimeout(() => {
                    if (this.map && this.state.latitude && this.state.allData.wherelatitude) {
                        this.map.fitToCoordinates([{ latitude: this.state.latitude, longitude: this.state.longitude }, { latitude: this.state.allData.wherelatitude, longitude: this.state.allData.wherelongitude }], {
                            edgePadding: { top: Platform.OS == "ios" ? 100 : 200, right: 40, bottom: Platform.OS == "ios" ? height / 2 : height / 1, left: 40 },
                            animated: true,
                        })
                    };
                }, 1500);

            })
            return coords
        }
        catch (error) {
            alert(error)
            return error
        }
    }

    render() {

        return (
            <View style={styles.map}>
                <MapView
                    customMapStyle={customMapStyle}
                    ref={map => { this.map = map }}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    showUserLocation
                    followUserLocation
                    loadingEnabled
                    region={{
                        latitude: this.state.latitude,
                        longitude: this.state.longitude,
                        latitudeDelta: LATITUDE_DELTA,
                        longitudeDelta: LONGITUDE_DELTA
                    }}>
                    <MapViewPolyline
                        coordinates={this.state.coords ? this.state.coords : [{ latitude: 0.00, longitude: 0.00 }]}
                        strokeWidth={5}
                        strokeColor={colors.SECONDARY}
                    />
                    <Marker
                        tracksViewChanges={false}
                        coordinate={{ latitude: this.props.alldata ? this.props.alldata.wherelatitude : 0.00, longitude: this.props.alldata ? this.props.alldata.wherelongitude : 0.00 }} >
                        <Pin height={40} width={30} color={colors.SECONDARY} />
                    </Marker>
                    <Marker
                        tracksViewChanges={false}
                        coordinate={{ latitude: this.props.alldata.droplatitude ? this.props.alldata.droplatitude : 0.00, longitude: this.props.alldata.droplongitude ? this.props.alldata.droplongitude : 0.00 }}>
                        <Pin height={40} width={30} />
                    </Marker>
                    <Marker
                        tracksViewChanges={false}
                        coordinate={{ latitude: this.state.latitude ? this.state.latitude : 0.00, longitude: this.state.longitude ? this.state.longitude : 0.00 }}>
                        <Car height={40} width={30} />
                    </Marker>
                </MapView>
            </View>
        );
    }

}

const styles = StyleSheet.create({
    headerStyle: {
        backgroundColor: colors.GREY.default,
        borderBottomWidth: 0
    },
    headerInnerStyle: {
        marginLeft: 10,
        marginRight: 10
    },
    headerTitleStyle: {
        color: colors.WHITE,
        fontFamily: 'Montserrat-Bold',
        fontSize: 18
    },
    map: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,

    },
    bubble: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.7)",
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 20
    },
    latlng: {
        width: 200,
        alignItems: "stretch"
    },


});
