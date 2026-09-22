import * as Location from 'expo-location';
import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    Dimensions,
    TouchableWithoutFeedback,
    Platform,
    Image,
    Modal,
    SafeAreaView, Linking,
    ActivityIndicator,
    Alert,
} from 'react-native';
var { width } = Dimensions.get('window');
import { DrawerToggle, } from '../components';
import TicketBtn from '../components/TicketBtn';

import { TrackNow } from '../components';
import { Button, Header } from '@rneui/themed';
import { colors } from '../common/theme';
import { checkLocationPermission } from '../common/permission';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { farehelper } from '../common/fareCalculator';
import Geolocation from '../common/geolocation';
import { google_map_key } from '../common/key';
import languageJSON from '../common/language';
import AsyncStorage from '@react-native-async-storage/async-storage';
export default class DriverCompleteTrip extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            directionData: {},
            loadingModal: false,
            region: {
                latitude: 46,
                longitude: 2,
                latitudeDelta: 4,
                longitudeDelta: 4,
            },
            showMap: true
        }
    }

    UNSAFE_componentWillMount() {
        const allDetails = this.props.route.params.allDetails
        console.log('all detail from complete trip =')
        console.log(allDetails)
        this.setState({
            rideDetails: allDetails,
            region: {
                latitude: allDetails.pickup.lat,
                longitude: allDetails.pickup.lng,
                latitudeDelta: 0.9922,
                longitudeDelta: 0.9421,
            },
            curUid: firebase.auth().currentUser.uid
        }, () => {
            //checking status
            this.checking()
        })
        const { navigation } = this.props;
        /*this.focusListener = navigation.addListener('didFocus', () => {
            this.setState({ showMap: true });
        });

        this.blurListener = navigation.addListener('didBlur', () => {
            this.setState({ showMap: false });
        });*/
    }

    componentWillUnmount() {
        // this.focusListener.remove();
        // this.blurListener.remove();
    }

    componentDidMount() {
        const allDetails = this.props.route.params.allDetails
        const startTime = this.props.route.params.starttime
        if (startTime) {
            let time = startTime.toString()
            AsyncStorage.setItem('startTime', time)
            this.setState({ startTime: startTime })
        }
        const Data = firebase.database().ref('rates/');
        Data.once('value', rates => {
            if (rates.val()) {
                var carTypeWiseRate = rates.val();
                // Un même nom de véhicule existe pour plusieurs pays (Berline FR,
                // Berline SN…) : sans le pays de la course, c'est le dernier tarif
                // trouvé qui l'emportait, donc le mauvais barème.
                const rideCountry = (allDetails.pickup && allDetails.pickup.country) || '';
                for (var i = 0; i < carTypeWiseRate.car_type.length; i++) {
                    if (carTypeWiseRate.car_type[i].name == allDetails.carType
                        && (!rideCountry || carTypeWiseRate.car_type[i].country == rideCountry)) {
                        var rates = carTypeWiseRate.car_type[i];
                        this.setState({
                            rateDetails: rates
                        }, () => {
                            // console.log(this.state.rateDetails)
                        })
                    }
                }
            }
        })

        let dbRef = firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/');
        dbRef.update({
            queue: true
        }).then(() => {
            //this.handleGetDirections(allDetails)
        })
        //setInterval(this._getLocatioAsync.bind(this),30000);
    }


    checking() {
        if (this.state.rideDetails.bookingId) {
            let curUid = firebase.auth().currentUser.uid
            let bookingId = this.state.rideDetails.bookingId;
            const userData = firebase.database().ref('users/' + curUid + '/my_bookings/' + bookingId + '/');
            userData.on('value', bookingDetails => {
                if (bookingDetails.val()) {
                    let curstatus = bookingDetails.val().status;
                    this.setState({ status: curstatus })
                }
            })
        }
    }


    //save track history
    _getLocatioAsync = async () => {
        if (this.state.status == 'START' && this.state.loadingModal == false) {

            if (checkLocationPermission()) {
                let location = await Location.getCurrentPositionAsync({});
                var latlng = location.coords.latitude + ',' + location.coords.longitude;
                return fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng + '&key=' + google_map_key)
                    .then((response) => response.json())
                    .then((responseJson) => {
                        var keys = this.state.rideDetails.bookingId
                        firebase.database().ref('bookings/' + keys + '/current/').update({
                            lat: location.coords.latitude,
                            lng: location.coords.longitude,
                            add: responseJson.results[0].formatted_address
                        }).then(() => {
                            firebase.database().ref('bookings/' + keys + '/routes').push({
                                lat: location.coords.latitude,
                                lng: location.coords.longitude,
                                add: responseJson.results[0].formatted_address
                            })
                        })

                    })
                    .catch((error) => {
                        console.error(error);
                    });
            }
        } else {
            this.setState({
                errorMessage: 'Permission to access location was denied',
            });
        }



    };


    //End trip and fare calculation function
    async onPressEndTrip(item) {

        this.setState({ loadingModal: true })

        await Geolocation.getCurrentPosition(
            async (location) => {

                // Durée de la course en secondes : c'est l'unité attendue par le
                // calcul du tarif (il divise par 3600 pour obtenir des heures).
                var totalTimeTaken = Math.abs(Math.round((this.state.rideDetails.trip_start_time - new Date().getTime()) / 1000));
                var pos = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                };

                let startLoc = this.state.rideDetails.pickup.lat + ',' + this.state.rideDetails.pickup.lng;
                let destLoc = pos.latitude + ',' + pos.longitude;
                fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc}&destination=${destLoc}&key=${google_map_key}`)
                    .then((response) => response.json())
                    .then((respJson) => {
                        if (!respJson.routes || !respJson.routes[0] || !respJson.routes[0].legs) {
                            console.log('[Directions] pas de trajet pour le calcul du prix :', respJson.status, respJson.error_message || '');
                            this.setState({ loadingModal: false });
                            Alert.alert(languageJSON.Error || 'Erreur', 'Impossible de calculer la distance de la course. Réessayez.');
                            return;
                        }
                        const rideCountry = (this.state.rideDetails.pickup && this.state.rideDetails.pickup.country) || 'FR';
                        farehelper(respJson.routes[0].legs[0].distance.value, totalTimeTaken, this.state.rateDetails ? this.state.rateDetails : 1, rideCountry).then(
                            (fareCalculation) => {
                                this.finalCostStore(item, fareCalculation.grandTotal, pos, respJson.routes[0].legs[0].distance.value, fareCalculation.convenience_fees)
                            }
                        )
                    }
                    )
                    .catch((error) => {
                        console.log('[Fin de course] calcul du prix impossible', error);
                        this.setState({ loadingModal: false });
                        Alert.alert(languageJSON.Error || 'Erreur', 'Impossible de calculer le prix de la course. Vérifiez votre connexion et réessayez.');
                    })
            },
            error => {
                console.log('[Fin de course] position indisponible', error);
                this.setState({ loadingModal: false });
                Alert.alert(languageJSON.Error || 'Erreur', 'Position introuvable : impossible de terminer la course. Réessayez.');
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
        )
    }

    locationAdd(pos) {
        var latlng = pos.latitude + ',' + pos.longitude;
        return fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng + '&key=' + google_map_key)
    }

    //driver current location fetching
    finalCostStore(item, finalFare, pos, distance, convenience_fees) {
        let driverShare = (finalFare - convenience_fees);
        var data = {
            status: "END",
            payment_status: "IN_PROGRESS",
            trip_cost: finalFare,
            trip_end_time: firebase.database.ServerValue.TIMESTAMP,
            finaldistance: distance,
            convenience_fees: convenience_fees,
            driver_share: driverShare,
            customer_paid: finalFare,
            discount_amount: 0,
        }
        var riderData = {
            status: "END",
            payment_status: "IN_PROGRESS",
            trip_cost: finalFare,
            trip_end_time: firebase.database.ServerValue.TIMESTAMP,
            finaldistance: distance,
            convenience_fees: convenience_fees,
            customer_paid: finalFare,
            discount_amount: 0,

        }
        this.locationAdd(pos).then((response) => response.json()).then((responseJson) => {
            data.drop = { add: responseJson.results[0].formatted_address, lat: pos.latitude, lng: pos.longitude };
            riderData.drop = { add: responseJson.results[0].formatted_address, lat: pos.latitude, lng: pos.longitude };
            item.drop = { add: responseJson.results[0].formatted_address, lat: pos.latitude, lng: pos.longitude };
            if (data.drop) {
                this.saveData(item, data, riderData);
                this.updateDriverLocation(data.drop)
            }
        });
    }

    //Final cost and status set to database
    saveData(item, data, riderData) {

        let dbRef = firebase.database().ref('users/' + this.state.curUid + '/my_bookings/' + item.bookingId + '/');
        dbRef.update(data).then(() => {
            firebase.database().ref('bookings/' + item.bookingId + '/').update(data).then(() => {
                let userDbRef = firebase.database().ref('users/' + item.customer + '/my-booking/' + item.bookingId + '/');
                userDbRef.update(riderData).then(() => {
                    this.setState({ loadingModal: false })
                    this.props.navigation.navigate('DriverTripAccept', { screen: 'DriverFare', params: { allDetails: item, trip_cost: data.trip_cost, trip_end_time: data.trip_end_time } })
                    // Notification désormais envoyée par le serveur (déclencheur sur le statut de la course)
                    // this.sendPushNotification(item.customer, item.bookingId)
                })
            })
        })
    }

    //update driver location
    updateDriverLocation(location) {

        firebase.database().ref('users/' + this.state.curUid + '/location').update({
            add: location.add,
            lat: location.lat,
            lng: location.lng
        })
    }
    sendPushNotification(customerUID, bookingId) {
        const customerRoot = firebase.database().ref('users/' + customerUID);
        customerRoot.once('value', customerData => {
            if (customerData.val()) {
                let allData = customerData.val()
            }
        })
    }

    loading() {
        return (
            <Modal
                animationType="fade"
                transparent={true}
                visible={this.state.loadingModal}
                onRequestClose={() => {
                    this.setState({ loadingModal: false })
                }}
            >
                <View style={styles.loadModalContainer}>
                    <View style={styles.loadModalInnerContainer}>
                        <ActivityIndicator size="large" color={colors.PRIMARY} />
                        <Text style={styles.loadModalText}>{languageJSON.please_wait}</Text>
                    </View>
                </View>
            </Modal >
        )
    }

    // google navigations now it not implemented in client side
    handleGetDirections(allDetails) {
        const data = {
            latitude: allDetails.drop.lat,
            longitude: allDetails.drop.lng,
            sourceLatitude: allDetails.pickup.lat,
            sourceLongitude: allDetails.pickup.lng,
            alwaysIncludeGoogle: true, // optional, true will always add Google Maps to iOS and open in Safari, even if app is not installed (default: false)
            dialogTitle: languageJSON.directionsdialogTitle,
            dialogMessage: languageJSON.directionsdialogMessage,
            cancelText: languageJSON.directionscancelText,
            appsWhiteList: ['google-maps', 'waze', "apple-maps"]
        }
        //showLocation(data)
        /*this.setState({
            directionData: data,
            directionPopupVisible: true,
        })*/
        Linking.openURL('https://waze.com/ul?ll=' + allDetails.drop.lat + '%2C' + allDetails.drop.lng + '&navigate=yes')
    }



    render() {
        console.log('from complete trip')
        return (
            <View style={styles.containerView}>
                {this.state.showMap &&
                    <TrackNow bId={this.state.rideDetails.bookingId} alldata={this.state.rideDetails} />}
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<DrawerToggle {...this.props} style={styles.drawer} />}
                    rightComponent={<TicketBtn data={this.state.rideDetails} />}
                    containerStyle={styles.headerStyle}
                />
                <View style={styles.footer} >
                    <Button
                        title={languageJSON.get_direction}
                        onPress={() => this.handleGetDirections(this.state.rideDetails)}
                        titleStyle={[styles.titleViewStyle, { color: colors.TEXT }]}
                        buttonStyle={[styles.buttonStyleView, { backgroundColor: colors.WHITE }]}
                    />
                    <Button
                        title={languageJSON.complete_trip}
                        onPress={() => {
                            this.onPressEndTrip(this.state.rideDetails)
                        }}
                        titleStyle={styles.titleViewStyle}
                        buttonStyle={[styles.buttonStyleView, { marginBottom: 30 }]}
                    />
                </View>
                {this.loading()}
            </View>
        );
    }
}

//Screen Styling
const styles = StyleSheet.create({
    containerView: {
        flex: 1,
        //marginTop: StatusBar.currentHeight
    },
    textContainer: {
        textAlign: "center",
        fontSize: 16.2,
        color: colors.BLUE.default.dark,
        fontFamily: 'Montserrat-Medium',
        lineHeight: 22
    },
    headerTitleStyle: {
        color: colors.WHITE,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    segment1: {
        width: '97.4%',
        flex: 1,
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: colors.WHITE,
        marginLeft: 5,
        marginRight: 5,
        marginTop: 5,
        paddingTop: 12,
        paddingBottom: 12,
        paddingRight: 8,
        paddingLeft: 8
    },
    segment2: {
        flex: 10,
        width: '97.4%',
        alignSelf: 'center',
        borderRadius: 10,
        backgroundColor: colors.WHITE,
        marginLeft: 5,
        marginRight: 5,
        marginTop: 5,
        paddingTop: 12,
        paddingBottom: 12,
        paddingRight: 8,
        paddingLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative'
    },
    segment3: {
        flex: 2,
        borderRadius: 10,
        marginLeft: 5,
        marginRight: 5,
        marginTop: 5,
        marginBottom: 5,
        paddingTop: 3,
        paddingBottom: 3,
        paddingRight: 8,
        paddingLeft: 8,
        alignItems: 'center',

    },
    map: {
        flex: 1,
        borderRadius: 10,
        ...StyleSheet.absoluteFill,
    },
    innerStyle: {
        marginLeft: 10,
        marginRight: 10
    },
    buttonStyleView: {
        height: 50,
        borderRadius: 10,
        backgroundColor: colors.PRIMARY,
        marginBottom: 10,
    },
    titleViewStyle: {
        fontFamily: 'Montserrat-Bold',
        color: colors.WHITE,
        fontSize: 12
    },
    drawer: {
        backgroundColor: colors.ITEM
    },
    headerStyle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        borderBottomWidth: 0,
        paddingHorizontal: 20
    },
    gradient: {
        ...StyleSheet.absoluteFill,
        height: 100
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
    },
    loadModalContainer: {
        backgroundColor: "rgba(0,0,0,.4)",
        flex: 1,
        justifyContent: "center",
        padding: 20,
    },
    loadModalInnerContainer: {
        backgroundColor: "white",
        borderRadius: 10,
        padding: 15,
        flexDirection: "row",
        alignItems: 'center',
    },
    loadModalText: {
        flex: 1,
        fontFamily: "Montserrat-SemiBold",
        fontSize: 14,
        color: colors.HOLDER_TEXT,
        marginLeft: 15
    }

});
