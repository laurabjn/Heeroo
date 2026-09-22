import React from 'react';
import { MAP_PROVIDER } from '../common/mapProvider';
import {
    StyleSheet,
    View,
    Text,
    TouchableWithoutFeedback,
    ImageBackground,
    ScrollView,
    Dimensions,
    Platform,
    SafeAreaView
} from 'react-native';
import Polyline from '@mapbox/polyline';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline as MapPolyline } from 'react-native-maps';
import { Header, Rating, Avatar, Button, Icon } from '@rneui/themed';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'firebase/compat/firestore';
import 'firebase/compat/database';;
import { colors, customMapStyle } from '../common/theme';
import { google_map_key } from '../common/key';
import languageJSON from '../common/language';
import { BackBtn, Path } from '../components';
import Car from '../icons/Car';
import Pin from '../icons/Pin';
var { width } = Dimensions.get('window');

export default class RideDetails extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            coords: [],
            intialregion: {},
            starCount: null,
            infoVisible: false,
            currency: {
                code: ' ',
                symbol: ' '
            },
        }
        this.getRideDetails = this.props.route.params.data
        this._retrieveCurrency();
    }

    _retrieveCurrency = async () => {
        firebase.database().ref('settings/').once('value', value => {
            if (value.val()) {

                let symbol = " €"
                let code = " EUR"
                let data = value

                data.forEach(element => {

                    if (this.props.route.params.data.pickup.country == element.country) {
                        symbol = " " + element.symbol
                        code = " " + element.code
                    }
                });
                this.setState({
                    currency: {
                        code: code,
                        symbol: symbol
                    },
                })

                /*
                console.log("firebase call error = ");
                console.log(error);
            }*/
            }
        })
    }

    componentDidMount() {
        if (this.getRideDetails) {
            this.setState({
                paramData: this.getRideDetails,
                intialregion: {
                    latitude: this.getRideDetails.pickup.lat,
                    longitude: this.getRideDetails.pickup.lng,
                    latitudeDelta: 0.9922,
                    longitudeDelta: 0.9421,
                },
                curUid: firebase.auth().currentUser.uid,
                payButtonShow: (this.getRideDetails.payment_status == 'DUE' || this.getRideDetails.payment_status == 'WAITING' || this.getRideDetails.payment_status == 'IN_PROGRESS' || this.getRideDetails.status == 'ACCEPTED') ? true : false
            }, () => {

                this.getDirections(this.state.paramData.pickup.lat + ',' + this.state.paramData.pickup.lng, this.state.paramData.drop.lat + ',' + this.state.paramData.drop.lng);
                this.forceUpdate();
            })
        }
    }


    // find your origin and destination point coordinates and pass it to our method.
    async getDirections() {
        let startLoc = this.state.paramData.pickup.lat + ',' + this.state.paramData.pickup.lng;
        let destinationLoc = this.state.paramData.drop.lat + ',' + this.state.paramData.drop.lng;
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
            this.mapRef.fitToCoordinates([{ latitude: this.state.paramData.pickup.lat, longitude: this.state.paramData.pickup.lng }, { latitude: this.state.paramData.drop.lat, longitude: this.state.paramData.drop.lng }], {
                edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                animated: true,
            })
            return coords
        }
        catch (error) {
            alert(error)
            return error
        }
    }

    //go back
    goBack() {
        this.props.navigation.goBack();
    }

    //tracking the ride
    trackNow(item) {
        if (item.status == 'START' || item.status == 'END' || item.status == 'NOT PAID' || item.status == "WAITING") {
            firebase.database().ref('bookings/' + item.bookingUid + '/').once('value', (snap) => {
                if (snap.val()) {
                    //AsyncStorage.getItem('startTime', (err, result) => {
                    //if(result){
                    let bookingData = snap.val()
                    bookingData.bookingId = item.bookingUid;
                    this.props.navigation.navigate('DriverTripComplete', { allDetails: bookingData, starttime:  /*parseInt(result)*/ bookingData.start_date })
                    //}    
                    //});
                }
            })

        } else if (item.status == 'ACCEPTED') {
            firebase.database().ref('bookings/' + item.bookingUid + '/').once('value', (snap) => {
                if (snap.val()) {
                    let bookingData = snap.val();
                    bookingData.bookingId = item.bookingUid;
                    this.props.navigation.navigate('DriverTripAccept', { screen: 'DriverTripStart', params: { allDetails: bookingData } })
                }
            })
        }
    }

    info = () => {
        if (this.state.infoVisible) {
            this.setState({ infoVisible: false })
        } else {
            this.setState({ infoVisible: true })
        }

    }

    render() {
        const condition = this.state.paramData && this.state.paramData.payment_status && (this.state.paramData.payment_status == "IN_PROGRESS" || this.state.paramData.payment_status == "PAID" || this.state.paramData.payment_status == "WAITING");

        const splited_name = this.state.paramData ? this.state.paramData.customer_name.split(" ") : "";

        const customer_name = splited_name[0] + " " + (splited_name[1] && splited_name[1].substring(0, 1)) + ".";

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
                <ScrollView>
                    <View style={styles.mapView}>
                        <View style={styles.mapcontainer}>
                            <MapView
                                ref={ref => this.mapRef = ref}
                                customMapStyle={customMapStyle}
                                style={styles.map}
                                provider={MAP_PROVIDER}
                                region={{
                                    latitude: (this.state.intialregion.latitude ? this.state.intialregion.latitude : 46),
                                    longitude: (this.state.intialregion.longitude ? this.state.intialregion.longitude : 2),
                                    latitudeDelta: 0.06,
                                    longitudeDelta: 0.06
                                }}
                            >
                                <Marker
                                    tracksViewChanges={false}
                                    coordinate={{ latitude: this.state.paramData ? (this.state.paramData.pickup.lat) : 0.00, longitude: this.state.paramData ? (this.state.paramData.pickup.lng) : 0.00 }}
                                    title={'pick-up location'}
                                    description={this.state.paramData ? this.state.paramData.pickup.add : null}
                                >
                                    <Car width={40} height={40} />
                                </Marker>

                                <Marker
                                    tracksViewChanges={false}
                                    coordinate={{ latitude: this.state.paramData ? (this.state.paramData.drop.lat) : 0.00, longitude: this.state.paramData ? (this.state.paramData.drop.lng) : 0.00 }}
                                    title={'drop location'}
                                    description={this.state.paramData ? this.state.paramData.drop.add : null}
                                >
                                    <Pin width={31} height={38} />
                                </Marker>

                                <MapPolyline
                                    coordinates={this.state.coords ? this.state.coords : { latitude: 0.00, longitude: 0.00 }}
                                    strokeWidth={4}
                                    strokeColor={colors.SECONDARY}
                                />

                            </MapView>
                        </View>
                    </View>
                    <View style={styles.rideDesc}>
                        <View style={styles.userDesc}>

                            {/* Driver Image */}
                            {this.state.paramData ?
                                this.state.paramData.driver_image != '' ?
                                    <Avatar
                                        size="medium"
                                        rounded
                                        source={{ uri: this.state.paramData.driver_image }}
                                        activeOpacity={0.7}
                                    />
                                    : this.state.paramData.driver_name != '' ?
                                        <Avatar
                                            size="medium"
                                            rounded
                                            source={require('../../assets/images/avatar.png')}
                                            activeOpacity={0.7}
                                        /> : null
                                : null}
                            <View style={styles.userView}>
                                <Text style={styles.personStyle}>{this.state.paramData ? customer_name : ""}</Text>
                            </View>
                            <View style={styles.priceView} >
                                <Text style={styles.textPrice}>{this.state.paramData && this.state.paramData.trip_cost > 0 ? parseFloat(this.state.paramData.trip_cost).toFixed(0) : this.state.paramData && this.state.paramData.estimate ? this.state.paramData.estimate : 0}
                                    {this.state.currency.symbol}</Text>
                            </View>
                        </View>

                        <View style={styles.leftViewContainerStyle} >
                            <Path border={4} />
                            <View flex={1} justifyContent="space-between" >
                                {condition && <Text style={[styles.holderText]}>{this.state.paramData ? new Date(this.state.paramData.trip_start_time).toLocaleString() : ""}</Text>}
                                <Text style={[styles.placeStyle]} numberOfLines={1}>{this.state.paramData ? this.state.paramData.pickup.add : ""}</Text>
                                <View style={styles.separator} />
                                {condition && <Text style={[styles.holderText]}>{this.state.paramData ? new Date(this.state.paramData.trip_end_time).toLocaleString() : ""}</Text>}
                                <Text style={[styles.placeStyle]} numberOfLines={1}>{this.state.paramData ? this.state.paramData.drop.add : ""}</Text>
                            </View>
                        </View>
                    </View>


                    {this.state.paramData && this.state.paramData.payment_status ? this.state.paramData.payment_status == "IN_PROGRESS" || this.state.paramData.payment_status == "PAID" || this.state.paramData.payment_status == "WAITING" ?
                        <View style={styles.billView}>
                            <Text style={styles.billTitle}>{languageJSON.bill_details}</Text>
                            <View style={styles.billOptions}>
                                <View style={styles.billItem}>
                                    <Text style={styles.billName}>{languageJSON.your_trip}</Text>
                                    <Text style={styles.billAmount}>{this.state.paramData ? parseFloat(this.state.paramData.trip_cost).toFixed(0) + this.state.currency.symbol : "0" + this.state.currency.symbol}</Text>
                                </View>
                                <View style={styles.billItem}>
                                    <View>
                                        <Text style={[styles.billName]}>{languageJSON.convenienceFee}</Text>
                                        <Text style={styles.taxColor}>{languageJSON.include_tax}</Text>
                                    </View>
                                    <Text style={styles.billAmount}>{this.state.paramData && this.state.paramData.convenience_fees ? '-' + parseFloat(this.state.paramData.convenience_fees).toFixed(0) + this.state.currency.symbol : "0" + this.state.currency.symbol}</Text>
                                </View>
                                <View style={[styles.billItem, styles.billItemComm]}>
                                    <Text style={[styles.commisionTitle]}>{languageJSON.total_payable}</Text>
                                    <Text style={[styles.commisionAmount]}>{this.state.paramData && this.state.paramData.driver_share ? parseFloat(this.state.paramData.driver_share).toFixed(0) + this.state.currency.symbol : "0" + this.state.currency.symbol}</Text>
                                </View>
                            </View>

                        </View>
                        : null : null}

                    <View style={styles.billView} >

                        {this.state.paramData && this.state.paramData.payment_status ? this.state.paramData.payment_status == "IN_PROGRESS" || this.state.paramData.payment_status == "PAID" || this.state.paramData.payment_status == "WAITING" ?
                            <View>

                                <Text style={styles.billTitle}>{languageJSON.payment_info}</Text>
                                <View style={styles.billOptions}>
                                    <View style={styles.billItem}>
                                        <Text style={styles.billName}>{languageJSON.paymentStatus}</Text>
                                        <Text style={styles.billAmount}>{this.state.paramData ? payment_status : ""}</Text>
                                    </View>
                                    <View style={styles.billItem}>
                                        <Text style={styles.billName}>{languageJSON.payment_mode}</Text>
                                        <Text style={styles.billAmount}>{this.state.paramData ? this.state.paramData.payment_mode : ""}</Text>
                                    </View>
                                    <View style={styles.billItem}>
                                        <View flexDirection='row' alignItems='center'>
                                            <Text style={[styles.billName]}>{languageJSON.customer_payable}</Text>
                                            <Icon
                                                name='info'
                                                type='Foundation'
                                                color={colors.YELLOW.primary}
                                                containerStyle={{ top: 2 }}
                                                onPress={this.info}
                                                size={20}
                                            />
                                        </View>
                                        <Text style={[styles.billAmount, { color: colors.PRIMARY }]}>{this.state.paramData && this.state.paramData.customer_paid ? this.state.paramData.customer_paid.toFixed(0) + this.state.currency.symbol : "0" + this.state.currency.symbol}</Text>
                                    </View>
                                    {this.state.infoVisible ?
                                        <View style={styles.billItem}>
                                            {this.state.paramData && this.state.paramData.cashPaymentAmount ?
                                                <Text style={styles.billName}>{languageJSON.CashPaymentAmount}  {this.state.paramData && this.state.paramData.cashPaymentAmount ? parseFloat(this.state.paramData.cashPaymentAmount).toFixed(0) + this.state.currency.symbol : "0" + this.state.currency.symbol}</Text> : null}
                                            {this.state.paramData && this.state.paramData.cardPaymentAmount ? <Text style={styles.billName}>{languageJSON.CardPaymentAmount}  {this.state.paramData && this.state.paramData.cardPaymentAmount ? parseFloat(this.state.paramData.cardPaymentAmount).toFixed(0) + this.state.currency.symbol : "0" + this.state.currency.symbol}</Text> : null}
                                            {this.state.paramData && this.state.paramData.usedWalletMoney ? <Text style={styles.billName}>{languageJSON.WalletPayment}       {this.state.paramData && this.state.paramData.usedWalletMoney ? parseFloat(this.state.paramData.usedWalletMoney).toFixed(0) + this.state.currency.symbol : "0" + this.state.currency.symbol}</Text> : null}
                                        </View> : null}
                                    <View style={[styles.billItem, styles.billItemComm]}>
                                        <Text style={styles.billName}>{languageJSON.discount_amount}</Text>
                                        <Text style={styles.billAmount}>{this.state.paramData && this.state.paramData.discount_amount ? parseFloat(this.state.paramData.discount_amount).toFixed(0) + this.state.currency.symbol : "0" + this.state.currency.symbol}</Text>
                                    </View>
                                </View>
                            </View>
                            : null : null}

                        {
                            this.state.payButtonShow ?
                                <Button
                                    title={languageJSON.go_to_booking}
                                    titleStyle={styles.btnText}
                                    onPress={() => {
                                        this.trackNow(this.state.paramData);
                                    }}
                                    buttonStyle={styles.myButtonStyle}
                                />
                                :
                                null
                        }

                    </View>
                </ScrollView>
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<BackBtn {...this.props} />}
                    containerStyle={styles.headerStyle}
                />
            </View>
        )
    }
}

//Screen Styling
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
        fontSize: 20,
        paddingRight: 4,
        paddingLeft: 4
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