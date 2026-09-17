import React from 'react';
import { Text, View, StyleSheet, Dimensions, FlatList, Modal, TouchableHighlight, TouchableWithoutFeedback, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { Button, Header } from '@rneui/themed';
import Polyline from '@mapbox/polyline';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { colors, mapStyle } from '../common/theme';
var { width, height } = Dimensions.get('window');
import messaging from '@react-native-firebase/messaging';


import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
var { height } = Dimensions.get('window');
import { RequestPushMsg } from '../common/RequestPushMsg';
import { google_map_key } from '../common/key';
import languageJSON from '../common/language';
import { DrawerToggle, NotificationBtn, Path } from '../components';
import { Icon } from '@rneui/themed';
import { Pin, Car } from '../icons'
import countryCurrency from './../constants/countryCurrency.json'
import { checkLocationPermission } from '../common/permission';
import Geolocation from '../common/geolocation';


export default class DriverTripAccept extends React.Component {

    setModalVisible(visible, data) {
        this.setState({
            modalVisible: visible,
            modalData: data
        });
    }

    constructor(props) {

        super(props);
        this.state = {
            region: {
                latitude: 37.78825,
                longitude: -122.4324,
                latitudeDelta: 0.9922,
                longitudeDelta: 0.9421,
            },
            starCount: 5,
            modalVisible: false,
            alertModalVisible: false,
            watchID: null,
            coords: [],
            radio_props: [
                { label: languageJSON.cancel_reson_1, value: 0 },
                { label: languageJSON.cancel_reson_2, value: 1 },
                { label: languageJSON.cancel_reson_3, value: 2 },
                { label: languageJSON.cancel_reson_4, value: 3 },
                { label: languageJSON.cancel_reson_5, value: 4 }
            ],
            value: 0,
            tasklist: [],
            myLocation: {},
            driverDetails: null,
            curUid: '',
            id: 0,
            currency: {
                code: ' ',
                symbol: ' '
            },
            allCurrency: []
        }
        this.getAllCurencySymbol()
    }

    //checking booking status
    checking() {
        if (this.state.currentBId) {
            let curUid = firebase.auth().currentUser.uid
            let bookingId = this.state.currentBId;
            const userData = firebase.database().ref('users/' + curUid + '/my_bookings/' + bookingId + '/');
            userData.on('value', bookingDetails => {
                if (bookingDetails.val()) {
                    let curstatus = bookingDetails.val().status;
                    this.setState({ status: curstatus })
                }
            })
        }
    }


    componentDidMount() {



        checkLocationPermission().then((result) => {
            this._getFirstLocationAsync()
            this.getRiders();
        })

    }


    componentWillUnmount() {
        // Remove the event listener
        Geolocation.stopObserving();
        Geolocation.clearWatch(this.state.watchID)
    }

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
            await this.setState({ coords: coords })
            return coords
        }
        catch (error) {
            alert(error)
            return error
        }
    }

    _getFirstLocationAsync = async () => {

        await Geolocation.getCurrentPosition(
            location => {

                if (location) {
                    var pos = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    };
                    this.setState({ myLocation: pos })
                    var curuser = firebase.auth().currentUser.uid;
                    if (pos) {
                        var latlng = pos.latitude + ',' + pos.longitude;
                        fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng + '&key=' + google_map_key)
                            .then((response) => response.json())
                            .then((responseJson) => {
                                if (responseJson.results[0] && responseJson.results[0].formatted_address) {
                                    firebase.database().ref('users/' + curuser + '/location').update({
                                        add: responseJson.results[0].formatted_address,
                                        lat: pos.latitude,
                                        lng: pos.longitude
                                    })
                                } else {
                                    alert(languageJSON.api_error)
                                }
                            })
                            .catch((error) => {
                                console.error(error);
                            });
                    }
                }
                this._getLocationAsync();

            },
            error => {
                console.log('error from current pos from drivertripaccpet')
                console.log(error)
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
        )


    }

    //get current location
    _getLocationAsync = async () => {

        const watchID = await Geolocation.watchPosition(
            location => {
                if (location) {
                    console.log('depuis trip accept')

                    var pos = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    };
                    this.setState({ myLocation: pos })
                    var curuser = firebase.auth().currentUser.uid;
                    if (pos) {
                        var latlng = pos.latitude + ',' + pos.longitude;
                        firebase.database().ref('users/' + curuser + '/location').update({
                            lat: pos.latitude,
                            lng: pos.longitude
                        })
                        return 'stop before call api gmaps ( DriverTripAccept)'
                    }
                }
            },
            error => {
                console.log('error from wathpos')
                console.log(error)
            },
            {
                enableHighAccuracy: true,
                distanceFilter: 1,

            });
        this.setState({ watchID: watchID })
    }


    //get nearby riders function
    getRiders() {
        var curuid = firebase.auth().currentUser.uid;
        this.setState({ curUid: firebase.auth().currentUser.uid })
        let ref = firebase.database().ref('users/' + curuid + '/');
        ref.on('value', (snapshot) => {
            this.setState({ driverDetails: snapshot.val() })
            var jobs = [];
            let waiting_riderData = snapshot.val().waiting_riders_list;
            for (let key in waiting_riderData) {
                waiting_riderData[key].bookingId = key;
                jobs.push(waiting_riderData[key]);
            }
            let my_bookingsData = snapshot.val().my_bookings;
            for (let key in my_bookingsData) {
                if (my_bookingsData[key].status == "START") {
                    my_bookingsData[key].bookingUid = key;
                    jobs.push(my_bookingsData[key]);
                }
            }

            this.setState({ tasklist: jobs.reverse() });
            this.jobs = jobs;
        });
    }

    getBookingDetails() {
        let ref = firebase.database().ref('bookings/' + item.bookingId + '/');
        ref.on('value', (snapshot) => {
            this.setState({
                bookingDetails: snapshot.val()
            })
        })
    }

    onPressAccept(item, index) {
        var data = {
            carType: item.carType,
            customer: item.customer,
            customer_name: item.customer_name,
            customer_contact: item.customer_contact,
            otp: item.otp,
            distance: item.distance,
            driver: this.state.curUid,
            driver_image: this.state.driverDetails.profile_image ? this.state.driverDetails.profile_image : "",
            driver_name: this.state.driverDetails.firstName + ' ' + this.state.driverDetails.lastName,
            driver_contact: this.state.driverDetails.mobile,
            company_name: this.state.driverDetails.companyName,
            company_address: this.state.driverDetails.companyAddress,
            vehicle_number: this.state.driverDetails.vehicleNumber,
            // vehicleModelName: this.state.driverDetails.vehicleModel,
            driverRating: this.state.driverDetails.ratings ? this.state.driverDetails.ratings.userrating : "0",
            drop: item.drop,
            pickup: item.pickup,
            estimate: item.estimate,
            estimateDistance: item.estimateDistance,
            serviceType: item.serviceType,
            status: "ACCEPTED",
            total_trip_time: item.total_trip_time,
            trip_cost: item.trip_cost,
            trip_end_time: item.trip_end_time,
            trip_start_time: item.trip_start_time,
            tripdate: item.tripdate,
        }

        var riderData = {
            carType: item.carType,
            distance: item.distance,
            driver: this.state.curUid,
            driver_image: this.state.driverDetails.profile_image ? this.state.driverDetails.profile_image : "",
            driver_name: this.state.driverDetails.firstName + ' ' + this.state.driverDetails.lastName,
            driver_contact: this.state.driverDetails.mobile,
            vehicle_number: this.state.driverDetails.vehicleNumber,
            company_name: this.state.driverDetails.companyName,
            company_address: this.state.driverDetails.companyAddress,
            // vehicleModelName: this.state.driverDetails.vehicleModel,
            driverRating: this.state.driverDetails.ratings ? this.state.driverDetails.ratings.userrating : "0",
            drop: item.drop,
            otp: item.otp,
            pickup: item.pickup,
            estimate: item.estimate,
            estimateDistance: item.estimateDistance,
            serviceType: item.serviceType,
            status: "ACCEPTED",
            total_trip_time: item.total_trip_time,
            trip_cost: item.trip_cost,
            trip_end_time: item.trip_end_time,
            trip_start_time: item.trip_start_time,
            tripdate: item.tripdate,
        }

        item = { ...item, ...data };

        this.setState({ ['loading' + index]: true });
        let dbRef = firebase.database().ref('users/' + this.state.curUid + '/my_bookings/' + item.bookingId + '/');
        dbRef.update(data).then(() => {
            firebase.database().ref('bookings/' + item.bookingId + '/').update(data).then(() => {
                firebase.database().ref('bookings/' + item.bookingId).once('value', (snap) => {
                    let requestedDriverArr = snap.val().requestedDriver;
                    if (requestedDriverArr) {
                        for (let i = 0; i < requestedDriverArr.length; i++) {
                            firebase.database().ref('users/' + requestedDriverArr[i] + '/waiting_riders_list/' + item.bookingId + '/').remove();
                        }
                        Geolocation.stopObserving();
                        Geolocation.clearWatch(this.state.watchID)
                        this.props.navigation.navigate('DriverTripStart', { allDetails: item })
                    }
                    // console.log(snap.val().requestedDriver)
                })
            })
            this.setState({ currentBId: item.bookingId, ['loading' + index]: false }, () => {
                this.checking();
                this.sendPushNotification(item.customer, item.bookingId, languageJSON.accept_booking_request)
            })

        }).catch((error) => {
            this.setState({ ['loading' + index]: false });
            console.log(error)
        })


        let userDbRef = firebase.database().ref('users/' + item.customer + '/my-booking/' + item.bookingId + '/'); userDbRef.update(riderData);
        let currentUserdbRef = firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/');
        currentUserdbRef.update({
            queue: true
        }).then(res => {
            this.setState({ loading: false });
        })
    }

    //ignore button press function
    onPressIgnore(item) {
        firebase.database().ref('bookings/' + item.bookingId + '/').once('value', data => {
            if (data.val()) {
                let mainBookingData = data.val();
                if (mainBookingData.requestedDriver) {
                    if (mainBookingData.requestedDriver.length == 1) {
                        firebase.database().ref('bookings/' + item.bookingId + '/').update({
                            status: "CANCELLED",
                            requestedDriver: []
                        })
                            .then(() => {
                                let userDbRef = firebase.database().ref('users/' + item.customer + '/my-booking/' + item.bookingId + '/');
                                userDbRef.update({
                                    status: "CANCELLED",
                                });
                                this.sendPushNotification(item.customer, item.bookingId, languageJSON.booking_request_rejected)
                            })
                    }
                    else {
                        let arr = mainBookingData.requestedDriver.filter((item) => {
                            return item != this.state.curUid
                        })
                        firebase.database().ref('bookings/' + item.bookingId + '/').update({
                            requestedDriver: arr
                        })
                    }
                }
            }
        });

        firebase.database().ref('users/' + this.state.curUid + '/waiting_riders_list/' + item.bookingId + '/').remove().then(() => {
            this.setModalVisible(false, null)
        });

    }

    sendPushNotification(customerUID, bookingId, msg) {
        const customerRoot = firebase.database().ref('users/' + customerUID);
        customerRoot.once('value', customerData => {
            if (customerData.val()) {
                let allData = customerData.val()
                RequestPushMsg(allData.pushToken ? allData.pushToken : null, msg, null, null)
            }
        })
    }

    onPressProgressTrip = (item, index) => {
        if (item && item.trip_cost > 0) {
            item.roundoffCost = Math.round(item.trip_cost).toFixed(0);
            item.roundoff = (Math.round(item.roundoffCost) - item.trip_cost).toFixed(0)
            this.props.navigation.push('RideDetails', { data: item });

        } else {
            item.roundoffCost = Math.round(item.estimate).toFixed(0);
            item.roundoff = (Math.round(item.roundoffCost) - item.estimate).toFixed(0)
            this.props.navigation.push('RideDetails', { data: item });
        }
    }
    getCurrencySymbol(country) {
        const data = this.state.allCurrency
        let result = ''

        data.forEach(element => {
            if (country == element.country) {
                result = '' + element.symbol

            }
        });

        return result
    }
    getAllCurencySymbol() {
        firebase.database().ref('settings/').once('value', value => {
            if (value.val()) {
                this.setState({
                    allCurrency: value.val()
                })

            }
        })
    }
    render() {

        return (
            <View style={styles.mainViewStyle}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    //rightComponent={<NotificationBtn {...this.props}  />}
                    containerStyle={styles.headerStyle}
                />
                <FlatList
                    showsVerticalScrollIndicator={false}
                    style={styles.listView}
                    data={this.state.tasklist}
                    keyExtractor={(item, index) => index.toString()}
                    ListEmptyComponent={<View style={styles.noData}><Text style={styles.noDataText}>{languageJSON.rider_not_here}</Text></View>}
                    renderItem={({ item, index }) => {

                        if (item.status == "START") {
                            return (
                                <TouchableOpacity style={styles.tripProgressView} onPress={() => this.onPressProgressTrip(item, index)}>
                                    <View style={[styles.bookHeader]} >
                                        <Text style={[styles.dateStyle]}>{new Date(item.tripdate).toLocaleString()}</Text>
                                        <View style={[styles.locationStatus, { backgroundColor: "#fdd42c" }]} />
                                    </View>
                                    <View flexDirection="row">
                                        <Path border={4} />
                                        <View flex={1}>
                                            <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                                            <Text style={[styles.placeStyle]} numberOfLines={1} >{item.pickup.add ? item.pickup.add : ""}</Text>
                                            <View style={styles.separator} />
                                            <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                                            <Text style={[styles.placeStyle]} numberOfLines={1} >{item.drop.add ? item.drop.add : ""}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        } else {
                            return (
                                <View style={styles.listItemView}>
                                    <View style={styles.mapcontainer}>
                                        <MapView
                                            style={styles.map}
                                            provide
                                            r={PROVIDER_GOOGLE}
                                            initialRegion={{
                                                latitude: item.pickup.lat,
                                                longitude: item.pickup.lng,
                                                latitudeDelta: 0.5022,
                                                longitudeDelta: 0.1821
                                            }}
                                            customMapStyle={mapStyle}
                                        >
                                            <Marker
                                                tracksViewChanges={false}
                                                coordinate={{ latitude: item.pickup.lat, longitude: item.pickup.lng }}
                                                title={item.pickup.add}
                                                description={languageJSON.pickup_location}
                                            >
                                                <Pin color={colors.SECONDARY} />
                                            </Marker>

                                            <Marker
                                                tracksViewChanges={false}
                                                coordinate={{ latitude: item.drop.lat, longitude: item.drop.lng }}
                                                title={item.drop.add}
                                                description={languageJSON.drop_location}
                                            >
                                                <Pin />
                                            </Marker>

                                            <MapView.Polyline
                                                coordinates={this.state.coords}
                                                strokeWidth={4}
                                                strokeColor={colors.BLUE.default}
                                            />

                                        </MapView>
                                    </View>

                                    <View style={styles.mapDetails}>
                                        <Text style={styles.listDate}>{item.tripdate ? item.tripdate : ''}</Text>
                                        <View style={styles.leftViewContainerStyle} >
                                            <Path border={4} />
                                            <View flex={1}>
                                                <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                                                <Text style={[styles.placeStyle]} numberOfLines={1} >{item.pickup.add ? item.pickup.add : ""}</Text>
                                                <View style={styles.separator} />
                                                <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                                                <Text style={[styles.placeStyle]} numberOfLines={1} >{item.drop.add ? item.drop.add : ""}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.placeStyle2]}>{languageJSON.montantNet}{item.estimate} {' ' + this.getCurrencySymbol(item.pickup.country)}</Text>
                                        <View style={styles.detailsBtnView}>

                                            <Button
                                                onPress={() => {
                                                    this.setModalVisible(true, item);
                                                }}
                                                title={languageJSON.ignore_text}
                                                titleStyle={styles.titleStyles}
                                                buttonStyle={styles.myButtonStyle}

                                            />
                                            <Button
                                                title={languageJSON.accept}
                                                titleStyle={styles.titleStyles}
                                                loading={this.state['loading' + index]}
                                                loadingProps={{ color: colors.TEXT_DARK }}
                                                onPress={() => {
                                                    this.onPressAccept(item, index)
                                                }}
                                                buttonStyle={[styles.myButtonStyle, { backgroundColor: colors.PRIMARY }]}

                                            />
                                        </View>
                                    </View>
                                </View>
                            )
                        }
                    }
                    }
                />

                < Modal
                    animationType="slide"
                    transparent={true}
                    visible={this.state.modalVisible}
                    onRequestClose={() => {
                        Alert.alert(languageJSON.modal_close);
                    }}>
                    <View style={styles.modalMain}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeading}>
                                <Text style={styles.alertStyle}>{languageJSON.alert_text}</Text>
                            </View>
                            <View style={styles.modalBody}>
                                <Text style={{ fontSize: 16 }}>{languageJSON.ignore_job_title}</Text>
                            </View>
                            <View style={styles.modalFooter}>
                                <TouchableHighlight
                                    style={[styles.btnStyle, styles.clickText]}
                                    onPress={() => {
                                        this.setModalVisible(!this.state.modalVisible, null)
                                    }}>
                                    <Text style={styles.cancelTextStyle}>{languageJSON.cancel}</Text>
                                </TouchableHighlight>
                                <TouchableHighlight
                                    style={styles.btnStyle}
                                    onPress={() => {
                                        this.onPressIgnore(this.state.modalData)
                                    }}>
                                    <Text style={styles.okStyle}>{languageJSON.ok}</Text>
                                </TouchableHighlight>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View >

        )
    }



}

//Screen Styling
const styles = StyleSheet.create({
    mainViewStyle: {
        flex: 1,
        //marginTop: StatusBar.currentHeight
    },
    headerStyle: {
        paddingHorizontal: 20,
        borderBottomWidth: 0,
    },
    headerTitleStyle: {
        color: colors.WHITE,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    mapcontainer: {
        flex: 1,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapDetails: {
        flex: 1,
        padding: 10
    },
    map: {

        ...StyleSheet.absoluteFill,
        overflow: 'hidden'
    },
    triangle: {
        width: 0,
        height: 0,
        backgroundColor: colors.TRANSPARENT,
        borderStyle: 'solid',
        borderLeftWidth: 9,
        borderRightWidth: 9,
        borderBottomWidth: 10,
        borderLeftColor: colors.TRANSPARENT,
        borderRightColor: colors.TRANSPARENT,
        borderBottomColor: colors.YELLOW.secondary,
        transform: [
            { rotate: '180deg' }
        ]
    },
    signInTextStyle: {
        fontFamily: 'Montserrat-Bold',
        color: colors.WHITE
    },
    listView: {
        flex: 1,
        margin: 10,
        borderRadius: 10,

    },
    listItemView: {
        backgroundColor: colors.ITEM,
        flex: 1,
        borderBottomColor: 'white',
        borderBottomWidth: 2
    },
    listDate: {
        fontSize: 10,
        fontFamily: "Montserrat-Light",
        color: colors.TEXT_LIGHT,
        textAlign: 'right'
    },
    detailsBtnView: {
        flex: 1,
        justifyContent: 'space-between',
        flexDirection: 'row',
    },

    modalPage: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalMain: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,.1)",
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContainer: {
        width: '80%',
        backgroundColor: colors.WHITE,
        borderRadius: 10,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 15,
        flex: 1,
        maxHeight: 180
    },
    modalHeading: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalBody: {
        flex: 2,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalFooter: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        borderTopColor: colors.GREY.iconPrimary,
        borderTopWidth: 1,
        width: '100%',
    },
    btnStyle: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fixAdressStyle: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    myButtonStyle: {
        flex: 1,
        backgroundColor: colors.SECONDARY,
        width: height / 6,
        height: 50,
        alignItems: "center",
        borderColor: colors.TRANSPARENT,
        borderWidth: 0,
        borderRadius: 5,
    },
    alertStyle: {
        fontWeight: 'bold',
        fontSize: 18,
        width: '100%',
        textAlign: 'center'
    },
    cancelTextStyle: {
        color: colors.BLUE.secondary,
        fontSize: 18,
        fontWeight: 'bold',
        width: "100%",
        textAlign: 'center'
    },
    okStyle: {
        color: colors.BLUE.secondary,
        fontSize: 18,
        fontWeight: 'bold'
    },
    viewFlex1: {
        flex: 1
    },
    clickText: {
        borderRightColor: colors.GREY.iconPrimary,
        borderRightWidth: 1
    },
    titleStyles: {
        fontFamily: "Montserrat-SemiBold",
        color: colors.BUTTON_TEXT,
        fontSize: 14,
        alignSelf: 'center'
    },
    //
    leftViewContainerStyle: {
        flexDirection: 'row',
        flex: 1,
        marginBottom: 15,
    },
    leftViewStyle: {
        alignItems: 'center',
        marginRight: 10,

    },
    leftLineStyle: {
        flex: 1,
        alignSelf: "center",
        borderWidth: 1,
        borderRadius: 1,
        borderColor: colors.SECONDARY,
        borderStyle: 'dashed',
        marginVertical: 1
    },
    holderText: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: 10,
        color: colors.HOLDER_TEXT,
        marginBottom: 8
    },
    placeStyle2: {
        marginBottom: 10,

        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,
        flex: 1,
    },
    placeStyle: {
        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,
        flex: 1,
    },
    separator: {
        marginVertical: 8,
        flex: 1,
        height: 1,
        backgroundColor: colors.SEPARATOR_LIGHT
    },
    noData: {
        height: height / 1.2,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 30
    },
    noDataText: {
        fontSize: 14,
        fontFamily: "Montserrat-Light",
        color: colors.TEXT,
        textAlign: 'center'
    },
    itemStyle: {
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: 15,
        borderBottomWidth: 2,
        borderColor: colors.WHITE
    },
    leftViewStyle: {
        alignItems: 'center',
        marginRight: 10
    },
    leftLineStyle: {
        flex: 1,
        alignSelf: "center",
        borderWidth: 1,
        borderRadius: 1,
        borderColor: colors.SECONDARY,
        borderStyle: 'dashed',
        marginVertical: 1
    },
    dateStyle: {
        fontSize: 12,
        fontFamily: 'Montserrat-Light',
        color: colors.TEXT
    },
    cancelImageStyle: {
        width: 50,
        height: 50,
        marginRight: 20,
        marginTop: 10,
        alignSelf: 'flex-end'
    },
    bookHeader: {
        flexDirection: 'row',
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 15
    },
    holderText: {
        flex: 1,
        fontFamily: "Montserrat-SemiBold",
        fontSize: 10,
        color: colors.HOLDER_TEXT,
        marginBottom: 8
    },
    placeStyle: {
        flex: 1,
        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,
    },
    separator: {
        marginVertical: 8,
        flex: 1,
        height: 1,
        backgroundColor: colors.SEPARATOR_LIGHT
    },
    locationStatus: {
        width: 12,
        height: 12,
        borderRadius: 12 / 2,
        backgroundColor: "#00df8f"
    },
    carText: {
        fontFamily: "Montserrat-Light",
        fontSize: 12,
        color: colors.TEXT_SEMI_DARKER,
    },
    tripProgressView: {
        paddingHorizontal: 15,
        paddingVertical: 15,
        backgroundColor: colors.ITEM,
        marginBottom: 15
    }
});