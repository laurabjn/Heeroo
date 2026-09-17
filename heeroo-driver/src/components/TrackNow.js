
import React from 'react';
import { StyleSheet, View, Image, Dimensions, Platform } from 'react-native';
import haversine from "haversine";
import MapView, {
    Marker,
    AnimatedRegion,
    PROVIDER_GOOGLE
} from "react-native-maps";

import { colors, customMapStyle } from '../common/theme';
import Polyline from '@mapbox/polyline';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { google_map_key } from '../common/key';
import language from '../common/language';
import { Car, Pin } from '../icons'
import Geolocation from '../common/geolocation';
import { checkCameraPermission, checkLocationPermission } from '../common/permission';

const LATITUDE_DELTA = 0.04;
const LONGITUDE_DELTA = 0.04;
const LATITUDE = 46;
const LONGITUDE = 2;
import languageJSON from '../common/language';
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
            })
        };
        const { bId, alldata } = this.props;
        let keys = bId;
        const dat = firebase.database().ref('bookings/' + keys);
        dat.on('value', snapshot => {
            var data = snapshot.val()
            if (data.current) {
                let data = snapshot.val();
                this.setState({ latitude: data.current.lat, longitude: data.current.lng });
            }
        })
    }

    async componentDidMount() {
        const { coordinate } = this.state;

        checkCameraPermission()
        this.watchID = Geolocation.watchPosition(
            position => {
                console.log('depuis tracknow')
                const { routeCoordinates, distanceTravelled } = this.state;
                const { latitude, longitude } = position.coords;
                const newCoordinate = {
                    latitude: latitude,
                    longitude: longitude
                };
                coordinate.timing(newCoordinate).start();
                this.setState({
                    latitude,
                    longitude,
                    routeCoordinates: routeCoordinates.concat([newCoordinate]),
                    distanceTravelled:
                        distanceTravelled + this.calcDistance(newCoordinate),
                    prevLatLng: newCoordinate
                });
            },
            error => console.log(error),
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 1000,
                distanceFilter: 10
            }
        );
        const { bId, alldata } = this.props;
        if (alldata) {
            let paramData = alldata;
            this.setState({
                allData: paramData,
                startLoc: paramData.pickup.lat + ',' + paramData.pickup.lng,
                destinationLoc: paramData.drop.lat + ',' + paramData.drop.lng
            }, () => {
                this.getDirections();
            })
        }
    }

    componentWillUnmount() {
        Geolocation.stopObserving()
        Geolocation.clearWatch(this.watchID);
    }

    calcDistance = newLatLng => {
        const { prevLatLng } = this.state;
        return haversine(prevLatLng, newLatLng) || 0;
    };

    getMapRegion = () => ({
        latitude: this.state.latitude,
        longitude: this.state.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA
    });



    // find your origin and destination point coordinates and pass it to our method.
    async getDirections() {
        try {
            let resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${this.state.startLoc}&destination=${this.state.destinationLoc}&key=${google_map_key}`)
            let respJson = await resp.json();
            let points = Polyline.decode(respJson.routes[0].overview_polyline.points);
            let coords = points.map((point, index) => {
                return {
                    latitude: point[0],
                    longitude: point[1]
                }
            })
            this.setState({ coords: coords }, () => {
                //setTimeout(() => {
                this.map.fitToCoordinates([{ latitude: this.state.allData.pickup.lat, longitude: this.state.allData.pickup.lng }, { latitude: this.state.allData.drop.lat, longitude: this.state.allData.drop.lng }], {
                    edgePadding: { top: Platform.OS == "ios" ? 100 : 200, right: 40, bottom: Platform.OS == "ios" ? height / 3 : height / 2, left: 40 },
                    animated: true,
                })
                //}, 1500);

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
            <View style={styles.innerContainer}>
                <MapView
                    customMapStyle={customMapStyle}
                    ref={map => { this.map = map }}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    showUserLocation
                    followUserLocation
                    loadingEnabled
                    region={this.getMapRegion()}
                >
                    <MapView.Polyline
                        coordinates={this.state.coords ? this.state.coords : [{ latitude: 0.00, longitude: 0.00 }]}
                        strokeWidth={5}
                        strokeColor={colors.SECONDARY}
                    />
                    <MapView.Polyline coordinates={this.state.routeCoordinates} strokeWidth={5} />

                    <Marker.Animated
                        tracksViewChanges={false}
                        ref={marker => {
                            this.marker = marker;
                        }}
                        coordinate={new AnimatedRegion({
                            latitude: this.state.latitude,
                            longitude: this.state.longitude,
                            latitudeDelta: LATITUDE_DELTA,
                            longitudeDelta: LONGITUDE_DELTA
                        })}
                    >
                        <Car height={40} width={30} />
                    </Marker.Animated>

                    <Marker
                        tracksViewChanges={false}
                        // ref={markerRef}
                        coordinate={{ latitude: this.state.allData ? this.state.allData.pickup.lat : 46, longitude: this.state.allData ? this.state.allData.pickup.lng : 46 }}
                    >
                        <Pin height={40} width={30} color={colors.SECONDARY} />
                    </Marker>

                    <Marker
                        tracksViewChanges={false}
                        coordinate={{ latitude: this.state.allData ? this.state.allData.drop.lat : 2, longitude: this.state.allData ? this.state.allData.drop.lng : 2 }}
                    >
                        <Pin height={40} width={30} />
                    </Marker>



                </MapView>

            </View>

        );
    }

}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.WHITE,
        // marginTop: StatusBar.currentHeight,
    },
    innerContainer: {
        flex: 1,
        backgroundColor: colors.WHITE,
        justifyContent: "flex-end",
        alignItems: "center",

    },
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
        ...StyleSheet.absoluteFill

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
    button: {
        width: 80,
        paddingHorizontal: 12,
        alignItems: "center",
        marginHorizontal: 10
    },
    buttonContainer: {
        flexDirection: "row",
        marginVertical: 20,
        backgroundColor: "transparent"
    }
});
