import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableWithoutFeedback,
    Platform,
    SafeAreaView,
    Alert,
} from 'react-native';
import { Button, Header, Icon } from '@rneui/themed';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { RequestPushMsg } from '../common/RequestPushMsg';
import countryCurrency from './../constants/countryCurrency.json'
import { DrawerToggle, Path } from '../components'
import { formatDateTime } from '../common/dateFormat';

export default class DriverTripComplete extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            starCount: 3.5,
            title: 'John Dasgupta',
            currency: {
                code: ' ',
                symbol: ' '
            },
            loading: false
        }
        this._retrieveCurrency();
    }

    _retrieveCurrency = async () => {
        firebase.database().ref('settings/').once('value', value => {
            if (value.val()) {

                let symbol = " €"
                let code = " EUR"
                let data = value

                const dataList = Array.isArray(data) ? data : Object.values(data || {});
                dataList.forEach(element => {

                    if (this.state.rideDetails.pickup.country == element.country) {
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

    UNSAFE_componentWillMount() {
        const allDetails = this.props.route.params.allDetails
        const trip_cost = this.props.route.params.trip_cost
        const trip_end_time = this.props.route.params.trip_end_time
        this.setState({
            rideDetails: allDetails,
            region: {
                latitude: allDetails.pickup.lat,
                longitude: allDetails.pickup.lng,
                latitudeDelta: 0.9922,
                longitudeDelta: 0.9421,
            },
            curUid: firebase.auth().currentUser.uid,
            trip_cost: trip_cost,
            trip_end_time: trip_end_time
        })

    }

    componentDidMount() {
        // Si le passager règle par carte pendant que cet écran est affiché, la
        // question « payé en espèces ? » n'a plus de sens : on referme l'écran
        // pour que le chauffeur ne puisse pas écraser le paiement carte.
        const bookingId = this.props.route.params.allDetails && this.props.route.params.allDetails.bookingId;
        if (!bookingId) return;
        this.paymentRef = firebase.database().ref('bookings/' + bookingId + '/payment_status');
        this.paymentRef.on('value', (snap) => {
            if (snap.val() === 'PAID' && !this.state.loading && !this.leftScreen) {
                this.leftScreen = true;
                this.paymentRef.off();
                firebase.database().ref('users/' + this.state.curUid + '/').update({ queue: false });
                Alert.alert(languageJSON.payment || 'Paiement', 'Le passager a réglé la course par carte.');
                this.props.navigation.navigate('DriverTripAcceptScreen');
            }
        });
    }

    componentWillUnmount() {
        if (this.paymentRef) this.paymentRef.off();
    }

    //done button press function
    onPressDone(item, status) {
        if (this.leftScreen) return;
        // Course réglée par carte : le serveur débite l'empreinte, le chauffeur
        // n'a pas à déclarer d'encaissement.
        if (item && item.payment_mode === 'Card' && item.payment_intent_id) {
            Alert.alert(languageJSON.payment || 'Paiement', 'Cette course est réglée par carte : le paiement est automatique.');
            return;
        }
        this.leftScreen = true;
        this.setState({ loading: true });
        var data = {
            payment_mode: "Espèces",
            status: status,
            payment_status: status == "END" ? "PAID" : "WAITING",
        };

        var riderData = {
            payment_mode: "Espèces",
            status: status,
            payment_status: status == "END" ? "PAID" : "WAITING",
        };
        //var bookingId = item.bookingId?item.bookingId:item.bookingUid;
        let dbRef = firebase.database().ref('users/' + this.state.curUid + '/my_bookings/' + item.bookingId + '/');
        dbRef.update(data).then(() => {
            firebase.database().ref('bookings/' + item.bookingId + '/').update(data).then(() => {
                let userDbRef = firebase.database().ref('users/' + item.customer + '/my-booking/' + item.bookingId + '/')
                userDbRef.update(riderData).then(() => {
                    firebase.database().ref('users/' + this.state.curUid + '/').update({
                        queue: false
                    }).then(() => {
                        this.setState({ loading: false });
                        this.props.navigation.navigate('DriverTripAcceptScreen')
                        if (status != "END") {
                            // Notification désormais envoyée par le serveur (déclencheur sur le statut de la course)
                            // this.sendPushNotification(item.customer, item.bookingId);
                        }
                    })

                })
            })
        })
    }

    //rating
    onStarRatingPress(rating) {
        this.setState({
            starCount: rating
        });
    }


    sendPushNotification(customerUID, bookingId) {
        const customerRoot = firebase.database().ref('users/' + customerUID);
        customerRoot.once('value', customerData => {
            if (customerData.val()) {
                let allData = customerData.val()
                RequestPushMsg(allData.pushToken ? allData.pushToken : null, languageJSON.driver_requested_for_payment + bookingId, null, null)
            }
        })
    }


    render() {

        return (
            <View flex={1}>
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<DrawerToggle {...this.props} style={styles.drawer} />}
                    //rightComponent={<NotificationBtn {...this.props} style={styles.drawer}  />}
                    containerStyle={styles.headerStyle}
                />
                <View style={styles.mainViewStyle}>
                    <View style={styles.priceContainer} >
                        <Text style={styles.rateViewTextStyle}>{this.state.trip_cost ? parseFloat(this.state.trip_cost).toFixed(0) + " " + this.state.currency.symbol : 0 + " " + this.state.currency.symbol}</Text>
                    </View>
                    <View style={styles.tripContainer}>
                        <Text style={styles.dateViewTextStyle}>{this.state.rideDetails.tripdate ? formatDateTime(this.state.rideDetails.tripdate) : ""}</Text>
                        <View style={[styles.leftViewContainerStyle]} >
                            <Path border={4} />
                            <View style={[styles.rightViewStyle]} >
                                <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                                <Text style={[styles.placeStyle]} numberOfLines={1} >{this.state.rideDetails.pickup.add}</Text>
                                <View style={styles.separator} />
                                <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                                <Text style={[styles.placeStyle]} numberOfLines={1} >{this.state.rideDetails.drop.add}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={[styles.questionText]} numberOfLines={1} >{languageJSON.clientPayedEndRide}</Text>




                    <View style={styles.questionView} >
                        {/*<Button
                            title={languageJSON.notYetPaid}
                            titleStyle={styles.btnText}
                            loading={this.state.loading}
                            loadingProps={{ color: colors.TEXT_DARK }}
                            onPress={() => {
                                this.onPressDone(this.state.rideDetails, "NOT PAID");
                            }}
                            buttonStyle={styles.questionButtonNo}
                        />*/}
                        <Button
                            title={languageJSON.endRide}
                            titleStyle={styles.btnText}
                            loading={this.state.loading}
                            loadingProps={{ color: colors.WHITE }}
                            onPress={() => {
                                this.onPressDone(this.state.rideDetails, "END");
                            }}
                            buttonStyle={styles.questionButtonyes}
                        />
                    </View>


                    <Text
                        style={styles.link}
                        onPress={() => {
                            this.onPressDone(this.state.rideDetails, "WAITING");
                        }}
                    >{'Pas de règlement pour cette course'}</Text>
                </View>
            </View>
        )
    }
}

//Screen Styling
const styles = StyleSheet.create({
  drawer: {
        backgroundColor: colors.ITEM
    },
  headerStyle: {
        backgroundColor: colors.GREY.default,
        borderBottomWidth: 0
    },
    dateViewTextStyle: {
        fontSize: 10,
        color: colors.TEXT,
        fontFamily: 'Montserrat-Light',
        textAlign: "right",
    },
    priceContainer: {
        alignSelf: 'center',
        borderRadius: 100,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: colors.PRIMARY,
        marginBottom: 40,
    },
    rateViewTextStyle: {
        fontSize: 40,
        color: colors.BUTTON_TEXT,
        fontFamily: 'Montserrat-Regular',
        textAlign: "center"
    },
    addressViewStyle: {
        flex: 4,
        flexDirection: 'row',
        paddingTop: 22,
        paddingLeft: 10,
        paddingRight: 10
    },
    addressViewTextStyle: {
        color: colors.GREY.secondary,
        fontSize: 19,
        fontFamily: 'Montserrat-Light',
        marginLeft: 15,
        marginRight: 15,
        marginTop: 15,
        lineHeight: 24
    },
    mainViewStyle: {
        flex: 1,
        backgroundColor: colors.WHITE,
        justifyContent: "flex-end"
        //marginTop: StatusBar.currentHeight
    },
    myButtonStyle: {
        height: 50,
        elevation: 0,
        backgroundColor: colors.PRIMARY,
        borderColor: colors.TRANSPARENT,
        borderWidth: 0,
        borderRadius: 10,
        marginHorizontal: 20,
        marginBottom: 30
    },
    btnText: {
        fontSize: 14,
        color: colors.BUTTON_TEXT,
        fontFamily: 'Montserrat-Bold',
    },
    leftViewStyle: {
        alignItems: 'center',
        marginRight: 10
    },
    rightViewStyle: {
        flex: 1,
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
    leftViewContainerStyle: {
        flexDirection: 'row',
    },
    tripContainer: {
        marginHorizontal: 10,
        padding: 10,
        borderRadius: 10,
        backgroundColor: colors.ITEM,
        marginBottom: 40
    },
    drawerbtn: {
        marginLeft: 20,
        marginTop: 10,
    },
    link: {
        fontFamily: "Montserrat-Bold",
        fontSize: 12,
        color: colors.TEXT_SEMI_DARKER,
        marginHorizontal: 15,
        marginBottom: 35,
        textDecorationLine: "underline",
        textDecorationStyle: "solid",
        textDecorationColor: colors.TEXT_SEMI_DARKER,
        textAlign: "center"
    },
    questionView: {
        flexDirection: 'row',
        justifyContent: "center",
        marginBottom: 30
    },
    questionButtonNo: {
        height: 50,
        elevation: 0,
        backgroundColor: colors.SECONDARY,
        borderRadius: 10,
        marginHorizontal: 20,
        paddingHorizontal: 30
    },
    questionButtonyes: {
        height: 50,
        elevation: 0,
        backgroundColor: colors.PRIMARY,
        borderRadius: 10,
        marginHorizontal: 20,
        paddingHorizontal: 30
    },
    questionText: {
        fontFamily: "Montserrat-Bold",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,
        textAlign: "center",
        marginBottom: 20

    }
});