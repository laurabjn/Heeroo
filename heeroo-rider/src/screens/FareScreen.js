import React from 'react';
import {
    StyleSheet,
    View,
    Image,
    Dimensions,
    TouchableOpacity,
    Text,
    Modal,
    Platform,

    Alert,
    TouchableWithoutFeedback
} from 'react-native';
import { Icon, Button, Header } from '@rneui/themed';
import Polyline from '@mapbox/polyline';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline as MapViewPolyline } from 'react-native-maps';
import { colors, customMapStyle } from '../common/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import Geocoder from 'react-native-geocoding';
import { getDistance } from 'geolib';

import { farehelper } from '../common/FareCalculator';
import { PromoComp } from "../components";
import { RequestPushMsg } from '../common/RequestPushMsg';
import { google_map_key } from '../common/key';
import languageJSON from '../common/language';
import { Car, Pin } from '../icons';
import { DrawerToggle, NotificationBtn, CloseBtn } from '../components';

const { width, height } = Dimensions.get('window');
const size = height / 812;


export default class FareScreen extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            alertModalVisible: false,
            region: {
                latitude: 46,
                longitude: 2,
                latitudeDelta: 1,
                longitudeDelta: 1,
            },
            coords: [],
            modalVisible: false,
            country: this.props.route.params.country,
            promodalVisible: false,
            settings: {
                code: "",
                symbol: '',
                cash: false,
                wallet: false
            },
        }
    }

    _retrieveSettings(countryCode) {
        firebase.database().ref('settings/').once('value', value => {
            if (value.val()) {

                let symbol = " €"
                let code = " EUR"
                let data = value

                data.forEach(element => {

                    if (countryCode == element.country) {
                        symbol = " " + element.symbol
                        code = " " + element.code
                    }
                });
                this.setState({
                    settings:
                    {
                        code: code,
                        symbol: symbol,
                        cash: false,
                        wallet: false
                    },
                });

                /*
                console.log("firebase call error = ");
                console.log(error);
            }*/
            }
        })

    };


    componentDidMount() {

        var getCoords = this.props.route.params.data
        var carType = this.props.route.params.carType
        var carImage = this.props.route.params.carimage
        var country = this.props.route.params.country
        const Data = firebase.database().ref('rates/');
        this.setState({ wait: true });
        Data.once('value', rates => {
            if (rates.val()) {
                var carTypeWiseRate = rates.val();
                for (var i = 0; i < carTypeWiseRate.car_type.length; i++) {
                    if (carTypeWiseRate.car_type[i].name == carType && carTypeWiseRate.car_type[i].country == country) {
                        var rates = carTypeWiseRate.car_type[i];
                        this.setState({
                            region: getCoords,
                            curUID: firebase.auth().currentUser,
                            rateDetails: rates,
                            carType: carType,
                            carImage: carImage
                        }, () => {
                            this.getDirections(this.state.region.wherelatitude + ', ' + this.state.region.wherelongitude, this.state.region.droplatitude + ', ' + this.state.region.droplongitude)
                            const userData = firebase.database().ref('users/' + this.state.curUID.uid);
                            userData.once('value', userData => {
                                this.setState({ userDetails: userData.val() });
                                this.setState({ wait: false });
                            })
                        })
                    }
                }
            }
        })
        Geocoder.from(getCoords.droplatitude, getCoords.droplongitude)
            .then(json => {

                let isoCountryCode = null;

                json.results[0].address_components.forEach(element => {
                    if (element.types[0] == "country") {
                        isoCountryCode = element.short_name
                    }
                });
                this._retrieveSettings(isoCountryCode);

            })
            .catch((error) => {
                console.log('error')
                console.log(error)
            });

    }

    applyPromo() {
        this.setState({ promodalVisible: true, modalVisible: false, alertModalVisible: false })
    }

    promoModal() {

        return (
            <Modal
                animationType="none"
                // transparent={true}
                visible={this.state.promodalVisible}
                onRequestClose={() => {
                    this.setState({ promodalVisible: false })
                }}>
                <Header
                    backgroundColor={colors.GREY.default}
                    rightComponent={{ icon: 'close', type: 'ionicon', color: colors.WHITE, size: 45, component: TouchableWithoutFeedback, onPress: () => { this.setState({ promodalVisible: false }) } }}
                    centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.your_promo}</Text>}
                    containerStyle={styles.headerStyle}
                    innerContainerStyles={{ marginLeft: 10, marginRight: 10 }}
                />
                <PromoComp onPressButton={(item, index) => { this.SelectCopupon(item, index) }}></PromoComp>
            </Modal>
        )
    }

    // FOR ROOT DIRECTIONS
    async getDirections(startLoc, destLoc) {

        try {
            var resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc}&destination=${destLoc}&key=${google_map_key}`)
            var respJson = await resp.json();

            farehelper(respJson.routes[0].legs[0].distance.value, respJson.routes[0].legs[0].duration.value, this.state.rateDetails ? this.state.rateDetails : 1, this.state.country)
                .then((result) => {
                    let fareCalculation = result
                    this.setState({
                        distance: respJson.routes[0].legs[0].distance.value,
                        fareCost: fareCalculation ? parseFloat(fareCalculation.totalCost).toFixed(0) : 0,
                        estimateFare: fareCalculation ? parseFloat(fareCalculation.grandTotal).toFixed(0) : 0,
                        estimateTime: respJson.routes[0].legs[0].duration.value,
                        convenience_fees: fareCalculation ? parseFloat(fareCalculation.convenience_fees).toFixed(0) : 0
                    })



                    if (!respJson.routes || !respJson.routes[0] || !respJson.routes[0].overview_polyline) { console.log('[Directions] pas de trajet :', respJson.status, respJson.error_message || ''); return; }
                    var points = Polyline.decode(respJson.routes[0].overview_polyline.points);
                    var coords = points.map((point) => {
                        return {
                            latitude: point[0],
                            longitude: point[1]
                        }
                    })
                    this.setState({ coords: coords }, () => {
                        if (this.map && this.state.region.wherelatitude && this.state.region.droplatitude) {
                            this.map.fitToCoordinates([{ latitude: this.state.region.wherelatitude, longitude: this.state.region.wherelongitude }, { latitude: this.state.region.droplatitude, longitude: this.state.region.droplongitude }], {
                                edgePadding: { top: Platform.OS == "ios" ? 100 : 200, right: 40, bottom: Platform.OS == "ios" ? height / 2 : height / 1, left: 40 },
                                animated: true,
                            })
                        }
                    })
                    return coords
                })

        }
        catch (error) {
            console.log("error 12303")
            console.log(error)
            if (error == "TypeError: Cannot read property 'legs' of undefined") {
                Alert.alert(
                    languageJSON.err,
                    languageJSON.route_not_found,
                    [
                        { text: languageJSON.no_driver_found_alert_OK_button, onPress: () => this.props.navigation.goBack() },
                    ],
                    { cancelable: false },
                );
            } else {
                Alert.alert(
                    languageJSON.err,
                    languageJSON.route_not_found,
                    [
                        { text: languageJSON.no_driver_found_alert_OK_button, onPress: () => this.props.navigation.goBack() },
                    ],
                    { cancelable: false },
                );
            }

            return error
        }
    }

    // on press Ride later
    onPressCancel() {
        this.props.navigation.goBack();
    }


    alertModal() {
        return (
            <Modal
                animationType="none"
                transparent={true}
                visible={this.state.alertModalVisible}
                onRequestClose={() => {
                    this.setState({ alertModalVisible: false })
                }}>
                <View style={styles.modalContainer}>
                    <View style={styles.alertModalInnerContainer}>

                        <View style={styles.alertContainer}>

                            <Text style={styles.rideCancelText}>{languageJSON.sorry}</Text>

                            <View style={styles.horizontalLLine} />

                            <View style={styles.msgContainer}>
                                <Text style={styles.cancelMsgText}>{languageJSON.multipleBooking}</Text>
                            </View>
                            <View style={styles.okButtonContainer}>
                                <Button
                                    title={languageJSON.no_driver_found_alert_OK_button}
                                    titleStyle={styles.signInTextStyle}
                                    onPress={() => { this.setState({ alertModalVisible: false }, () => { this.props.navigation.popToTop() }) }}
                                    buttonStyle={styles.okButtonStyle}
                                    containerStyle={styles.okButtonContainerStyle}
                                />
                            </View>

                        </View>

                    </View>
                </View>

            </Modal>
        )
    }

    //CONFRIM BOOKING
    bookNow = () => {
        var curuser = firebase.auth().currentUser.uid;
        const userData = firebase.database().ref('users/' + curuser + '/my-booking');
        userData.once('value', userBooking => {
            this.setState({ loading: true });
            if (userBooking.val()) {
                let userBookings = userBooking.val();
                let flag = true;
                if (flag == true) {
                    //this.setState({ modalVisible: false })

                    var pickUp = { lat: this.state.region.wherelatitude, lng: this.state.region.wherelongitude, add: this.state.region.whereText, country: this.state.country };
                    var drop = { lat: this.state.region.droplatitude, lng: this.state.region.droplongitude, add: this.state.region.droptext };
                    var otp = Math.floor(Math.random() * 90000) + 10000;
                    var data = {
                        carImage: this.state.carImage,
                        carType: this.state.carType,
                        customer: curuser,
                        customer_name: this.state.userDetails.firstName + ' ' + this.state.userDetails.lastName,
                        customer_contact: this.state.userDetails.mobile,
                        distance: this.state.distance,
                        driver: "",
                        driver_image: "",
                        driver_name: "",
                        drop: drop,
                        pickup: pickUp,
                        estimate: this.state.estimateFare,
                        estimateDistance: this.state.distance,
                        serviceType: 'pickUp',
                        status: "NEW",
                        total_trip_time: 0,
                        trip_cost: 0,
                        trip_end_time: firebase.database.ServerValue.TIMESTAMP,
                        trip_start_time: firebase.database.ServerValue.TIMESTAMP,
                        tripdate: firebase.database.ServerValue.TIMESTAMP,
                        estimate: this.state.estimateFare,
                        otp: otp,
                    }

                    var MyBooking = {
                        carType: this.state.carType,
                        carImage: this.state.carImage,
                        driver: "",
                        driver_image: "",
                        driver_name: "",
                        drop: drop,
                        pickup: pickUp,
                        estimate: this.state.estimateFare,
                        estimateDistance: this.state.distance,
                        serviceType: 'pickUp',
                        status: "NEW",
                        total_trip_time: 0,
                        trip_cost: 0,
                        trip_end_time: firebase.database.ServerValue.TIMESTAMP,
                        trip_start_time: firebase.database.ServerValue.TIMESTAMP,
                        tripdate: firebase.database.ServerValue.TIMESTAMP,
                        estimate: this.state.estimateFare,
                        coords: this.state.coords,
                        otp: otp,
                        customer_first_name: this.state.userDetails.firstName
                    }

                    if (data) {
                        firebase.database().ref('bookings/').push(data).then((res) => {
                            var bookingKey = res.key;
                            firebase.database().ref('users/' + curuser + '/my-booking/' + bookingKey + '/').set(MyBooking).then((res) => {
                                this.setState({ currentBookingId: bookingKey })
                                // finding driver
                                var arr = [];
                                const userData = firebase.database().ref('users/');
                                userData.once('value', driverData => {
                                    if (driverData) {
                                        var allUsers = driverData;
                                        let that = this;
                                        allUsers.forEach(function (gottenUser) {
                                            //checking if user is driver and it's a approved user and he/she is now free for take ride
                                            if (gottenUser.val().usertype == 'driver' && gottenUser.val().approved == true && gottenUser.val().queue == false && gottenUser.val().driverActiveStatus == true) {
                                                if (gottenUser.val().location) {
                                                    var location1 = [that.state.region.wherelatitude, that.state.region.wherelongitude];// rider lat and lng
                                                    var location2 = [gottenUser.val().location.lat, gottenUser.val().location.lng];//Driver lat and lang
                                                    //calculate the distance of two locations
                                                    var distance = getDistance(location1, location2);
                                                    var originalDistance = (distance);

                                                    if (originalDistance <= 10000) { // Request will be send if distance less than 10 km 
                                                        if (gottenUser.val().carType == that.state.carType) {
                                                            arr.push(gottenUser.key);
                                                            firebase.database().ref('users/' + gottenUser.key + '/waiting_riders_list/' + bookingKey + '/').set(data);
                                                            that.sendPushNotification(gottenUser.key, bookingKey, languageJSON.new_booking_request_push_notification)
                                                        }
                                                    }
                                                }
                                            }
                                        })

                                        let bookingData = {
                                            bokkingId: bookingKey,
                                            coords: this.state.coords,
                                        }

                                        if (arr.length > 0) {
                                            // set all requested drivers data to main booking node
                                            firebase.database().ref('bookings/' + bookingKey + '/').update({
                                                requestedDriver: arr
                                            }).then((res) => {
                                                this.setState({ loading: false })
                                                this.props.navigation.navigate('BookedCab', { passData: bookingData });
                                            })
                                        } else {
                                            alert(languageJSON.driver_not_found);
                                            this.setState({ loading: false })
                                        }
                                    }
                                })
                            })
                        })
                    }


                }

            } else {
                this.setState({ modalVisible: false, alertModalVisible: false })

                pickUp = { lat: this.state.region.wherelatitude, lng: this.state.region.wherelongitude, add: this.state.region.whereText, country: this.state.country };
                drop = { lat: this.state.region.droplatitude, lng: this.state.region.droplongitude, add: this.state.region.droptext };
                var otp = Math.floor(Math.random() * 90000) + 10000;
                //data set for driver booking node 
                var data = {
                    carType: this.state.carType,
                    carImage: this.state.carImage,
                    customer: curuser,
                    customer_name: this.state.userDetails.firstName + ' ' + this.state.userDetails.lastName,
                    customer_contact: this.state.userDetails.mobile,
                    distance: this.state.distance,
                    driver: "",
                    driver_image: "",
                    driver_name: "",
                    drop: drop,
                    pickup: pickUp,
                    estimate: this.state.estimateFare,
                    estimateDistance: this.state.distance,
                    serviceType: 'pickUp',
                    status: "NEW",
                    total_trip_time: 0,
                    trip_cost: 0,
                    trip_end_time: firebase.database.ServerValue.TIMESTAMP,
                    trip_start_time: firebase.database.ServerValue.TIMESTAMP,
                    tripdate: firebase.database.ServerValue.TIMESTAMP,
                    estimate: this.state.estimateFare,
                    otp: otp,
                }
                //data set for my booking node 
                var MyBooking = {
                    carType: this.state.carType,
                    carImage: this.state.carImage,
                    driver: "",
                    driver_image: "",
                    driver_name: "",
                    drop: drop,
                    pickup: pickUp,
                    estimate: this.state.estimateFare,
                    estimateDistance: this.state.distance,
                    serviceType: 'pickUp',
                    status: "NEW",
                    total_trip_time: 0,
                    trip_cost: 0,
                    trip_end_time: firebase.database.ServerValue.TIMESTAMP,
                    trip_start_time: firebase.database.ServerValue.TIMESTAMP,
                    tripdate: firebase.database.ServerValue.TIMESTAMP,
                    estimate: this.state.estimateFare,
                    coords: this.state.coords,
                    otp: otp,
                    customer_first_name: this.state.userDetails.firstName
                }

                if (data) {
                    firebase.database().ref('bookings/').push(data).then((res) => {
                        var bookingKey = res.key;
                        firebase.database().ref('users/' + curuser + '/my-booking/' + bookingKey + '/').set(MyBooking).then((res) => {
                            this.setState({ currentBookingId: bookingKey })
                            // finding driver
                            var arr = [];
                            let that = this;
                            const userData = firebase.database().ref('users/');
                            userData.once('value', driverData => {
                                if (driverData) {
                                    var allUsers = driverData;
                                    allUsers.forEach(function (gottenUser) {
                                        //checking if user is driver and it's a approved user and he/she is now free for take ride
                                        if (gottenUser.val().usertype == 'driver' && gottenUser.val().approved == true && gottenUser.val().queue == false && gottenUser.val().driverActiveStatus == true) {
                                            if (gottenUser.val().location) {
                                                var location1 = [that.state.region.wherelatitude, that.state.region.wherelongitude]; // rider lat and lng
                                                var location2 = [gottenUser.val().location.lat, gottenUser.val().location.lng]; // driver lat and lng
                                                var distance = getDistance(location1, location2) / 1000;
                                                var originalDistance = (distance);

                                                if (originalDistance < 10) {// Request will be send if distance less than 10 km 
                                                    if (gottenUser.val().carType == that.state.carType) {
                                                        arr.push(gottenUser.key);
                                                        firebase.database().ref('users/' + gottenUser.key + '/waiting_riders_list/' + bookingKey + '/').set(data); //send request to driver who are available
                                                        that.sendPushNotification(gottenUser.key, bookingKey, languageJSON.new_booking_request_push_notification)
                                                    }
                                                }
                                            }
                                        }
                                    })
                                    let bookingData = {
                                        bokkingId: bookingKey,
                                        coords: this.state.coords,
                                    }
                                    if (arr.length > 0) {
                                        // set all requested drivers data to main booking node
                                        firebase.database().ref('bookings/' + bookingKey + '/').update({
                                            requestedDriver: arr
                                        }).then((res) => {
                                            this.setState({ loading: false })
                                            this.props.navigation.navigate('BookedCab', { passData: bookingData });
                                        })
                                    } else {
                                        this.setState({ loading: false })
                                        this.props.navigation.navigate('BookedCab', { passData: bookingData });
                                    }
                                }
                            })
                        })
                    })
                }

            }
        })
    }

    // Add promo user details to promo node
    addDetailsToPromo(offerkey, curUId) {
        const promoData = firebase.database().ref('offers/' + offerkey);
        promoData.once('value', promo => {
            if (promo.val()) {
                let promoData = promo.val();
                let user_avail = promoData.user_avail;
                if (user_avail) {

                    firebase.database().ref('offers/' + offerkey + '/user_avail/details').push({
                        userId: curUId
                    }).then(() => {
                        firebase.database().ref('offers/' + offerkey + '/user_avail/').update({ count: user_avail.count + 1 })
                    })
                } else {
                    //
                    firebase.database().ref('offers/' + offerkey + '/user_avail/details').push({
                        userId: curUId
                    }).then(() => {
                        firebase.database().ref('offers/' + offerkey + '/user_avail/').update({ count: 1 })
                    })
                }
            }
        })
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

    //confirm booking modal With fare details
    confirmBookModal() {
        return (
            <Modal
                transparent={true}
                visible={this.state.modalVisible}
                onRequestClose={() => {
                    this.setState({ modalVisible: false })
                }}>
                <View style={styles.modalContainer}>
                    <Header
                        backgroundColor={"transparent"}
                        leftComponent={<CloseBtn onPress={() => this.setState({ modalVisible: false })} />}
                        centerComponent={<Text style={styles.fareText}>{languageJSON.fare_details}</Text>}
                        containerStyle={styles.headerStyle} />

                    <View style={styles.modalInnerContainer}>
                        <View style={styles.priceItem}>
                            <Text style={styles.captionText}>{languageJSON.base_fare}</Text>
                            <Text style={styles.priceText}>{this.state.settings.symbol} {this.state.fareCost} </Text>
                        </View>
                        <View style={styles.priceItem}>
                            <Text style={styles.captionText}>{languageJSON.convenience_free}</Text>
                            <Text style={styles.priceText}>{this.state.settings.symbol} {this.state.convenience_fees ? this.state.convenience_fees : 0} </Text>
                        </View>
                        <View style={styles.totalPriceItem}>
                            <View>
                                <Text style={styles.totalPriceCaption}>{languageJSON.total_fare}</Text>
                                <Text style={styles.taxText}>{languageJSON.inclusive_tax} </Text>
                            </View>
                            {this.state.userDetails ?
                                <Text style={styles.totalPrice}>{this.state.settings.symbol}{this.state.estimateFare}</Text>
                                : null}
                        </View>
                        <View style={styles.termsView}>
                            <Text style={styles.termsText}> {languageJSON.nb}</Text>
                        </View>
                        <Button
                            title={languageJSON.done}
                            loading={this.state.loading}
                            onPress={this.bookNow}
                            titleStyle={styles.buttonText}
                            buttonStyle={styles.confirmButtonStyle}
                        />
                    </View>
                </View>
            </Modal>
        )
    }

    render() {
        return (
            <View style={styles.container}>

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
                    initialRegion={{
                        latitude: (this.state.region.wherelatitude ? this.state.region.wherelatitude : 46),
                        longitude: (this.state.region.wherelongitude ? this.state.region.wherelongitude : 2),
                        latitudeDelta: 4,
                        longitudeDelta: 4
                    }}>
                    <Marker
                        tracksViewChanges={false}
                        coordinate={{ latitude: this.state.region.wherelatitude ? (this.state.region.wherelatitude) : 0.00, longitude: this.state.region.wherelongitude ? (this.state.region.wherelongitude) : 0.00 }}
                        title={this.state.region.whereText}>
                        <Pin height={40} width={30} color={colors.SECONDARY} />
                    </Marker>
                    <Marker
                        tracksViewChanges={false}
                        coordinate={{ latitude: this.state.region.droplatitude ? (this.state.region.droplatitude) : 0.00, longitude: this.state.region.droplongitude ? (this.state.region.droplongitude) : 0.00 }}
                        title={this.state.region.droptext}>
                        <Pin height={40} width={30} />
                    </Marker>
                    <MapViewPolyline
                        coordinates={this.state.coords ? this.state.coords : { latitude: 0.00, longitude: 0.00 }}
                        strokeWidth={4}
                        strokeColor={colors.SECONDARY}
                    />
                </MapView>

                <View style={[styles.carsView, , Platform.OS != "ios" && { backgroundColor: "rgba(255, 255, 255, .95)" }]}>
                    <View style={styles.priceView} >

                        <View style={styles.priceItem}>
                            <Text style={styles.priceText}>{languageJSON.base_fare}</Text>
                            <Text style={[styles.priceText, { color: colors.TEXT }]}>{this.state.fareCost ? ' ' + this.state.fareCost : ' '}{this.state.settings.symbol}</Text>
                        </View>

                        <View style={styles.priceItem}>
                            <Text style={styles.priceText}>{languageJSON.convenience_free}</Text>
                            <Text style={[styles.priceText, { color: colors.TEXT }]}>{this.state.convenience_fees ? ' ' + this.state.convenience_fees : ' '}{this.state.settings.symbol}</Text>
                        </View>

                        <View style={styles.priceItem}>
                            <Text style={styles.priceText}>{languageJSON.Commissionprovisoire}</Text>
                            <Text style={[styles.priceText, { color: colors.TEXT_DARK }]}>{this.state.estimateFare ? ' ' + this.state.estimateFare : ' '}{this.state.settings.symbol}</Text>
                        </View>
                        <View style={styles.priceItem}>
                            <Text style={[styles.priceText]}>{languageJSON.payment}</Text>
                            <Text style={[styles.priceText, { color: colors.TEXT_DARK }]}>{languageJSON.paymentCash}</Text>
                        </View>

                    </View>
                    <View style={[styles.locationsViewContainer]} >
                        <View style={[styles.locationsView]} >
                            <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                            <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.region.whereText}</Text>
                        </View>
                        <View style={styles.separator} />
                        <View style={[styles.locationsView]} >
                            <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                            <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.region.droptext}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => { this.onPressCancel() }}
                        style={styles.cancelButton} >
                        <Icon
                            name='cancel'
                            type='material-community-icon'
                            color={colors.TEXT_DARK}
                            size={30}
                        />
                        <Text style={[styles.cancelButtonText]}>{languageJSON.Annulerlacourse}</Text>
                    </TouchableOpacity>
                    <Button
                        title={languageJSON.confrim_booking}
                        titleStyle={styles.buttonText}
                        loading={this.state.loading}
                        loadingProps={{ color: colors.WHITE }}
                        onPress={this.bookNow}
                        buttonStyle={styles.confirmButtonStyle}
                        disabled={this.state.wait}
                    />
                </View>


                {
                    this.confirmBookModal()
                }
                {
                    this.promoModal()
                }

                {
                    this.alertModal()
                }
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingBottom: 20
    },
    headerStyle: {
        zIndex: 2,
        paddingHorizontal: 0,
        borderBottomWidth: 0,
        marginBottom: 30
    },
    headerGradient: {
        zIndex: 1,
        ...StyleSheet.absoluteFill,
        height: 100
    },
    map: {
        flex: 1,
        ...StyleSheet.absoluteFill,
    },
    carsView: {
        borderRadius: size * 15,
        backgroundColor: Platform.OS == 'android' ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.95)",
        shadowColor: "rgba(0, 0, 0, 0.16)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 14,
        shadowOpacity: 1,
        paddingHorizontal: size * 10
    },
    blurView: {
        ...StyleSheet.absoluteFill,
        borderRadius: size * 15,
    },
    priceView: {
        paddingHorizontal: size * 10,
        paddingTop: size * 12,
        paddingBottom: size * 6,
        borderBottomWidth: 1,
        borderColor: colors.SEPARATOR_LIGHT
    },
    priceText: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: size * 10,
        color: colors.HOLDER_TEXT,
    },
    locationsViewContainer: {
        padding: size * 10,
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: colors.SEPARATOR_LIGHT,
        marginBottom: size * 30
    },
    locationsView: {
        flex: 1,
    },
    leftViewStyle: {
        alignItems: 'center',
        marginRight: size * 10
    },
    leftLineStyle: {
        flex: 1,
        alignSelf: "center",
        borderWidth: 1,
        borderRadius: 1,
        borderColor: "#1b3443",
        borderStyle: 'dashed',
        marginVertical: 1
    },
    holderText: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: size * 10,
        color: colors.HOLDER_TEXT,
        marginBottom: size * 8
    },
    placeStyle: {
        fontFamily: "Montserrat-Light",
        fontSize: size * 14,
        color: colors.TEXT_SEMI_DARKER,
    },
    separator: {
        width: 1,
        marginHorizontal: size * 15,
        backgroundColor: colors.SEPARATOR_LIGHT
    },
    cancelButton: {
        alignItems: "center",
        justifyContent: 'center',
        height: size * 50,
        marginBottom: size * 16
    },
    cancelButtonText: {
        fontFamily: "Montserrat-Regular",
        fontSize: size * 12,
        color: colors.TEXT,
    },
    buttonText: {
        fontFamily: "Montserrat-Bold",
        fontSize: size * 14,
        color: colors.BUTTON_TEXT,
    },
    confirmButtonStyle: {
        height: size * 50,
        backgroundColor: colors.PRIMARY,
        borderRadius: size * 10,
        marginBottom: size * 15
    },
    //
    modalContainer: {
        flex: 1,
        zIndex: 10,
        backgroundColor: "white",

        paddingHorizontal: size * 20,
        paddingBottom: size * 20

    },
    modalInnerContainer: {
        flex: 1,
        justifyContent: "flex-end",
    },
    fareText: {
        fontFamily: "Montserrat-Bold",
        fontSize: size * 20,
        color: colors.TEXT
    },
    priceItem: {
        flexDirection: 'row',
        paddingVertical: size * 5,
        justifyContent: 'space-between',
    },
    captionText: {
        fontFamily: "Montserrat-Regular",
        fontSize: size * 12,
        color: colors.HOLDER_TEXT
    },
    totalPriceCaption: {
        fontFamily: "Montserrat-Regular",
        fontSize: size * 18,
        color: colors.HOLDER_TEXT
    },
    taxText: {
        fontFamily: "Montserrat-Regular",
        fontSize: size * 9,
        color: colors.HOLDER_TEXT
    },
    totalPrice: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: size * 20,
        color: colors.TEXT_LIGHT
    },
    totalPriceItem: {
        paddingVertical: size * 25,
        flexDirection: 'row',
        justifyContent: "space-between",
    },
    termsView: {
        backgroundColor: colors.ITEM,
        borderRadius: size * 5,
        padding: size * 10,
        marginBottom: size * 40
    },
    termsText: {
        fontFamily: "Montserrat-Light",
        fontSize: size * 12,
        color: colors.TEXT_LIGHT
    },
});


