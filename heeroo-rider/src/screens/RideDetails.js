import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableWithoutFeedback,
    ImageBackground,
    ScrollView,
    Dimensions,
    Platform,
    Linking,

} from 'react-native';
import Polyline from '@mapbox/polyline';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline as MapViewPolyline } from 'react-native-maps';
import { Header, Rating, Avatar, Button, Icon } from '@rneui/themed';
import { colors, customMapStyle } from '../common/theme';
var { width, height } = Dimensions.get('window');
import firebase from 'firebase/compat/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/firestore';
import { google_map_key } from '../common/key';
import languageJSON from '../common/language';
import { BackBtn, Path } from '../components';
import { Car, Pin } from '../icons';
import moment from "moment"
import countryCurrency from './../constants/countryCurrency.json'

export default class RideDetails extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            coords: [],
            intialregion: {},
            settings: {
                code: '',
                symbol: '',
                cash: false,
                wallet: false
            },
        }
    }

    _retrieveSettings = async () => {
        try {
            const value = await AsyncStorage.getItem('settings');
            if (value !== null) {
                this.setState({ settings: JSON.parse(value) });
            }
        } catch (error) {
            console.log("Asyncstorage issue 11");
        }
    };

    componentWillUnmount() {
        if (this.bookingRef) this.bookingRef.off();
    }

    componentDidMount() {
        let getRideDetails = this.props.route.params.data
        if (getRideDetails) {
            this.setState({
                intialregion: {
                    latitude: getRideDetails.pickup.lat,
                    longitude: getRideDetails.pickup.lng,
                    latitudeDelta: 0.91922,
                    longitudeDelta: 0.91922,
                },
                paramData: getRideDetails,
            }, () => {
                this.getDirections();
                this.forceUpdate();
            })
            // Suivi en temps réel : statut et paiement évoluent après l'ouverture de l'écran
            const bookingId = getRideDetails.bookingId || getRideDetails.bookingKey;
            if (bookingId) {
                this.bookingRef = firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/my-booking/' + bookingId);
                this.bookingRef.on('value', (snapshot) => {
                    const live = snapshot.val();
                    if (live) this.setState({ paramData: { ...this.state.paramData, ...live, bookingId } });
                });
            }
        }
        this._retrieveSettings();
    }

    // find your origin and destination point coordinates and pass it to our method.
    async getDirections() {
        let startLoc = this.state.paramData.pickup.lat + ',' + this.state.paramData.pickup.lng
        let destinationLoc = this.state.paramData.drop.lat + ',' + this.state.paramData.drop.lng
        try {
            let resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc}&destination=${destinationLoc}&key=${google_map_key}`)
            let respJson = await resp.json();
            if (!respJson.routes || !respJson.routes[0] || !respJson.routes[0].overview_polyline) { console.log('[Directions] pas de trajet :', respJson.status, respJson.error_message || ''); return; }
            let points = Polyline.decode(respJson.routes[0].overview_polyline.points);
            let coords = points.map((point, index) => {
                return {
                    latitude: point[0],
                    longitude: point[1]
                }
            })
            this.setState({ coords: coords });
            if (this.mapRef) {
                this.mapRef.fitToCoordinates([{ latitude: this.state.paramData.pickup.lat, longitude: this.state.paramData.pickup.lng }, { latitude: this.state.paramData.drop.lat, longitude: this.state.paramData.drop.lng }], {
                    edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                    animated: true,
                })
            }
            return coords
        }
        catch (error) {
            alert(error)
            return error
        }
    }


    //call driver button press
    onPressCall(phoneNumber) {
        Linking.canOpenURL(phoneNumber).then(supported => {
            if (!supported) {
                console.log('Can\'t handle Phone Number: ' + phoneNumber);
            } else {
                return Linking.openURL(phoneNumber);
            }
        }).catch(err => console.error('An error occurred', err));
    }
    //go back
    goBack() {
        this.props.navigation.goBack();
    }

    trackNow(data) {
        if (data.status == 'ACCEPTED') {
            let bookingData = {
                bokkingId: data.bookingId,
                coords: data.coords,
            }
            this.props.navigation.navigate('Map', { screen: 'BookedCab', params: { passData: bookingData } });
        } else if (data.status == 'START') {
            this.props.navigation.navigate('trackRide', { data: data, bId: data.bookingId });
        } else {
            console.log('track not posible')
        }
    }


    PayNow(data) {
        var curuser = firebase.auth().currentUser;
        this.setState({ currentUser: curuser }, () => {
            const userData = firebase.database().ref('users/' + this.state.currentUser.uid);
            userData.once('value', userData => {
                if (userData.val()) {
                    var udata = userData.val();
                    const bDataref = firebase.database().ref('users/' + this.state.currentUser.uid + '/my-booking/' + data.bookingId);
                    bDataref.once('value', bookingdetails => {
                        if (bookingdetails.val()) {
                            let bookingData = bookingdetails.val()
                            if (bookingData.payment_status == "WAITING") {
                                bookingData.bookingKey = data.bookingId;
                                bookingData.firstname = udata.firstName;
                                bookingData.lastname = udata.lastName;
                                bookingData.email = udata.email;
                                bookingData.phonenumber = udata.mobile;
                                this.props.navigation.navigate('CardDetails', { data: bookingData });
                            }
                        }
                    })
                }
            })
        })
    }

    render() {

        const condition = this.state.paramData && this.state.paramData.payment_status && (this.state.paramData.payment_status == "IN_PROGRESS" || this.state.paramData.payment_status == "PAID" || this.state.paramData.payment_status == "WAITING");
        const splited_name = this.state.paramData ? this.state.paramData.driver_name.split(" ") : "";
        const driver_name = splited_name[0] + " " + (splited_name[1] && splited_name[1].substring(0, 1)) + ".";
        let payment_status = this.state.paramData ? this.state.paramData.payment_status : "";
        switch (payment_status) {
            case "PAID":
                payment_status = "Payé"
                break;
            case "NOT PAID":
                payment_status = "Non payé"
                break;
            case "IN_PROGRESS":
                payment_status = "En cours"
                break;
            case "WAITING":
                payment_status = "En attente"
                break;
        }
        return (
            <View style={styles.mainView}>
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<BackBtn {...this.props} />}
                    containerStyle={styles.headerStyle}
                />
                <ScrollView>
                    <View style={styles.mapView}>
                        <View style={styles.mapcontainer}>
                            <MapView
                                ref={ref => this.mapRef = ref}
                                customMapStyle={customMapStyle}
                                style={styles.map}
                                provider={PROVIDER_GOOGLE}
                                region={{
                                    latitude: (this.state.intialregion.latitude ? this.state.intialregion.latitude : 22),
                                    longitude: (this.state.intialregion.longitude ? this.state.intialregion.longitude : 88),
                                    latitudeDelta: 0.91922,
                                    longitudeDelta: 1.91922
                                }}>
                                <Marker
                                    tracksViewChanges={false}
                                    coordinate={{ latitude: this.state.paramData ? (this.state.paramData.pickup.lat) : 0.00, longitude: this.state.paramData ? (this.state.paramData.pickup.lng) : 0.00 }}
                                    title={'marker_title_1'}
                                    description={this.state.paramData ? this.state.paramData.pickup.add : null}>
                                    <Pin height={40} width={30} color={colors.SECONDARY} />
                                </Marker>
                                <Marker
                                    tracksViewChanges={false}
                                    coordinate={{ latitude: this.state.paramData ? (this.state.paramData.drop.lat) : 0.00, longitude: this.state.paramData ? (this.state.paramData.drop.lng) : 0.00 }}
                                    title={'marker_title_2'}
                                    description={this.state.paramData ? this.state.paramData.drop.add : null}>
                                    <Pin height={40} width={30} />
                                </Marker>
                                <MapViewPolyline
                                    coordinates={this.state.coords ? this.state.coords : { latitude: 0.00, longitude: 0.00 }}
                                    strokeWidth={4}
                                    strokeColor={colors.SECONDARY}
                                />
                            </MapView>
                        </View>
                    </View>
                    <View style={styles.rideDesc}>

                        <View style={styles.userDesc}>

                            {this.state.paramData && this.state.paramData.driver_image != '' ?
                                <Avatar
                                    size="medium"
                                    rounded
                                    source={{ uri: this.state.paramData.driver_image }}
                                    activeOpacity={0.7}
                                />
                                :
                                <Avatar
                                    size="medium"
                                    rounded
                                    source={require('../../assets/images/avatar.png')}
                                    activeOpacity={0.7}
                                />
                            }
                            <View style={styles.userView}>
                                {this.state.paramData && this.state.paramData.driver_name != '' && <Text style={styles.personStyle}>{driver_name}</Text>}
                                {this.state.paramData && this.state.paramData.driverRating > 0 ?

                                    <View style={styles.personTextView}>
                                        {/*My rating to driver */}
                                        <Rating
                                            showRating
                                            type="star"
                                            fractions={3}
                                            startingValue={parseFloat(this.state.paramData.driverRating)}
                                            readonly
                                            imageSize={15}
                                            onFinishRating={this.ratingCompleted}
                                        // showRating={false}
                                        />
                                    </View>
                                    : null}
                            </View>
                            <View style={styles.priceView} >
                                <Text style={styles.textPrice}>{this.state.paramData && this.state.paramData.customer_paid ? parseFloat(this.state.paramData.customer_paid).toFixed(0) : this.state.paramData && this.state.paramData.estimate ? this.state.paramData.estimate : 0} {this.state.paramData && this.state.paramData.pickup.country ? countryCurrency[this.state.paramData.pickup.country] : ""}</Text>
                            </View>
                        </View>



                        <View style={styles.leftViewContainerStyle} >
                            {/*this.state.paramData && this.state.paramData.carType&&
                                    <View style={[styles.userDesc]}>  
                                        <Avatar
                                            size="medium"
                                            rounded
                                            source={ this.state.paramData.carImage?{uri:this.state.paramData.carImage}:require('../../assets/images/microBlackCar.png')}
                                            activeOpacity={0.7}
                                        />
                                        <View style={styles.userView}>
                                            <Text style={styles.carNoStyle}>{this.state.paramData.vehicle_number? this.state.paramData.vehicle_number:<Text>{languageJSON.car_no_not_found}</Text>}</Text>
                                            <Text style={styles.carNoStyleSubText}>{this.state.paramData.carType}</Text>
                                        </View>
                                    </View>
                                */}
                            <View flex={1} flexDirection='row'  >
                                <Path border={4} />
                                <View flex={1} justifyContent="space-between" >
                                    {condition && <Text style={[styles.holderText]}>{this.state.paramData ? moment(this.state.paramData.trip_start_time).format("HH[h]mm") : ""}</Text>}
                                    <Text style={[styles.placeStyle]} numberOfLines={1} >{this.state.paramData ? this.state.paramData.pickup.add : ""}</Text>
                                    <View style={styles.separator} />
                                    {condition && <Text style={[styles.holderText]}>{this.state.paramData ? moment(this.state.paramData.trip_end_time).format("HH[h]mm") : ""}</Text>}
                                    <Text style={[styles.placeStyle]} numberOfLines={1} >{this.state.paramData ? this.state.paramData.drop.add : ""}</Text>
                                </View>
                            </View>
                        </View>

                        {this.state.paramData && this.state.paramData.status == "ACCEPTED" &&
                            <Button
                                title={languageJSON.track_now_button}
                                titleStyle={styles.btnText}
                                buttonStyle={styles.myButtonStyle}
                                onPress={() => { this.trackNow(this.state.paramData) }}
                            />
                        }

                        {this.state.paramData && this.state.paramData.status == "START" &&
                            <Button
                                title={languageJSON.track_now_button}
                                onPress={() => { this.trackNow(this.state.paramData) }}
                                titleStyle={styles.btnText}
                                buttonStyle={styles.myButtonStyle}
                            />
                        }
                    </View>

                    {this.state.paramData && this.state.paramData.payment_status && (this.state.paramData.payment_status == "IN_PROGRESS" || this.state.paramData.payment_status == "PAID" || this.state.paramData.payment_status == "WAITING") &&
                        <View style={styles.billView}>
                            <Text style={styles.billTitle}>{languageJSON.bill_details_title}</Text>

                            <View style={styles.billOptions}>


                                {this.state.paramData && this.state.paramData.discount_amount > 0 && <View style={styles.billItem}>
                                    <View>
                                        <Text style={[styles.billName, styles.billText]}>{languageJSON.discount}</Text>
                                        <Text style={styles.taxColor}>{languageJSON.promo_apply}</Text>
                                    </View>
                                    <Text style={styles.discountAmount}>{this.state.paramData && this.state.paramData.discount_amount ? parseFloat(this.state.paramData.discount_amount).toFixed(0) : 0} {this.state.paramData && this.state.paramData.pickup.country ? countryCurrency[this.state.paramData.pickup.country] : ""}</Text>
                                </View>}

                                {this.state.paramData && this.state.paramData.cardPaymentAmount && this.state.paramData.cardPaymentAmount > 0 &&
                                    <View style={styles.billItem}>
                                        <Text style={styles.billName}>{languageJSON.CardPaymentAmount}</Text>
                                        <Text style={styles.billAmount}>{this.state.paramData && this.state.paramData.cardPaymentAmount ? parseFloat(this.state.paramData.cardPaymentAmount).toFixed(0) : 0} {this.state.paramData && this.state.paramData.pickup.country ? countryCurrency[this.state.paramData.pickup.country] : ""}</Text>
                                    </View>
                                }

                                {this.state.paramData && this.state.paramData.cashPaymentAmount && this.state.paramData.cashPaymentAmount > 0 &&
                                    <View style={styles.billItem}>
                                        <Text style={styles.billName}>{languageJSON.CashPaymentAmount}</Text>
                                        <Text style={styles.billAmount}>{this.state.paramData && this.state.paramData.cashPaymentAmount ? parseFloat(this.state.paramData.cashPaymentAmount).toFixed(0) : 0} {this.state.paramData && this.state.paramData.pickup.country ? countryCurrency[this.state.paramData.pickup.country] : ""}</Text>
                                    </View>
                                }



                                <View style={[styles.billItem, styles.billItemComm]}>
                                    <Text style={styles.billName}>{languageJSON.grand_total}</Text>
                                    <Text style={styles.billAmount}>{this.state.paramData && this.state.paramData.customer_paid ? parseFloat(this.state.paramData.customer_paid).toFixed(0) : null} {this.state.paramData && this.state.paramData.pickup.country ? countryCurrency[this.state.paramData.pickup.country] : ""}</Text>
                                </View>

                            </View>

                            <Text style={styles.billTitle}>{languageJSON.payment_status}</Text>
                            {this.state.paramData && this.state.paramData.payment_status &&
                                <View style={styles.billOptions}>
                                    <View style={styles.billItem}>
                                        <Text style={styles.billName}>{languageJSON.payment_status}</Text>
                                        <Text style={styles.billAmount}>{this.state.paramData.payment_status == "IN_PROGRESS" || this.state.paramData.payment_status == "WAITING" ? "Non payé" : (this.state.paramData.payment_status == "PAID" ? "Payé" : this.state.paramData.payment_status)}</Text>
                                    </View>

                                    <View style={[styles.billItem, styles.lastStatus]}>
                                        <Text style={styles.billName}>{languageJSON.pay_mode}</Text>
                                        <Text style={styles.billAmount}>{this.state.paramData.payment_mode ? this.state.paramData.payment_mode : null} {this.state.paramData.getway ? '(' + this.state.paramData.getway + ')' : null}</Text>
                                    </View>
                                </View>
                            }
                        </View>
                    }

                    {this.state.paramData && this.state.paramData.payment_status == 'WAITING' &&
                        <Button
                            title={languageJSON.paynow_button}
                            titleStyle={styles.btnText}
                            onPress={() => { this.PayNow(this.state.paramData) }}
                            buttonStyle={[styles.myButtonStyle, { marginHorizontal: 15, marginVertical: 30 }]}
                        />
                    }
                </ScrollView>
            </View>
        )
    }
}

const styles = StyleSheet.create({
    headerStyle: {
        position: 'absolute',
        top: 0,
        borderBottomWidth: 0,
        paddingHorizontal: 20,
        zIndex: 2
    },
    headerTitleStyle: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    containerView: {
        flex: 1
    },
    textContainer: {
        textAlign: "center"
    },
    gradient: {
        ...StyleSheet.absoluteFill,
        height: 100,
        zIndex: 1
    },
    mapView: {

        height: 280,
        marginBottom: 15
    },
    mapcontainer: {
        flex: 7,
        width: width,
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        flex: 1,
        ...StyleSheet.absoluteFill,
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
    rideDesc: {
        paddingHorizontal: 10
    },
    userDesc: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },
    userView: {
        flex: 1,
        marginLeft: 18
    },
    locationView: {

    },
    location: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 6
    },
    greenDot: {
        backgroundColor: colors.GREEN.default,
        width: 10,
        height: 10,
        borderRadius: 50,
        alignSelf: 'flex-start',
        marginTop: 5
    },
    redDot: {
        backgroundColor: colors.RED,
        width: 10,
        height: 10,
        borderRadius: 50,
        alignSelf: 'flex-start',
        marginTop: 5
    },
    address: {
        flexDirection: 'row',
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        width: 0,
        marginLeft: 6
    },
    billView: {
    },
    billTitle: {
        fontSize: 16,
        color: colors.TEXT_SEMI_DARKER,
        fontFamily: 'Montserrat-Bold',
        marginBottom: 20
    },
    billOptions: {

    },
    billItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: .7,
        borderColor: colors.SEPARATOR_LIGHT
    },
    billName: {
        fontSize: 12,
        fontFamily: 'Montserrat-Light',
        color: colors.TEXT_SEMI_DARKER
    },
    billAmount: {
        fontSize: 14,
        fontFamily: 'Montserrat-SemiBold',
        color: colors.TEXT
    },
    commisionTitle: {
        fontSize: 12,
        fontFamily: 'Montserrat-Light',
        color: colors.TEXT_SEMI_DARKER
    },
    commisionAmount: {
        fontSize: 14,
        fontFamily: 'Montserrat-SemiBold',
        color: colors.PRIMARY
    },
    payDetails: {
        fontSize: 16,
        fontFamily: 'Montserrat-Regular',
        color: colors.GREY.default,
        marginBottom: 6
    },
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: 2,
    },
    carNoStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Montserrat-Bold'
    },
    textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Montserrat-Bold'
    },
    mainView: {
        flex: 1,
        backgroundColor: colors.WHITE,
    },
    personStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_SEMI_DARKER,
        fontFamily: 'Montserrat-Light'
    },
    personTextView: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    ratingText: {
        fontSize: 14,
        color: colors.TEXT,
        marginRight: 8,
        fontFamily: 'Montserrat-Light'
    },
    avatarView: {
        marginVertical: 15
    },
    timeStyle: {
        fontFamily: 'Montserrat-Light',
        fontSize: 16,
        marginTop: 1
    },
    adressStyle: {
        marginLeft: 6,
        fontSize: 15,
        lineHeight: 20
    },
    billView: {
        paddingHorizontal: 14
    },
    taxColor: {
        fontSize: 9,
        color: colors.PRIMARY,
        marginRight: 8,
        fontFamily: 'Montserrat-Light'
    },
    iosView: {
        paddingVertical: 10
    },
    dashView: {
        width: width,
        height: .5
    },
    paymentTextView: {
        paddingHorizontal: 10
    },

    myButtonStyle: {
        height: 50,
        elevation: 0,
        backgroundColor: colors.PRIMARY,
        borderColor: colors.TRANSPARENT,
        borderWidth: 0,
        borderRadius: 10,
        marginBottom: 20
    },
    priceView: {
        backgroundColor: colors.PRIMARY,
        borderRadius: 5,
        paddingVertical: 10,
        paddingHorizontal: 5,
    },
    textPrice: {
        color: colors.WHITE,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    leftViewContainerStyle: {
        flexDirection: 'row',
        flex: 1,
        backgroundColor: colors.ITEM,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 5,
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
    placeStyle: {
        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,
    },
    separator: {
        marginVertical: 8,
        height: 1,
        backgroundColor: colors.SEPARATOR_LIGHT
    },
    billItemComm: {
        borderBottomWidth: 0,
        marginBottom: 20
    },
    btnText: {
        fontSize: 14,
        color: colors.BUTTON_TEXT,
        fontFamily: 'Montserrat-Bold',
    },
});