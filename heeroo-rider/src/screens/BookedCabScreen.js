import React from 'react';
import {
    StyleSheet,
    View,
    Image,
    Dimensions,
    TouchableOpacity,
    Text,
    Platform,
    Modal,
    TouchableWithoutFeedback,
    StatusBar,
    Linking,
    Alert,

    ActivityIndicator
} from 'react-native';
import { Icon, Button, Header } from '@rneui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Polyline from '@mapbox/polyline';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline as MapViewPolyline } from 'react-native-maps';
import StarRating from '../components/StarRating';
import RadioForm from 'react-native-simple-radio-button';
import { colors, customMapStyle } from '../common/theme';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import emptyStar from '../../assets/images/emptyStar.png'
import fullStar from '../../assets/images/fullStar.png'

var { width, height } = Dimensions.get('window');
import { RequestPushMsg } from '../common/RequestPushMsg';
import { google_map_key } from '../common/key';
import languageJSON from '../common/language';
import { TrackNow, DrawerToggle, NotificationBtn } from '../components';
import { Car, Pin } from '../icons';
const size = height / 812;

export default class BookedCabScreen extends React.Component {
    getParamData;
    constructor(props) {
        super(props);
        this.state = {
            region: {},
            starCount: 5,
            modalVisible: false,
            alertModalVisible: false,
            coords: [

            ],
            radio_props: [],
            value: 0,
            driverSerach: true,
            mapReady: false
        }
    }

    componentDidMount() {
        this.getParamData = this.props.route.params.passData
        var curuser = firebase.auth().currentUser;
        let bookingResponse = firebase.database().ref(`users/` + curuser.uid + '/my-booking/' + this.getParamData.bokkingId);
        bookingResponse.on('value', currUserBookings => {
            if (currUserBookings.val()) {
                let region = {
                    wherelatitude: currUserBookings.val().pickup.lat,
                    wherelongitude: currUserBookings.val().pickup.lng,
                    droplatitude: currUserBookings.val().drop.lat,
                    droplongitude: currUserBookings.val().drop.lng,
                    whereText: currUserBookings.val().pickup.add,
                    droptext: currUserBookings.val().drop.add
                }
                this.setState({
                    coords: this.getParamData.coords,
                    region: region,
                    distance: currUserBookings.val().estimateDistance,
                    estimateFare: this.getParamData.estimate,
                    estimateTime: 0,
                    currentBookingId: this.getParamData.bokkingId,
                    currentUser: curuser,
                    bookingStatus: currUserBookings.val().status,
                    carType: currUserBookings.val().carType,
                    driverUID: currUserBookings.val().driver,
                    driverName: currUserBookings.val().driver_name,
                    driverPic: currUserBookings.val().driver_image,

                    driverContact: currUserBookings.val().driver_contact,
                    carModel: currUserBookings.val().vehicleModelName,
                    carNo: currUserBookings.val().vehicle_number,
                    starCount: currUserBookings.val().driverRating,
                    otp: currUserBookings.val().otp
                }, () => {
                    this.getCancelReasons();
                    this.getDirections(this.state.region.wherelatitude + ', ' + this.state.region.wherelongitude, this.state.region.droplatitude + ', ' + this.state.region.droplongitude)
                })

                // Checking for booking status
                if (currUserBookings.val().status == "ACCEPTED") {
                    this.setState({
                        bookingStatus: currUserBookings.val().status,
                        driverSerach: false
                    })
                } else if (currUserBookings.val().status == "START") {
                    this.props.navigation.navigate('trackRide', { data: currUserBookings.val(), bId: this.getParamData.bokkingId });
                } else if (currUserBookings.val().status == "CANCELLED") {
                    this.props.navigation.navigate('Map');
                }
            }
        })

    }


    getCancelReasons() {
        const reasonListPath = firebase.database().ref('/cancel_reason/');
        reasonListPath.on('value', reasons => {
            if (reasons.val()) {
                this.setState({
                    radio_props: reasons.val()
                })
            }
        })
    }

    // find your origin and destination point coordinates and pass it to our method.
    async getDirections(startLoc, destinationLoc) {
        try {
            let resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc}&destination=${destinationLoc}&key=${google_map_key}`)
            let respJson = await resp.json();
            if (respJson.routes.length > 0) {
                var points = Polyline.decode(respJson.routes[0].overview_polyline.points);
                var coords = points.map((point) => {
                    return {
                        latitude: point[0],
                        longitude: point[1]
                    }
                })
                this.setState({ coords: coords })
            }
        }
        catch (error) {
            alert(error)
            return error
        }
    }
    //Cancel button press
    onPressCancel(param) {

        this.setState({
            modalVisible: true,
            driverSerach: false
        }, () => {
            // this.props.navigation.goBack()
        }
        );
    }
    dissMissCancel() {
        if (this.state.bookingStatus == "NEW") {
            this.setState({ modalVisible: false, driverSerach: true })
        } else {
            this.setState({ modalVisible: false })
        }
    }

    //cancel modal ok button press
    onCancelConfirm = () => {
        this.setState({ modalVisible: false });
        firebase.database().ref(`/users/` + this.state.currentUser.uid + '/my-booking/' + this.state.currentBookingId + '/').update({
            status: 'CANCELLED',
            reason: this.state.radio_props[this.state.value].label

        }).then(() => {
            //remove booking request from requested driver
            const requestedDriver = firebase.database().ref('bookings/' + this.state.currentBookingId + '/requestedDriver');
            requestedDriver.once('value', drivers => {
                if (drivers.val()) {
                    let requetedDrivers = drivers.val();
                    let count = 0;
                    for (i = 0; i < requetedDrivers.length; i++) {
                        firebase.database().ref(`/users/` + requetedDrivers[i] + '/waiting_riders_list/' + this.state.currentBookingId + '/').remove();
                        count = count + 1;
                    }
                    if (count == requetedDrivers.length) {
                        firebase.database().ref('bookings/' + this.state.currentBookingId + '/requestedDriver/').remove();
                    }
                }
            })
            // update status for main booking node
            firebase.database().ref(`bookings/` + this.state.currentBookingId + '/').update({
                status: 'CANCELLED',
                reason: this.state.radio_props[this.state.value].label
            }).then(() => {
                // It will work if driver accept the rides
                firebase.database().ref(`/users/` + this.state.driverUID + '/my_bookings/' + this.state.currentBookingId + '/').on('value', curbookingData => {
                    if (curbookingData.val()) {
                        if (curbookingData.val().status == 'ACCEPTED') {
                            firebase.database().ref(`/users/` + curbookingData.val().driver + '/my_bookings/' + this.state.currentBookingId + '/').update({
                                status: 'CANCELLED',
                                reason: this.state.radio_props[this.state.value].label
                            }).then(() => {
                                firebase.database().ref(`/users/` + this.state.driverUID + '/').update({ queue: false })
                                //this.setState({ alertModalVisible: true });
                                this.sendPushNotification(curbookingData.val().driver, this.state.currentBookingId, languageJSON.rider_cancel_course, languageJSON.rider_cancel_course_title)
                            })
                        }
                    } else {
                        //this.setState({ alertModalVisible: true });   
                    }
                })
            })
        })
        this.props.navigation.goBack()

    }

    //call driver button press
    onPressCall(phoneNumber) {
        try {
            Linking.openURL(`tel:${phoneNumber}`);
        } catch (error) {
            console.error('An error occurred', error)
        }
    }
    sendPushNotification(customerUID, bookingId, msg, title) {
        const customerRoot = firebase.database().ref('users/' + customerUID);
        customerRoot.once('value', customerData => {
            if (customerData.val()) {
                let allData = customerData.val()
                RequestPushMsg(allData.pushToken ? allData.pushToken : null, msg, null, title)
            }
        })
    }
    //caacel modal design

    showWaitingModal = () => {
        this.setState({ alertModalVisible: false, currentBookingId: null })
    }
    cancelModal() {
        return (
            <Modal
                transparent={true}
                visible={this.state.modalVisible}
                onRequestClose={() => {
                    this.setState({ modalVisible: false })
                }}>
                <View style={styles.cancelModalContainer}>
                    <View style={styles.cancelModalInnerContainer}>
                        <Text style={styles.cancelReasonText}>{languageJSON.cancel_reason_modal_title}</Text>
                        <RadioForm
                            radio_props={this.state.radio_props ? this.state.radio_props : null}
                            initial={0}
                            animation={false}
                            buttonColor={colors.PRIMARY}
                            selectedButtonColor={colors.PRIMARY}
                            buttonSize={10}
                            buttonOuterSize={20}
                            style={styles.radioContainerStyle}
                            labelStyle={styles.radioText}
                            radioStyle={styles.radioStyle}
                            onPress={(value) => { this.setState({ value: value }) }}
                        />
                        <Button
                            title={languageJSON.dont_cancel_text}
                            onPress={() => { this.dissMissCancel() }}
                            titleStyle={styles.buttonText}
                            buttonStyle={styles.cancelModalBtn}
                        />
                        <Button
                            title={languageJSON.no_driver_found_alert_OK_button}
                            onPress={() => { this.onCancelConfirm() }}
                            titleStyle={[styles.buttonText, { color: colors.WHITE }]}
                            buttonStyle={styles.cancelModalBtnConfirm}
                        />
                    </View>
                </View>
            </Modal>
        )
    }

    //ride cancel confirm modal design
    alertModal() {
        return (
            <Modal
                animationType="none"
                transparent={true}
                visible={this.state.alertModalVisible}
                onRequestClose={() => {
                    this.setState({ alertModalVisible: false })
                }}>
                <View style={styles.alertModalContainer}>
                    <View style={styles.alertModalInnerContainer}>

                        <View style={styles.alertContainer}>

                            <Text style={styles.rideCancelText}>{languageJSON.rider_cancel_text}</Text>

                            <View style={styles.horizontalLLine} />

                            <View style={styles.msgContainer}>
                                <Text style={styles.cancelMsgText}>{languageJSON.cancel_messege1}  {this.state.currentBookingId} {languageJSON.cancel_messege2} </Text>
                            </View>
                            <View style={styles.okButtonContainer}>
                                <Button
                                    title={languageJSON.no_driver_found_alert_OK_button}
                                    titleStyle={styles.signInTextStyle}
                                    onPress={this.showWaitingModal}
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

    loadingModal = () => {
        return (
            <Modal
                transparent={true}
                visible={this.state.driverSerach}>
                <View style={styles.loadingModal}>
                    <View style={styles.loadingModalContent}>
                        <Text style={styles.loadingModalText}>{languageJSON.driver_assign_messege}</Text>
                        <ActivityIndicator size="large" color={colors.PRIMARY} />
                        <Button
                            title={languageJSON.cancel_ride}
                            titleStyle={styles.loadingModalBtnText}
                            onPress={() => { this.onPressCancel('fromLoading') }}
                            buttonStyle={styles.loadingModalBtn}
                        />
                    </View>
                </View>
            </Modal>
        )
    }


    chat() {
        this.props.navigation.navigate("onlineChat", { passData: this.getParamData })
    }

    render() {
        const splited_name = this.state.driverName ? this.state.driverName.split(" ") : "";
        const driverName = splited_name[0] + " " + (splited_name[1] && splited_name[1].substring(0, 1)) + ".";
        return (
            <View style={styles.mainContainer}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    /*rightComponent={<NotificationBtn {...this.props}  />}*/
                    containerStyle={styles.headerStyle} />

                {this.state.driverUID && this.state.region && this.state.bookingStatus ?
                    <TrackNow navigation={this.props.navigation} duid={this.state.driverUID} alldata={this.state.region} bookingStatus={this.state.bookingStatus} />
                    :
                    <MapView
                        customMapStyle={customMapStyle}
                        ref={map => { this.map = map }}
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        onLayout={() => this.setState({ mapReady: true })}
                        initialRegion={{
                            latitude: this.state.region.wherelatitude ? this.state.region.wherelatitude : 46,
                            longitude: this.state.region.wherelongitude ? this.state.region.wherelongitude : 2,
                            latitudeDelta: 0.9922,
                            longitudeDelta: 1.9421
                        }}>

                        {this.state.mapReady && this.state.region.wherelatitude &&
                            <Marker
                                tracksViewChanges={false}
                                coordinate={{ latitude: this.state.region ? (this.state.region.wherelatitude) : 0.00, longitude: this.state.region.wherelongitude ? (this.state.region.wherelongitude) : 0.00 }}
                                title={this.state.region.whereText}>
                                <Car height={40} width={30} />
                            </Marker>
                        }
                        {this.state.mapReady && this.state.region.droplatitude &&
                            <Marker
                                tracksViewChanges={false}
                                coordinate={{ latitude: this.state.region ? (this.state.region.droplatitude) : 0.00, longitude: this.state.region.droplongitude ? (this.state.region.droplongitude) : 0.00 }}
                                title={this.state.region.droptext}>
                                <Pin height={40} width={30} />
                            </Marker>
                        }
                        {this.state.mapReady && this.state.coords &&
                            <MapViewPolyline
                                coordinates={this.state.coords ? this.state.coords : { latitude: 0.00, longitude: 0.00 }}
                                strokeWidth={4}
                                strokeColor={colors.SECONDARY} />
                        }

                    </MapView>
                }

                <View style={[styles.bottomContainer, Platform.OS != "ios" && { backgroundColor: "rgba(255, 255, 255, .95)" }]}>
                    <View style={[styles.locationsViewContainer]} >
                        <View style={[styles.locationsView]} >
                            <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                            <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.region.whereText ? this.state.region.whereText : ""}</Text>
                        </View>
                        <View style={styles.separator} />
                        <View style={[styles.locationsView]} >
                            <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                            <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.region.droptext ? this.state.region.droptext : ""}</Text>
                        </View>
                    </View>
                    <View style={[styles.locationsViewContainer, { marginBottom: 15 }]} >
                        <View style={[styles.locationsView]} >
                            <Text style={[styles.holderText]}>{languageJSON.you_selected}</Text>
                            <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.carType}</Text>
                        </View>
                        <View style={styles.separator} />
                        <View style={[styles.locationsView]} >
                            <Text style={[styles.holderText]}>{languageJSON.voiture_model_numero}</Text>
                            <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.carNo ? this.state.carNo + ' ' : ''}</Text>
                        </View>
                    </View>
                    {/*<Text style={styles.otpText}>{languageJSON.otp} {this.state.otp}</Text>*/}

                    {this.state.bookingStatus != "NEW" &&
                        <View style={styles.driverDetailsContainer}>
                            <Text style={[styles.holderText]}>{languageJSON.driver_book_text}</Text>
                            <View style={styles.driverDetails}>
                                <Image
                                    source={this.state.driverPic ? { uri: this.state.driverPic } : require('../../assets/images/avatar.png')}
                                    style={styles.driverPhoto} />
                                <View style={styles.driverView} >
                                    <Text style={styles.driverNameText}>{driverName}</Text>
                                    <View style={styles.ratingView} >
                                        <StarRating
                                            disabled={true}
                                            maxStars={5}
                                            starSize={18}
                                            fullStar={fullStar}
                                            halfStar={'star-half'}
                                            emptyStar={emptyStar}
                                            iconSet={'Ionicons'}
                                            fullStarColor={"#fed428"}
                                            emptyStarColor={"#727e8b"}
                                            halfStarColor={"#fed428"}
                                            rating={parseInt(this.state.starCount)}
                                            containerStyle={styles.ratingContainerStyle}
                                        />
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.btnChat}
                                    onPress={() => this.chat()}
                                >
                                    <Icon
                                        name="comment-multiple-outline"
                                        type="material-community"
                                        size={20}
                                        color={colors.PRIMARY}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.btnCall}
                                    onPress={() => { this.onPressCall(this.state.driverContact) }}
                                >
                                    <Icon
                                        name="phone"
                                        type="simple-line-icon"
                                        size={20}
                                        color={colors.PRIMARY}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    }
                    <Button
                        title={languageJSON.cancel_ride}
                        titleStyle={styles.buttonText}
                        onPress={() => { this.onPressCancel(null) }}
                        buttonStyle={styles.cancelModalBtn}
                    />

                </View>
                {
                    this.cancelModal()
                }
                {
                    this.alertModal()
                }

                {this.loadingModal()}


            </View>
        );
    }



}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    //alert modal
    alertModalContainer: { flex: 1, justifyContent: 'center', backgroundColor: colors.GREY.background },
    alertModalInnerContainer: { height: 200, width: (width * 0.85), backgroundColor: colors.WHITE, alignItems: 'center', alignSelf: 'center', borderRadius: 7 },
    alertContainer: { flex: 2, justifyContent: 'space-between', width: (width - 100) },
    rideCancelText: { flex: 1, top: 15, color: colors.BLACK, fontFamily: 'Montserrat-Bold', fontSize: 20, alignSelf: 'center' },
    horizontalLLine: { width: (width - 110), height: 0.5, backgroundColor: colors.BLACK, alignSelf: 'center', },
    msgContainer: { flex: 2.5, alignItems: 'center', justifyContent: 'center' },
    cancelMsgText: { color: colors.BLACK, fontFamily: 'Montserrat-Regular', fontSize: 15, alignSelf: 'center', textAlign: 'center' },
    okButtonContainer: { flex: 1, width: (width * 0.85), flexDirection: 'row', backgroundColor: colors.GREY.iconSecondary, alignSelf: 'center' },
    okButtonStyle: { flexDirection: 'row', backgroundColor: colors.GREY.iconSecondary, alignItems: 'center', justifyContent: 'center' },
    okButtonContainerStyle: { flex: 1, width: (width * 0.85), backgroundColor: colors.GREY.iconSecondary, },

    //
    map: {
        ...StyleSheet.absoluteFill
    },

    loadingModal: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: "rgba(0,0,0,.1)"

    },
    loadingModalContent: {
        backgroundColor: "white",
        padding: 15,
        borderRadius: 10,

    },
    loadingModalBlur: {
        ...StyleSheet.absoluteFill,
    },
    loadingModalText: {
        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: colors.TEXT,
        marginBottom: 30
    },
    loadingModalBtnText: {
        fontFamily: "Montserrat-Bold",
        fontSize: 14,
        color: colors.WHITE,

    },
    loadingModalBtn: {
        height: 50,
        marginTop: 30,
        borderRadius: 10,
        backgroundColor: colors.TEXT_DARK
    },
    cancelModalContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: "rgba(0,0,0,.1)"
    },
    cancelModalInnerContainer: {
        backgroundColor: "white",
        padding: 15,
        borderRadius: 10,
    },
    cancelReasonText: {
        fontFamily: "Montserrat-Light",
        fontSize: 16,
        color: colors.TEXT,
        marginBottom: 30
    },
    radioContainerStyle: {

    },
    radioText: {
        fontFamily: "Montserrat-Light",
        fontSize: 12,
        color: colors.TEXT_LIGHT,
    },
    radioStyle: {
        marginBottom: 20
    },
    cancelModalBtn: {
        height: 50,
        marginTop: 20,
        borderRadius: 10,
        backgroundColor: colors.PRIMARY
    },
    buttonText: {
        fontFamily: "Montserrat-Bold",
        fontSize: 14,
        color: colors.BUTTON_TEXT,
    },
    cancelModalBtnConfirm: {
        height: 50,
        marginTop: 20,
        borderRadius: 10,
        backgroundColor: colors.TEXT_DARK
    },
    headerGradient: {
        zIndex: 1,
        ...StyleSheet.absoluteFill,
        height: 80,

    },
    headerStyle: {
        zIndex: 2,
        paddingHorizontal: 0,
        borderBottomWidth: 0,
        backgroundColor: "transparent",
        marginHorizontal: 20
    },
    bottomContainer: {
        margin: size * 15,
        borderRadius: size * 15,
        backgroundColor: Platform.OS == 'android' ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.95)",
        shadowColor: "rgba(0, 0, 0, 0.16)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 14,
        shadowOpacity: 1,
        paddingHorizontal: size * 10,
        paddingVertical: size * 15,
    },
    btnChat: {
        width: 45,
        height: 45,
        marginRight: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.WHITE,
        borderRadius: size * 8,
        shadowColor: "rgba(0, 0, 0, 0.06)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 6,
        elevation: .5,
        shadowOpacity: .6
    },
    btnCall: {
        width: 45,
        height: 45,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.WHITE,
        borderRadius: size * 8,
        shadowColor: "rgba(0, 0, 0, 0.06)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 6,
        elevation: .5,
        shadowOpacity: .6
    },
    driverDetailsContainer: {
        paddingHorizontal: size * 10,
        paddingBottom: size * 20
    },
    driverDetails: {
        flexDirection: 'row',
        marginTop: size * 10
    },
    driverPhoto: {
        width: size * 60,
        height: size * 60,
        borderRadius: size * 60,
        backgroundColor: colors.ITEM,
        marginRight: size * 15,
    },
    driverView: {
        flex: 1,
        justifyContent: "center",

    },
    ratingView: {
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center"
    },
    driverNameText: {
        fontFamily: "Montserrat-Light",
        fontSize: size * 16,
        color: colors.TEXT_SEMI_DARKER,
        marginBottom: size * 5
    },
    driverRatingText: {
        fontFamily: "Montserrat-Light",
        fontSize: size * 14,
        color: colors.TEXT,
        marginRight: size * 5
    },
    locationsViewContainer: {
        padding: size * 10,
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: colors.SEPARATOR_LIGHT,
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
        marginBottom: 8
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
    blurView: {
        ...StyleSheet.absoluteFill,
        borderRadius: size * 15,
    },
});