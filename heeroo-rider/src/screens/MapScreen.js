import React from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { MapComponent, DrawerToggle, NotificationBtn, Path } from '../components';
import { Icon, Button, Avatar, Header } from '@rneui/themed';
import { colors } from '../common/theme';
import Geolocation from '../common/geolocation';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { google_map_key } from '../common/key';
import languageJSON from '../common/language';
import Geocoder from 'react-native-geocoding';
import SearchModal from './SearchModal';
import { getDistance } from 'geolib';
import { checkLocationPermission } from '../common/permission';

const { height, width } = Dimensions.get('window');
const size = height / 812;


export default class MScreen extends React.Component {

    bonusAmmount = 0;
    constructor(props) {
        super(props);
        Geocoder.init(google_map_key);
        this.state = {
            mounted: false,
            loadingModal: false,
            giftModal: false,
            location: null,
            errorMessage: null,
            region: {
                latitude: 14.7119226,
                longitude: -17.4799185,
                latitudeDelta: 0.041922,
                longitudeDelta: 0.041922,
            },
            whereText: languageJSON.map_screen_where_input_text,
            dropText: languageJSON.map_screen_drop_input_text,
            backgroundColor: colors.WHITE,
            carType: "",
            allRiders: [],
            passData: {
                droplatitude: 0,
                droplongitude: 0,
                droptext: "",
                whereText: "",
                wherelatitude: 0,
                wherelongitude: 0,
                carType: '',
            },
            allCars: [],
            nearby: [],
            mainCarTypes: [],
            checkCallLocation: '',
            freeCars: [],
            settings: {
                symbol: '',
                code: '',
                cash: false,
                wallet: false
            },
            selected: 'drop',
            mapChanging: false,
            geolocationFetchComplete: false,
            loading: false,
            searchModalVisible: false,
            from: "drop",
            coords: [],
            country: null
        }
    }

    componentDidMount() {
        console.log('mounted map')
        checkLocationPermission().then((result) => {
            this._retrieveSettings()

            this.getCountry()
            this.tripSatusCheck()
        })

    }
    componentWillUnmount() {
        console.log('unmounted map')

    }
    tripSatusCheck() {
        var curuser = firebase.auth().currentUser;
        const propsForOn = this.props
        const userData = null

        const userRoot = firebase.database().ref('users/' + curuser.uid);
        userRoot.once('value', userData => {
            if (userData.val()) {
                userData = userData.val()

                // Règlement en attente d'une course terminée avant la fermeture de
                // l'app : le veilleur ci-dessous ne réagit qu'aux changements en
                // direct, on vérifie donc aussi à l'ouverture.
                const pendingRef = firebase.database().ref('users/' + curuser.uid + '/my-booking');
                pendingRef.once('value', (snapshot) => {
                    const all = snapshot.val() || {};
                    for (const key of Object.keys(all)) {
                        const booking = all[key];
                        // Course sous empreinte bancaire : le serveur débite tout seul,
                        // on ne demande rien au passager (sauf si la capture a échoué).
                        if (booking && booking.payment_status == 'IN_PROGRESS' && booking.status == 'END'
                            && booking.skip != true && booking.paymentstart != true
                            && !(booking.payment_intent_id && !booking.card_capture_error)) {
                            booking.firstname = userData.firstName;
                            booking.lastname = userData.lastName;
                            booking.email = userData.email;
                            booking.phonenumber = userData.mobile;
                            booking.bookingKey = key;
                            propsForOn.navigation.navigate('CardDetails', { data: booking });
                            return;
                        }
                    }

                    // Course encore en cours a la reouverture : l'application revenait
                    // au formulaire de reservation et le passager perdait le suivi de
                    // son trajet, sans moyen de revenir dessus ni de joindre son
                    // chauffeur.
                    for (const key of Object.keys(all)) {
                        const booking = all[key];
                        if (!booking) continue;
                        if (booking.status == 'START') {
                            propsForOn.navigation.navigate('trackRide', { data: booking, bId: key });
                            return;
                        }
                        if (booking.status == 'ACCEPTED' || booking.status == 'ARRIVED') {
                            propsForOn.navigation.navigate('BookedCab', { passData: { ...booking, bokkingId: key } });
                            return;
                        }
                    }
                });

                const bookingData = firebase.database().ref('users/' + curuser.uid + '/my-booking');
                bookingData.on('child_changed', function (childSnapshot, prevChildKey) {
                    if (childSnapshot.exists()) {
                        let key = childSnapshot.key
                        let bookingData = childSnapshot.val()

                        if (bookingData.payment_status) {
                            if (bookingData.payment_status == "IN_PROGRESS" && bookingData.status == 'END' && bookingData.skip != true && bookingData.paymentstart != true
                                && !(bookingData.payment_intent_id && !bookingData.card_capture_error)) {
                                bookingData.firstname = userData.firstName;
                                bookingData.lastname = userData.lastName;
                                bookingData.email = userData.email;
                                bookingData.phonenumber = userData.mobile;
                                bookingData.bookingKey = key

                                propsForOn.navigation.navigate('CardDetails', { data: bookingData });

                            }
                        }
                    }
                })
            }
        })
    }

    getCountry = async () => {


        Geolocation.getCurrentPosition(
            position => {

                Geocoder.from(position.coords.latitude, position.coords.longitude)
                    .then(json => {

                        let isoCountryCode = null;

                        json.results[0].address_components.forEach(element => {
                            if (element.types[0] == "country") {
                                isoCountryCode = element.short_name
                            }
                        });

                        this.setState({ country: isoCountryCode });
                        this.getData(isoCountryCode)
                        return isoCountryCode

                    })
                    .catch(error => console.warn(error));
            },
            error => console.log('Error', JSON.stringify(error)),
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
        )

    }

    getData = async (country) => {

        if (this.state.passData.wherelatitude == 0) {
            this._getLocationAsync();

        }
        this.allCarsData(country);
        this.onPressModal();
    }

    allCarsData = (country) => {
        const cars = firebase.database().ref('rates/car_type');
        cars.on('value', allCars => {
            if (allCars.val()) {

                let cars = allCars.val()
                let arr = [];

                for (let key in cars) {
                    if (cars[key].country == country) {
                        cars[key].minTime = ''
                        cars[key].available = true;
                        cars[key].active = false;
                        arr.push(cars[key]);
                    }
                }
                this.setState({ mainCarTypes: arr });
                this.getDrivers()

            }

        })
    }

    _retrieveSettings = async () => {

        await AsyncStorage.getItem('settings').then((value) => {
            if (!!value) {
                this.setState({ settings: value });

            }
        }).catch(
            error => console.log('error = ' + error)
        );
    }

    loading = () => {
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
                        <Text style={styles.loadModalText}>{languageJSON.driver_finding_alert}</Text>
                    </View>
                </View>
            </Modal>
        )
    }

    createPassDataObj(pos, formatted_address, curuser) {


        let obj = {}
        obj = this.state.passData;
        obj.wherelatitude = pos.latitude
        obj.wherelongitude = pos.longitude
        obj.whereText = formatted_address;


        obj.countryCode = this.state.country;

        this.setState({
            passData: obj,
            checkCallLocation: 'navigation',
            mapChanging: true
        });

        this.getDrivers();

        firebase.database().ref('users/' + curuser + '/location').update({
            add: formatted_address,
            lat: pos.latitude,
            lng: pos.longitude
        })

    }

    getDrivers = () => {
        const userData = firebase.database().ref('users/');

        userData.on('value', userData => {
            if (userData.val()) {

                let allUsers = userData.val();

                this.prepareDrivers(allUsers);
            }
        })

    }

    _getLocationAsync = async () => {
        // this.setState({ loadingModal: true });
        Geolocation.getCurrentPosition(
            position => {

                var pos = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };

                let curuser = firebase.auth().currentUser.uid;
                let latlng = pos.latitude + ',' + pos.longitude;
                let formatted_address = null

                fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng + '&key=' + google_map_key)
                    .then((resp) => resp.json())
                    .then((data) => {
                        formatted_address = data.results[0].formatted_address
                        this.setState({
                            whereText: formatted_address,
                            region: {
                                latitude: pos.latitude,
                                longitude: pos.longitude,
                                latitudeDelta: 0.020922,
                                longitudeDelta: 0.020421,
                            },
                            geolocationFetchComplete: true
                        });

                        this.createPassDataObj(pos, formatted_address, curuser)
                    })
                    .catch((error) => {
                        console.log('[MapScreen] géocodage impossible', error);
                        this.setState({
                            region: { latitude: pos.latitude, longitude: pos.longitude, latitudeDelta: 0.020922, longitudeDelta: 0.020421 },
                            geolocationFetchComplete: true
                        });
                    });
            },
            error => {
                // Sans position, on affiche quand même la carte (région par défaut)
                // et on explique, au lieu d'un écran vide.
                console.log('[MapScreen] localisation impossible', JSON.stringify(error));
                this.setState({ geolocationFetchComplete: true });
                Alert.alert(languageJSON.Error, error && error.message ? error.message : languageJSON.location_error);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
        );
    }

    onPressBook = () => {
        if ((this.state.passData.whereText == "" || this.state.passData.wherelatitude == 0 || this.state.passData.wherelongitude == 0) && (this.state.passData.dropText == "" || this.state.passData.droplatitude == 0 || this.state.passData.droplongitude == 0)) {
            alert(languageJSON.pickup_and_drop_location_blank_error)
        } else {
            if (this.state.passData.whereText == "" || this.state.passData.wherelatitude == 0 || this.state.passData.wherelongitude == 0) {
                alert(languageJSON.pickup_location_blank_error)
            } else if (this.state.passData.dropText == "" || this.state.passData.droplatitude == 0 || this.state.passData.droplongitude == 0) {
                alert(languageJSON.drop_location_blank_error)
            } else if (this.state.passData.carType == "" || this.state.passData.carType == undefined) {
                alert(languageJSON.car_type_blank_error)
            } else {
                this.state.passData.latitudeDelta = "0.00922";
                this.state.passData.longitudeDelta = "0.00421";

                this.props.navigation.navigate('FareDetails', { data: this.state.passData, carType: this.state.passData.carType, carimage: this.state.passData.carImage, country: this.state.country })
            }
        }

    }

    selectCarType(value, key) {

        this.setState(prevState => {
            prevState['allCars'].forEach(function (element, index, output) {
                if (index == key) {
                    output[index].active = true;
                } else {
                    output[index].active = false;
                }
            });
            prevState['passData'] = { ...prevState.passData, carType: value.name, carImage: value.image }
            return prevState;
        })
    }

    getDriverTime = (startLoc, destLoc) => {
        return new Promise(function (resolve, reject) {
            fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${startLoc}&destinations=${destLoc}&key=${google_map_key}`)
                .then((response) => response.json())
                .then((res) => {
                    resolve({
                        distance_in_meter: res.rows[0].elements[0].distance.value,
                        time_in_secs: res.rows[0].elements[0].duration.value,
                        timein_text: res.rows[0].elements[0].duration.text
                    })
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    prepareDrivers = async (allUsers) => {
        let availableDrivers = [];
        let freeCars = [];
        let arr = {};
        let riderLocation = [this.state.passData.wherelatitude, this.state.passData.wherelongitude];
        let startLoc = this.state.passData.wherelatitude + ', ' + this.state.passData.wherelongitude
        for (let key in allUsers) {

            let driver = {
                email: allUsers[key].email,
                location: allUsers[key].location,
                usertype: allUsers[key].usertype,
                approved: allUsers[key].approved,
                queue: allUsers[key].queue,
                driverActiveStatus: allUsers[key].driverActiveStatus,
                arriveDistance: allUsers[key].arriveDistance,
                arriveTime: allUsers[key].arriveTime,
                minDistance: allUsers[key].minDistance,
                carType: allUsers[key].carType,
            };


            if (driver.usertype && driver.usertype == 'driver' && driver.approved == true && driver.queue == false && driver.driverActiveStatus == true) {
                if (driver.location) {

                    let driverLocation = [driver.location.lat, driver.location.lng];

                    let distance = getDistance(riderLocation, driverLocation) / 1000;

                    freeCars.push(driver);
                    if (distance < 10) {

                        let destLoc = driver.location.lat + ', ' + driver.location.lng
                        driver.arriveDistance = distance;
                        driver.arriveTime = await this.getDriverTime(startLoc, destLoc);
                        let carType = driver.carType;
                        if (arr[carType] && arr[carType].drivers) {
                            arr[carType].drivers.push(driver);
                            if (arr[carType].minDistance > distance) {
                                arr[carType].minDistance = distance;
                                arr[carType].minTime = driver.arriveTime.timein_text;
                            }
                        } else {

                            arr[carType] = {};
                            arr[carType].drivers = [];
                            arr[carType].drivers.push(driver);
                            arr[carType].minDistance = distance;
                            arr[carType].minTime = driver.arriveTime.timein_text;
                        }


                        availableDrivers.push(driver);

                    }
                }
            }
        }

        const allCars = this.state.mainCarTypes.slice();

        for (let i = 0; i < allCars.length; i++) {
            if (arr[allCars[i].name]) {
                allCars[i].nearbyData = arr[allCars[i].name].drivers;
                allCars[i].minTime = arr[allCars[i].name].minTime;
                allCars[i].available = true;
            } else {
                allCars[i].minTime = '';
                allCars[i].available = false;
            }
            allCars[i].active = false;

        }

        this.setState(prevState => ({
            allCars: allCars,
            passData: { ...prevState.passData, carType: "" },
            loadingModal: false,
            nearby: availableDrivers,
            freeCars: freeCars,
        }));

    }

    showNoDriverAlert() {
        if (this.state.checkCallLocation == 'navigation' || this.state.checkCallLocation == 'moveMarker') {
            Alert.alert(
                languageJSON.no_driver_found_alert_title,
                languageJSON.no_driver_found_alert_messege,
                [
                    {
                        text: languageJSON.no_driver_found_alert_OK_button,
                        onPress: () => this.setState({ loadingModal: false }),
                    },
                    { text: languageJSON.no_driver_found_alert_TRY_AGAIN_button, onPress: () => { this._getLocationAsync() }, style: 'cancel', },
                ],
                { cancelable: true },
            )
        }

    }

    onPressCancel() {
        this.setState({
            giftModal: false
        })
    }

    bonusModal() {
        return (
            <Modal
                animationType="fade"
                transparent={true}
                visible={this.state.giftModal}
                onRequestClose={() => {
                    this.setState({ giftModal: false })
                }}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(22,22,22,0.8)", justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ width: '80%', backgroundColor: "#fffcf3", borderRadius: 10, justifyContent: 'center', alignItems: 'center', flex: 1, maxHeight: 325 }}>
                        <View style={{ marginTop: 0, alignItems: "center" }}>
                            <Avatar
                                rounded
                                size={200}
                                source={require('../../assets/images/gift.gif')}
                                containerStyle={{ width: 200, height: 200, marginTop: 0, alignSelf: "center", position: "relative" }}
                            />
                            <Text style={{ color: "#0cab03", fontSize: 28, textAlign: "center", position: "absolute", marginTop: 170 }}>{languageJSON.congratulation}</Text>
                            <View>
                                <Text style={{ color: "#000", fontSize: 16, marginTop: 12, textAlign: "center" }}>{languageJSON.refferal_bonus_messege_text} {this.state.settings.code}{this.bonusAmmount}</Text>
                            </View>
                            <View style={styles.buttonContainer}>
                                <Button
                                    title={languageJSON.no_driver_found_alert_OK_button}
                                    loading={false}
                                    titleStyle={styles.buttonTitleText}
                                    onPress={() => { this.onPressCancel() }}
                                    buttonStyle={styles.cancelButtonStyle}
                                    containerStyle={{ marginTop: 20 }}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    onPressModal = () => {

        var curuser = firebase.auth().currentUser.uid;
        const userRoot = firebase.database().ref('users/' + curuser);
        userRoot.once('value', userData => {
            if (userData.val()) {
                if (userData.val().refferalId == undefined) {
                    let name = userData.val().firstName ? userData.val().firstName.toLowerCase() : '';
                    let uniqueNo = Math.floor(Math.random() * 9000) + 1000;
                    let refId = name + uniqueNo;
                    userRoot.update({
                        refferalId: refId,
                        walletBalance: 0,
                    }).then(() => {
                        if (userData.val().signupViaReferral == true) {
                            firebase.database().ref('referral/bonus').once('value', referal => {
                                if (referal.val()) {
                                    this.bonusAmmount = referal.val().amount;
                                    userRoot.update({
                                        walletBalance: this.bonusAmmount
                                    }).then(() => {
                                        this.setState({
                                            giftModal: true
                                        })
                                    })
                                }
                            })
                        }
                    })
                }
            }
        })
    }

    tapAddress = (selection) => {


        this.setState({
            searchModalVisible: true,
            from: selection
        })
    }

    render() {

        return (
            <View style={styles.container}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    //rightComponent={<NotificationBtn {...this.props}  />}
                    containerStyle={styles.headerStyle}
                />
                {this.state.geolocationFetchComplete ?
                    <MapComponent
                        //setMapRef={this.setMapRef}
                        markerRef={marker => { this.marker = marker; }}
                        mapStyle={styles.map}
                        mapRegion={this.state.region}
                        nearby={this.state.freeCars}
                        coords={this.state.coords}
                        passData={this.state.passData}
                    />
                    :
                    <></>
                }
                <View style={styles.carsView}>

                    <Text style={styles.searchTitle}>{languageJSON.Detailsdelacourse}</Text>
                    <View style={[styles.leftViewContainerStyle]} >
                        <Path border={4} />
                        <View flex={1}>
                            <TouchableOpacity onPress={() => this.tapAddress('pickup')} >
                                <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                                <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.whereText ? this.state.whereText : languageJSON.select}</Text>
                            </TouchableOpacity>
                            <View style={styles.separator} />
                            <TouchableOpacity onPress={() => this.tapAddress('drop')} >
                                <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                                <Text numberOfLines={1} style={[styles.placeStyle]}>{this.state.dropText ? this.state.dropText : languageJSON.select}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        horizontal={true}
                        contentContainerStyle={[styles.carsSwipeContainer]}
                        showsHorizontalScrollIndicator={false}>
                        {this.state.allCars.length == 0 ?
                            <ActivityIndicator size="large" color={colors.PRIMARY} />
                            :
                            this.state.allCars.map((prop, key) => {
                                return (
                                    <TouchableOpacity key={key} style={styles.carItemView} onPress={() => { this.selectCarType(prop, key) }} disabled={prop.minTime == ''} >
                                        <View style={[styles.carItemImageContainer, { backgroundColor: prop.active == true ? colors.PRIMARYTRANSPARENT : colors.TRANSPARENT }]} >
                                            <Image source={prop.image ? { uri: prop.image } : require('../../assets/images/microBlackCar.png')} style={styles.carItemImage} />
                                        </View>
                                        <View style={styles.carItemTexts}>
                                            <Text style={styles.carItemText1}>{prop.name.toUpperCase()}</Text>
                                            <Text style={styles.carItemText2}>{prop.minTime != '' ? prop.minTime : languageJSON.not_available}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                    </ScrollView>
                    <Button
                        title={languageJSON.book_now_button}
                        loading={this.state.loading}
                        onPress={this.onPressBook}
                        buttonStyle={styles.bookBtn}
                        titleStyle={styles.bookBtnTitle}
                    />
                </View>
                {

                    this.bonusModal()
                }
                {
                    this.loading()
                }
                <SearchModal
                    mapRef={this.mapRef}
                    allCarsData={(country) => this.allCarsData(country)}
                    state={this.state}
                    setState={(s) => this.setState(s)}
                    modalVisible={this.state.searchModalVisible} />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    buttonTitleText: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 14,
        color: colors.WHITE,
    },
    cancelButtonStyle: {
        backgroundColor: colors.PRIMARY,
        borderRadius: 10,
        height: 48,
        paddingHorizontal: 30,
    },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingBottom: 20
    },
    headerStyle: {
        zIndex: 9,
        paddingHorizontal: 0,
        borderBottomWidth: 0,
        width: "30%",
        marginBottom: 30
    },
    headerGradient: {
        zIndex: 1,
        ...StyleSheet.absoluteFill,
        height: 100
    },
    swiperGradient: {
        zIndex: -1,
        width: 120,
        borderRadius: 0,
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
    },
    map: {
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
        paddingVertical: size * 20,
        elevation: 1
    },
    carsSwipeContainer: {
        flexGrow: 1,
        justifyContent: "center",
        marginBottom: size * 20
    },
    carsViewTitle: {
        fontFamily: "Montserrat-Bold",
        fontSize: size * 10,
        color: colors.DARK,
        marginHorizontal: size * 10
    },
    carsViewSubtitle: {
        fontFamily: "Montserrat-Light",
        fontSize: 12,
        color: colors.TEXT,
        marginHorizontal: size * 10,
        marginBottom: size * 10,

    },
    bookBtn: {
        height: size * 50,
        borderRadius: 10,
        marginHorizontal: size * 20,
        backgroundColor: colors.PRIMARY
    },
    bookBtnTitle: {
        fontFamily: "Montserrat-Bold",
        fontSize: size * 14,
        color: colors.BUTTON_TEXT,
    },
    carItemView: {
        marginRight: size * 20,
        alignItems: "center",
        justifyContent: "center",
    },
    carItemImageContainer: {
        width: 40,
        height: 40,
        borderRadius: 40 / 2,
        alignItems: "center",
        justifyContent: "center",
    },
    carItemImage: {
        width: 45,
        height: 30,
    },
    carItemTexts: {
        marginBottom: 5,

    },
    carItemText1: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: 10,
        color: colors.HOLDER_TEXT,
        textAlign: "center"
    },
    carItemText2: {
        fontFamily: "Montserrat-Light",
        fontSize: 8,
        color: colors.TEXT_LIGHT,
        textAlign: "center"
    },
    blurView: {
        ...StyleSheet.absoluteFill,
        borderRadius: size * 15,
    },
    searchTitle: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: size * 10,
        color: colors.HOLDER_TEXT,
        marginHorizontal: size * 20
    },
    leftViewContainerStyle: {
        marginHorizontal: size * 15,
        marginVertical: size * 15,
        flexDirection: "row"
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
        marginVertical: size * 8,
        height: 1,
        backgroundColor: colors.SEPARATOR_LIGHT
    },
    loadModalContainer: {
        backgroundColor: "rgba(0,0,0,.4)",
        flex: 1,
        justifyContent: "center",
        padding: size * 20,
    },
    loadModalInnerContainer: {
        backgroundColor: "white",
        borderRadius: size * 10,
        padding: size * 15,
        flexDirection: "row",
        alignItems: 'center',
    },
    loadModalText: {
        flex: 1,
        fontFamily: "Montserrat-SemiBold",
        fontSize: size * 14,
        color: colors.HOLDER_TEXT,
        marginLeft: size * 15
    }
});
