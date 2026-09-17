
import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableWithoutFeedback,
    PermissionsAndroid,
    Platform,
    Linking,
    Alert,
} from 'react-native';
import { Header } from '@rneui/themed';
import haversine from "haversine";
import MapView, {
    Marker,
    AnimatedRegion,
    PROVIDER_GOOGLE,
    Polyline as MapViewPolyline
} from "react-native-maps";
import Geolocation from '../common/geolocation';

import { colors, customMapStyle } from '../common/theme';
import Polyline from '@mapbox/polyline';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { google_map_key } from '../common/key';

const LATITUDE_DELTA = 0.009;
const LONGITUDE_DELTA = 0.009;
const LATITUDE = 46;
const LONGITUDE = 2;
import { Car, Pin } from '../icons';
import { DrawerToggle, NotificationBtn } from '../components';

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

        let keys = this.props.route.params.bId
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

        this.watchID = Geolocation.watchPosition(
            position => {
                const { routeCoordinates, distanceTravelled } = this.state;
                const { latitude, longitude } = position.coords;

                const newCoordinate = {
                    latitude,
                    longitude
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

        if (this.props.route.params.data) {
            let paramData = this.props.route.params.data
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
        Geolocation.clearWatch(this.watchID);
    }
    componentDidUpdate() {
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
            if (!respJson.routes || !respJson.routes[0] || !respJson.routes[0].overview_polyline) { console.log('[Directions] pas de trajet :', respJson.status, respJson.error_message || ''); return; }
            let points = Polyline.decode(respJson.routes[0].overview_polyline.points);
            let coords = points.map((point, index) => {
                return {
                    latitude: point[0],
                    longitude: point[1]
                }
            })
            this.setState({ coords: coords }, () => {
                setTimeout(() => {
                    if (this.map && this.state.allData.pickup.lat && this.state.allData.drop.lat) {
                        this.map.fitToCoordinates([{ latitude: this.state.allData.pickup.lat, longitude: this.state.allData.pickup.lng }, { latitude: this.state.allData.drop.lat, longitude: this.state.allData.drop.lng }], {
                            edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                            animated: true,
                        })
                    }
                }, 2500);

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
            <View style={styles.container} >
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    //rightComponent={<NotificationBtn {...this.props}  />}
                    containerStyle={styles.headerStyle} />
                <MapView
                    customMapStyle={customMapStyle}
                    ref={map => { this.map = map }}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    showUserLocation
                    followUserLocation
                    loadingEnabled
                    initialRegion={{
                        latitude: this.state.latitude,
                        longitude: this.state.longitude,
                        latitudeDelta: LATITUDE_DELTA,
                        longitudeDelta: LONGITUDE_DELTA
                    }}
                >
                    <MapViewPolyline
                        coordinates={this.state.coords ? this.state.coords : [{ latitude: 0.00, longitude: 0.00 }]}
                        strokeWidth={5}
                        strokeColor={colors.SECONDARY}
                    />
                    <MapViewPolyline coordinates={this.state.routeCoordinates} strokeWidth={5} />

                    <Marker
                        tracksViewChanges={false}
                        coordinate={{
                            latitude: this.state.latitude,
                            longitude: this.state.longitude,
                            latitudeDelta: LATITUDE_DELTA,
                            longitudeDelta: LONGITUDE_DELTA
                        }}
                    >
                        <Car height={40} width={30} />
                    </Marker>

                    <Marker
                        tracksViewChanges={false}
                        coordinate={{ latitude: this.state.allData ? this.state.allData.pickup.lat : 0.00, longitude: this.state.allData ? this.state.allData.pickup.lng : 0.00 }} >
                        <Pin height={40} width={30} color={colors.SECONDARY} />
                    </Marker>

                    <Marker
                        tracksViewChanges={false}
                        coordinate={{ latitude: this.state.allData ? this.state.allData.drop.lat : 0.00, longitude: this.state.allData ? this.state.allData.drop.lng : 0.00 }}>
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
    },
    map: {
        ...StyleSheet.absoluteFill,
        zIndex: 0
    },
    headerGradient: {
        zIndex: 1,
        ...StyleSheet.absoluteFill,
        height: 100
    },
    headerStyle: {
        zIndex: 2,
        paddingHorizontal: 0,
        borderBottomWidth: 0,

        marginHorizontal: 20
    },
});
