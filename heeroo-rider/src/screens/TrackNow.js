
import React from 'react';
import { fitMapToPoints } from '../common/mapFit';
import { MAP_PROVIDER } from '../common/mapProvider';
import {
    StyleSheet,
    Text,
    View,
    TouchableWithoutFeedback,
    TouchableOpacity,
    PermissionsAndroid,
    Platform,
    Linking,
    Alert,
} from 'react-native';
import { Header, Icon } from '@rneui/themed';
import languageJSON from '../common/language';
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
            const data = snapshot.val();
            if (!data) return;
            if (data.current) {
                this.setState({ latitude: data.current.lat, longitude: data.current.lng });
            }
            // Fin de course : paiement si elle n'est pas réglée, notation sinon ; annulation : retour carte.
            if (!this.leftScreen && (data.status == 'END' || data.status == 'CANCELLED')) {
                this.leftScreen = true;
                dat.off();
                if (data.status == 'CANCELLED') {
                    this.props.navigation.navigate('Map', { screen: 'MapScreen' });
                    return;
                }
                const uid = firebase.auth().currentUser.uid;
                firebase.database().ref('users/' + uid).once('value').then((profile) => {
                    const user = profile.val() || {};
                    const booking = {
                        ...data,
                        bookingKey: keys,
                        firstname: user.firstName,
                        lastname: user.lastName,
                        email: user.email,
                        phonenumber: user.mobile,
                    };
                    if (data.payment_status == 'PAID') {
                        this.props.navigation.navigate('Map', { screen: 'ratingPage', params: { data: booking } });
                    } else {
                        this.props.navigation.navigate('CardDetails', { data: booking });
                    }
                });
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
                        fitMapToPoints(this.map, [{ latitude: this.state.allData.pickup.lat, longitude: this.state.allData.pickup.lng }, { latitude: this.state.allData.drop.lat, longitude: this.state.allData.drop.lng }], {
                            edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                            animated: true,
                        }, { ready: this.mapReady })
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
                    onMapReady={() => { this.mapReady = true; }}
                    style={styles.map}
                    provider={MAP_PROVIDER}
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

                {/* Pendant la course, le passager ne voyait qu'une carte : ni le nom
                    de son chauffeur, ni la destination, ni le moyen de le joindre,
                    alors que tout cela s'affichait a l'ecran precedent. */}
                {this.state.allData ? (
                    <View style={styles.tripCard}>
                        <Text style={styles.tripLabel}>{languageJSON.ride_in_progress}</Text>
                        <Text style={styles.tripDrop} numberOfLines={1}>
                            {this.state.allData.drop ? this.state.allData.drop.add : ''}
                        </Text>
                        <View style={styles.tripRow}>
                            <View style={styles.tripDriver}>
                                <Text style={styles.tripName} numberOfLines={1}>{this.state.allData.driver_name || ''}</Text>
                                <Text style={styles.tripVehicle} numberOfLines={1}>
                                    {[this.state.allData.carType, this.state.allData.vehicle_number].filter(Boolean).join(' \u00b7 ')}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.tripAction}
                                onPress={() => this.props.navigation.navigate('onlineChat', {
                                    passData: { ...this.state.allData, bokkingId: this.props.route.params.bId },
                                })}>
                                <Icon name="message-square" type="feather" color={colors.SECONDARY} size={22} />
                            </TouchableOpacity>
                            {this.state.allData.driver_contact ? (
                                <TouchableOpacity
                                    style={styles.tripAction}
                                    onPress={() => Linking.openURL('tel:' + String(this.state.allData.driver_contact).replace(/\s/g, ''))}>
                                    <Icon name="phone" type="feather" color={colors.SECONDARY} size={22} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                ) : null}
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
    tripCard: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 24,
        zIndex: 3,
        backgroundColor: colors.WHITE,
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 16,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
    },
    tripLabel: {
        fontFamily: 'Montserrat-SemiBold',
        fontSize: 12,
        letterSpacing: 1,
        color: colors.SECONDARY,
    },
    tripDrop: {
        fontFamily: 'Montserrat-Regular',
        fontSize: 16,
        color: colors.PRIMARY,
        marginTop: 2,
    },
    tripRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
    },
    tripDriver: {
        flex: 1,
        paddingRight: 12,
    },
    tripName: {
        fontFamily: 'Montserrat-SemiBold',
        fontSize: 15,
        color: colors.PRIMARY,
    },
    tripVehicle: {
        fontFamily: 'Montserrat-Regular',
        fontSize: 13,
        color: colors.SECONDARY,
        marginTop: 1,
    },
    tripAction: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.SECONDARY,
    },
    headerStyle: {
        zIndex: 2,
        paddingHorizontal: 0,
        borderBottomWidth: 0,

        marginHorizontal: 20
    },
});
