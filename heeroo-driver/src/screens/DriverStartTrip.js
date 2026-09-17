import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    Image,
    Dimensions,
    TouchableWithoutFeedback,
    StatusBar,
    Linking,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    Platform,
} from 'react-native';
import { MapComponent, TripStartModal } from '../components';
import TicketBtn from '../components/TicketBtn';
import { Button, Header, Icon } from '@rneui/themed';
import { colors } from '../common/theme';
import { RequestPushMsg } from '../common/RequestPushMsg';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import languageJSON from '../common/language';
var { width, height } = Dimensions.get('window');
import { google_map_key } from '../common/key';
import { DrawerToggle, NotificationBtn } from '../components';
import { getDistance } from 'geolib';

import BackgroundGeolocation from '../common/backgroundGeolocation';
import { checkLocationPermission } from '../common/permission';

export default class DriverStartTrip extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            nearNotifSend: false,
            riderToken: null,
            region: {
                latitude: 46,
                longitude: 2,
                latitudeDelta: 4,
                longitudeDelta: 4,
            },
            mediaSelectModal: false,
            allData: "",
            inputCode: "",
            prevPosition: null,
            directionData: {},
            directionPopupVisible: false,
            showMap: true,
            // Données synchrones disponibles dès le premier rendu
            rideDetails: props.route.params.allDetails,
            curUid: firebase.auth().currentUser ? firebase.auth().currentUser.uid : '',
        }
        const pickup = props.route.params.allDetails && props.route.params.allDetails.pickup;
        if (pickup && pickup.lat) {
            this.state.region = { latitude: pickup.lat, longitude: pickup.lng, latitudeDelta: 0.1, longitudeDelta: 0.1 };
        }
    }

    componentDidMount() {
        const allDetails = this.props.route.params.allDetails
        const riderData = firebase.database().ref('users/' + allDetails.customer)

        riderData.once('value', (snap) => {
            if (snap.val()) {
                this.setState({
                    riderToken: snap.val().pushToken
                })
            }
        })

        this.checkStaus()

        //setInterval(this.updateLocation.bind(this),10000);
        const { navigation } = this.props;
        this.focusListener = navigation.addListener('didFocus', () => {
            this.setState({ showMap: true });
        });

        this.blurListener = navigation.addListener('didBlur', () => {
            this.setState({ showMap: false });
        });

        this.watchCurrentPosition();
    }

    componentWillUnmount() {
        BackgroundGeolocation.removeAllListeners();
    }

    checkStaus() {
        let tripRef = firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/my_bookings/' + this.state.rideDetails.bookingId + '/');
        tripRef.on('value', (snap) => {
            let tripData = snap.val();
            if (tripData) {

                this.setState({ status: tripData.status })
                if (tripData.status == "CANCELLED") {
                    BackgroundGeolocation.removeAllListeners();
                    BackgroundGeolocation.stop()
                    this.props.navigation.goBack();
                }
            }
        })

        // console.log('curuser',firebase.auth().currentUser.uid)
    }


    updateLocation = async (location) => {
        if (this.state.status == 'ACCEPTED') {
            var latlng = location.latitude + ',' + location.longitude;
            fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng + '&key=' + google_map_key)
                .then((response) => response.json())
                .then((responseJson) => {
                    firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/location').update({
                        lat: location.latitude,
                        lng: location.longitude,
                        add: responseJson.results[0].formatted_address
                    })


                    var distance = getDistance({ latitude: location.latitude, longitude: location.longitude }, { latitude: this.state.rideDetails.pickup.lat, longitude: this.state.rideDetails.pickup.lng });
                    console.log('on est a ' + distance + ' metres')

                    if (distance <= 100 && !this.state.nearNotifSend && this.state.rideDetails && this.state.rideDetails.bookingId) {
                        // Le serveur notifie le passager (déclencheur sur bookings/<id>/driver_near)
                        firebase.database().ref('bookings/' + this.state.rideDetails.bookingId + '/driver_near').set(true);
                        this.setState({ nearNotifSend: true });
                    }
                    if (this.mapRef) {
                        this.mapRef.fitToCoordinates([{ latitude: location.latitude, longitude: location.longitude }, { latitude: this.state.rideDetails.pickup.lat, longitude: this.state.rideDetails.pickup.lng }], {
                            edgePadding: { top: Platform.OS == "ios" ? 100 : 200, right: 40, bottom: Platform.OS == "ios" ? height / 2 : height / 1, left: 40 },
                            animated: true,
                        })
                    }
                })
                .catch((error) => {
                    console.error(error);
                });
        }
    };

    watchCurrentPosition = async () => {
        /*if (checkLocationPermission()) {
            this.watchID = Geolocation.watchPosition(position => {
                this.setState({ prevPosition: position.coords });
                this.updateLocation(position);

            }, error => console.log(error),
                {
                    enableHighAccuracy: true,
                    timeout: 2000,
                    maximumAge: 1000,
                    distanceFilter: 10,
                    useSignificantChanges: true
                });
        }*/
        BackgroundGeolocation.configure({
            desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
            stationaryRadius: 1,
            distanceFilter: 1,
            debug: false,
            notificationTitle: 'Heeroo Driver',
            notificationText: 'En approche ...',
            startOnBoot: true,
            stopOnTerminate: true,
            locationProvider: BackgroundGeolocation.DISTANCE_FILTER_PROVIDER,
            interval: 2000,
            fastestInterval: 2000,
            activitiesInterval: 2000,
            stopOnStillActivity: false,
            startForeground: true,
        });

        BackgroundGeolocation.on('location', (location) => {
            // handle your locations here
            console.log('location changed with  ' + location.latitude + " , " + location.longitude)
            // to perform long running operation on iOS
            // you need to create background task
            BackgroundGeolocation.startTask(taskKey => {
                this.updateLocation(location);
                this.setState({
                    prevPosition: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 4,
                        longitudeDelta: 4
                    }
                });

                // execute long running task
                // eg. ajax post location
                // IMPORTANT: task has to be ended by endTask
                BackgroundGeolocation.endTask(taskKey);
            });
        });

        BackgroundGeolocation.on('stationary', (stationaryLocation) => {
            // handle stationary locations here

            console.log('stationnary')
            //Actions.sendLocation(stationaryLocation);
        });

        BackgroundGeolocation.on('error', (error) => {
            console.log('[ERROR] BackgroundGeolocation error:', error);
        });

        BackgroundGeolocation.on('start', () => {
            console.log('[INFO] BackgroundGeolocation service has been started');
        });

        BackgroundGeolocation.on('stop', () => {
            console.log('[INFO] BackgroundGeolocation service has been stopped');
        });

        BackgroundGeolocation.on('background', () => {
            console.log('[INFO] App is in background');
        });

        BackgroundGeolocation.on('foreground', () => {
            console.log('[INFO] App is in foreground');
        });

        BackgroundGeolocation.start()

        BackgroundGeolocation.checkStatus(status => {
            console.log('[INFO] BackgroundGeolocation service is running', status.isRunning);
            console.log('[INFO] BackgroundGeolocation services enabled', status.locationServicesEnabled);
            console.log('[INFO] BackgroundGeolocation auth status: ' + status.authorization);

            BackgroundGeolocation.start();
        });

    }

    //start trip button press function
    onPressStartTrip(item) {
        this.setState({ allData: item, loading: true });
        //this.setState({mediaSelectModal:true})
        this.codeEnter('');

    }
    closeModal() {
        this.setState({ mediaSelectModal: false })
    }

    //navigate to chat page
    chat() {
        this.props.navigation.navigate("Chat", { passData: this.state.rideDetails });
    }

    callToCustomer(data) {
        if (data.customer) {
            const cusData = firebase.database().ref('users/' + data.customer);
            cusData.once('value', customerData => {
                if (customerData.val() && customerData.val().mobile) {
                    var customerPhoneNo = customerData.val().mobile
                    try {
                        Linking.openURL('tel:' + customerPhoneNo);
                    } catch (error) {
                        console.error('An error occurred', error)
                    }
                } else {
                    alert(languageJSON.mobile_no_found)
                }
            })
        }

    }

    //Promo code enter function
    codeEnter(inputCode) {
        //if(inputCode == "" || inputCode == undefined || inputCode == null){
        //    alert("Please enter OTP");
        //}else{        
        if (this.state.rideDetails) {
            //if(inputCode == this.state.rideDetails.otp){
            var data = {
                start_date: firebase.database.ServerValue.TIMESTAMP,
                status: "START",
                payment_status: "DUE",
                trip_start_time: firebase.database.ServerValue.TIMESTAMP,
            }
            var riderData = {
                start_date: firebase.database.ServerValue.TIMESTAMP,
                status: "START",
                payment_status: "DUE",
                trip_start_time: firebase.database.ServerValue.TIMESTAMP,
            }
            let dbRef = firebase.database().ref('users/' + this.state.curUid + '/my_bookings/' + this.state.rideDetails.bookingId + '/');
            dbRef.update(data).then(() => {
                firebase.database().ref('bookings/' + this.state.rideDetails.bookingId + '/').update(data).then(() => {
                    let userDbRef = firebase.database().ref('users/' + this.state.rideDetails.customer + '/my-booking/' + this.state.rideDetails.bookingId + '/');
                    userDbRef.update(riderData).then(() => {
                        this.closeModal();
                        this.setState({ loading: true });
                        BackgroundGeolocation.removeAllListeners();
                        BackgroundGeolocation.stop()
                        this.props.navigation.navigate('DriverTripComplete', { allDetails: { ...data, ...this.state.rideDetails }, starttime: firebase.database.ServerValue.TIMESTAMP })
                        // Notification désormais envoyée par le serveur (déclencheur sur le statut de la course)
                        // this.sendPushNotification(this.state.rideDetails.customer, this.state.rideDetails.bookingId);
                    })
                })
            })

        }
        //}

    }

    sendPushNotification(customerUID, bookingId) {
        const customerRoot = firebase.database().ref('users/' + customerUID);
        customerRoot.once('value', customerData => {
            if (customerData.val()) {
                let allData = customerData.val()
                RequestPushMsg(allData.pushToken ? allData.pushToken : null, languageJSON.driver_journey_err + bookingId, null, languageJSON.trip_in_progress)
            }
        })
    }

    handleGetDirections() {
        /* const data = {
             latitude: this.state.rideDetails.pickup.lat,
             longitude: this.state.rideDetails.pickup.lng,
             sourceLatitude: this.state.prevPosition.latitude,
             sourceLongitude: this.state.prevPosition.longitude,
             //alwaysIncludeGoogle: true, // optional, true will always add Google Maps to iOS and open in Safari, even if app is not installed (default: false)
             dialogTitle: languageJSON.directionsdialogTitle,
             dialogMessage: languageJSON.directionsdialogMessage,
             cancelText: languageJSON.directionscancelText,
             appsWhiteList: ['google-maps', 'waze', "apple-maps"]
         }*/

        Linking.openURL('https://waze.com/ul?ll=' + this.state.rideDetails.pickup.lat + '%2C' + this.state.rideDetails.pickup.lng + '&navigate=yes')

        /* if (this.state.prevPosition.latitude == this.state.rideDetails.pickup.lat && this.state.prevPosition.longitude == this.state.rideDetails.pickup.lng) {
             Alert.alert(
                 languageJSON.yourinthepositiontitle,
                 languageJSON.yourintheposition,
                 [
                     { text: "OK", onPress: () => console.log("OK Pressed") }
                 ],
                 { cancelable: false }
             );
         } else {
             //showLocation(data)
        this.setState({
            directionData: data,
            directionPopupVisible: true,
        })
        }
             */
    }


    render() {

        const splited_name = this.state.rideDetails ? this.state.rideDetails.customer_name.split(" ") : "";
        const customer_name = splited_name[0] + " " + (splited_name[1] && splited_name[1].substring(0, 1)) + ".";
        return (
            <View style={styles.containerView}>
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<DrawerToggle {...this.props} style={styles.drawer} />}
                    rightComponent={<TicketBtn data={this.state.rideDetails} />}
                    containerStyle={styles.headerStyle}
                />
                {this.state.showMap &&
                    <MapComponent
                        mapRef={ref => this.mapRef = ref}
                        mapStyle={styles.map} mapRegion={this.state.region} currentPosition={this.state.prevPosition} markerCord={this.state.region} />}

                <View style={[styles.segment]}>
                    <View style={styles.tripContainer} >
                        <View flex={1} >
                            <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                            <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.rideDetails.pickup.add ? this.state.rideDetails.pickup.add : ""}</Text>
                        </View>
                        <View style={styles.separator} />
                        <View flex={1}>
                            <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                            <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.rideDetails.drop.add ? this.state.rideDetails.drop.add : ""}</Text>
                        </View>
                    </View>

                    <View style={styles.clockContainer}>
                        <View style={styles.riderTextStyle}>
                            <Text style={styles.riderText} numberOfLines={1} >{languageJSON.wait_for_rider}</Text>
                            <Text style={styles.riderTextSubheading}>{languageJSON.rider_notified}</Text>
                        </View>

                    </View>
                    <View style={styles.client} >
                        <Image style={styles.clientImage}
                            source={this.state.rideDetails && this.state.rideDetails.customer_image ? { uri: this.state.rideDetails.customer_image } : require('../../assets/images/avatar.png')}
                        />
                        <Text style={styles.clientText} >{customer_name}</Text>
                        <TouchableOpacity
                            style={styles.btnChat}
                            onPress={() => this.chat()}
                        >
                            <Icon
                                name="comment-multiple-outline"
                                type="material-community"
                                // icon: 'chat', color: '#fff',
                                size={20}
                                color={colors.PRIMARY}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.btnCall}
                            onPress={() => this.callToCustomer(this.state.rideDetails)}
                        >
                            <Icon
                                name="phone"
                                type="simple-line-icon"
                                // icon: 'chat', color: '#fff',
                                size={20}
                                color={colors.PRIMARY}
                            />
                        </TouchableOpacity>
                    </View>
                    <Button
                        title={languageJSON.get_direction}
                        onPress={() => this.handleGetDirections()}
                        titleStyle={[styles.titleViewStyle, { color: colors.TEXT }]}
                        buttonStyle={[styles.buttonStyleView, { backgroundColor: colors.WHITE }, styles.btnDirection]}
                    />
                    <Button
                        title={languageJSON.start_trip}
                        onPress={() => this.onPressStartTrip(this.state.rideDetails)}
                        titleStyle={styles.btnText}
                        loading={this.state.loading}
                        loadingProps={{ color: colors.BUTTON_TEXT }}
                        buttonStyle={styles.myButtonStyle}
                    />
                </View>
                <TripStartModal
                    modalvisable={this.state.mediaSelectModal}
                    requestmodalclose={() => { this.closeModal() }}
                    onChangeText={text => this.setState({ inputCode: text })}
                    enterCode={() => this.codeEnter(this.state.inputCode)}
                />
            </View>
        );
    }
}

//Screen Styling
const styles = StyleSheet.create({
    containerView: {
        flex: 1,
        justifyContent: "flex-end"
    },
    headerStyle: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        borderBottomWidth: 0,
        paddingHorizontal: 20,
        zIndex: 3
    },
    headerTitleStyle: {
        color: colors.WHITE,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    segment: {
        margin: 15,
        borderRadius: 15,
        backgroundColor: Platform.OS == "ios" ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.95)",
        shadowColor: "rgba(0, 0, 0, 0.16)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 14,
        shadowOpacity: 1,
        paddingHorizontal: 10,
        paddingVertical: 15,
        elevation: 1
    },
    gradient: {
        ...StyleSheet.absoluteFill,
        height: 100,
        zIndex: 1
    },
    blurView: {
        ...StyleSheet.absoluteFill,
        borderRadius: 15,
    },
    map: {
        ...StyleSheet.absoluteFill,
    },
    myButtonStyle: {
        height: 50,
        borderRadius: 10,
        backgroundColor: colors.PRIMARY
    },
    btnText: {
        color: colors.BUTTON_TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 12
    },
    btnChat: {
        width: 50,
        height: 50,
        marginRight: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.WHITE,
        borderRadius: 8,
        shadowColor: "rgba(0, 0, 0, 0.06)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 6,
        shadowOpacity: .6,
        elevation: 1
    },
    btnCall: {
        width: 50,
        height: 50,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.WHITE,
        borderRadius: 8,
        shadowColor: "rgba(0, 0, 0, 0.06)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 6,
        shadowOpacity: .6,
        elevation: 1
    },
    tripContainer: {
        flexDirection: 'row',
        justifyContent: "center",
        borderBottomWidth: 1,
        borderColor: colors.SEPARATOR_LIGHT,
        paddingBottom: 10,
    },
    holderText: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: 10,
        color: colors.HOLDER_TEXT,
    },
    placeStyle: {
        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,
    },
    separator: {
        marginRight: 8,
        width: 1,
        backgroundColor: colors.SEPARATOR_LIGHT
    },
    clockContainer: {
        flexDirection: "row",
        paddingVertical: 15
    },
    clock: {
        width: 38,
        height: 38,
        marginRight: 20
    },
    riderText: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: 12,
        color: colors.TEXT_SEMI_DARKER,
    },
    riderTextSubheading: {
        fontFamily: "Montserrat-Light",
        fontSize: 10,
        color: colors.PRIMARY,
    },
    riderTextStyle: {
        flex: 1,
        justifyContent: "center"
    },
    drawer: {
        backgroundColor: colors.ITEM
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
    client: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10
    },
    clientImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 10
    },
    clientText: {
        flex: 1,
        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,

    },
    btnDirection: {
        shadowColor: "rgba(0, 0, 0, 0.06)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 6,
        shadowOpacity: .6,
        elevation: 1
    }
});