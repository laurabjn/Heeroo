import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableWithoutFeedback,
    Platform,
    Image,
    Modal,
    Dimensions,

} from 'react-native';
import { Divider, Button, Header, Icon } from '@rneui/themed';
import StarRating from '../components/StarRating';
import { colors } from '../common/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
var { width } = Dimensions.get('window');
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import emptyStar from '../../assets/images/emptyStar.png'
import fullStar from '../../assets/images/fullStar.png'
import { RequestPushMsg } from '../common/RequestPushMsg';
import languageJSON from '../common/language';
import { DrawerToggle, CloseBtn, Path } from '../components';
import moment from "moment";

export default class DriverTripComplete extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            starCount: 0,
            title: '',
            alertModalVisible: false,
            settings: {
                code: '',
                symbol: '',
                cash: false,
                wallet: false
            },
            pickAndDrop: [],
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
                        country: countryCode,
                        cash: true,
                        wallet: false
                    },
                });

            }
        })

    };


    componentDidMount() {
        var pdata = this.props.route.params.data
        if (pdata) {

            let address = [{
                key: 'pickup',
                place: pdata.pickup.add,
                type: 'pickup'
            }, {
                key: 'drop',
                place: pdata.drop.add,
                type: 'drop'
            }]
            this.setState({
                paramData: pdata,
                getDetails: pdata,
                pickAndDrop: address
            }, () => {

            })
        }
        this._retrieveSettings(pdata.pickup.country);
    }


    //rating
    onStarRatingPress(rating) {
        this.setState({
            starCount: rating,
        })
    }

    skipRating() {
        if (!this.state.isSkiping) {
            this.setState({
                isSkiping: true
            }, () => {
                firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/my-booking/' + this.state.getDetails.bookingKey + '/').update({
                    skip: true,
                    rating_queue: false
                }).then(() => {
                    this.props.navigation.popToTop()
                })
            })
        }
    }


    submitNow() {
        if (this.state.starCount > 0) {
            this.setState({ loading: true });
            firebase.database().ref('users/' + this.state.getDetails.driver + '/ratings/details').push({
                user: firebase.auth().currentUser.uid,
                rate: this.state.starCount
            }).then((res) => {
                let path = firebase.database().ref('users/' + this.state.getDetails.driver + '/ratings/');
                path.once('value', snapVal => {
                    if (snapVal.val()) {
                        // rating calculation
                        let ratings = snapVal.val().details;
                        var total = 0;
                        var count = 0;
                        for (let key in ratings) {
                            count = count + 1;
                            total = total + ratings[key].rate;
                        }
                        let fRating = total / count;
                        if (fRating) {
                            //avarage Rating submission
                            firebase.database().ref('users/' + this.state.getDetails.driver + '/ratings/').update({ userrating: parseFloat(fRating).toFixed(1) }).then(() => {

                                //Rating for perticular booking 
                                firebase.database().ref('users/' + this.state.getDetails.driver + '/my_bookings/' + this.state.getDetails.bookingKey + '/').update({
                                    rating: this.state.starCount,
                                }).then(() => {
                                    firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/my-booking/' + this.state.getDetails.bookingKey + '/').update({
                                        skip: true,
                                        rating_queue: false
                                    }).then(res => {
                                        const first_name = this.state.getDetails.customer_first_name ? this.state.getDetails.customer_first_name : ""
                                        const notificationBody = first_name + " " + languageJSON.rate_notification_body + this.state.starCount;
                                        this.setState({ loading: false });
                                        //désactivation de la notif push lors de la notation du driver en fin de course
                                        //this.sendPushNotification(this.state.getDetails.driver,this.state.getDetails.bookingKey,notificationBody,languageJSON.rate_notification_title);
                                        console.log(this.props.navigation.popToTop())
                                        //this.props.navigation.popToTop()

                                    })
                                });
                            })
                        }
                    }
                })
            })
        } else { }

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
                        <Text style={styles.rideCancelText}>{languageJSON.no_driver_found_alert_title}</Text>
                        <Text style={styles.cancelMsgText}>{languageJSON.thanks}</Text>
                        <Button
                            title={languageJSON.no_driver_found_alert_OK_button}
                            titleStyle={styles.btnText}
                            onPress={() => { this.setState({ alertModalVisible: false, currentBookingId: null }, () => { this.props.navigation.navigate('Map') }) }}
                            buttonStyle={styles.buttonStyle}
                        />
                    </View>
                </View>
            </Modal>
        )
    }

    render() {
        const splited_name = this.state.getDetails ? this.state.getDetails.driver_name.split(" ") : "";
        const driver_name = splited_name[0] + " " + (splited_name[1] && splited_name[1].substring(0, 1)) + ".";
        return (
            <View style={styles.mainViewStyle}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.receipt}</Text>}
                    rightComponent={<Text style={styles.headerskip} onPress={() => { this.skipRating() }}>{languageJSON.skip}</Text>}
                    containerStyle={styles.headerStyle}
                    innerContainerStyles={styles.headerInnerStyle}
                />

                <View style={styles.container}>
                    {this.state.getDetails && this.state.getDetails.driver_image != '' ?
                        <Image source={{ uri: this.state.getDetails.driver_image }} style={styles.avatar} /> :
                        <Image source={require('../../assets/images/avatar.png')} style={styles.avatar} />
                    }

                    <Text style={styles.Drivername}>{driver_name}</Text>

                    <View style={styles.leftViewContainerStyle} >
                        <View style={styles.leftViewHeaderContainerStyle}>
                            <Text style={styles.dateViewTextStyle}>{this.state.getDetails ? moment(this.state.getDetails.tripdate).format("DD.MM.YYYY") + " à " + moment(this.state.getDetails.trip_start_time).format("HH[h]mm") : null}</Text>
                            <Text style={styles.priceViewTextStyle}>{this.state.getDetails ? this.state.getDetails.customer_paid > 0 ? parseFloat(this.state.getDetails.customer_paid).toFixed(0) + " " + this.state.settings.symbol : 0 : null}</Text>
                        </View>
                        <View style={styles.leftViewInnerContainerStyle} >
                            <Path border={4} />
                            <View flex={1} >
                                <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                                <Text style={[styles.placeStyle]} numberOfLines={1} >{this.state.paramData ? this.state.paramData.pickup.add : ""}</Text>
                                <View style={styles.separator} />
                                <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                                <Text style={[styles.placeStyle]} numberOfLines={1} >{this.state.paramData ? this.state.paramData.drop.add : ""}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.ratingContainer}>
                        <Text style={styles.summaryText}>{languageJSON.rate_ride} </Text>
                        <StarRating
                            disabled={false}
                            maxStars={5}
                            starSize={40}
                            fullStar={fullStar}
                            halfStar={'star-half'}
                            emptyStar={emptyStar}
                            iconSet={'Ionicons'}
                            fullStarColor={colors.SECONDARY}
                            emptyStarColor={colors.SECONDARY}
                            halfStarColor={colors.SECONDARY}
                            rating={this.state.starCount}
                            selectedStar={(rating) => this.onStarRatingPress(rating)}
                            buttonStyle={{ padding: 20 }}
                        />
                    </View>
                    <Button
                        title={languageJSON.submit_rating}
                        titleStyle={styles.btnText}
                        onPress={() => this.submitNow()}
                        loading={this.state.loading}
                        loadingProps={{ color: colors.BUTTON_TEXT }}
                        buttonStyle={styles.buttonStyle}
                        disabled={this.state.starCount > 0 ? false : true}
                    />
                    {this.alertModal()}
                </View>
            </View>
        )
    }
}
const styles = StyleSheet.create({
  headerInnerStyle: {
        marginLeft: 10,
        marginRight: 10
    },
    mainViewStyle: {
        flex: 1,
        backgroundColor: colors.WHITE,

    },
    headerStyle: {
        zIndex: 2,
        paddingHorizontal: 0,
        borderBottomWidth: 0,
        marginBottom: 30,
        marginHorizontal: 20
    },
    headerTitleStyle: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    container: {
        flex: 1,
        justifyContent: "flex-end"
    },
    headerskip: {
        color: colors.PRIMARY,
        fontFamily: 'Montserrat-Regular',
        fontSize: 16
    },
    alertModalContainer: {
        backgroundColor: "rgba(0,0,0,.4)",
        flex: 1,
        justifyContent: "center",
        padding: 20,
    },
    alertModalInnerContainer: {
        backgroundColor: colors.WHITE,
        borderRadius: 10,
        paddingTop: 20,
        paddingHorizontal: 10,
    },
    rideCancelText: {
        color: colors.TEXT_DARK,
        fontFamily: 'Montserrat-Bold',
        fontSize: 25,
        textAlign: 'center',
        marginBottom: 20
    },
    cancelMsgText: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Light',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30
    },
    //
    leftViewContainerStyle: {
        backgroundColor: colors.ITEM,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 10,
        marginBottom: 15,
        marginHorizontal: 20

    },
    leftViewInnerContainerStyle: {
        flexDirection: 'row',
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
    leftViewHeaderContainerStyle: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 15,
    },
    dateViewTextStyle: {
        fontFamily: "Montserrat-Light",
        fontSize: 12,
        color: colors.TEXT

    },
    priceViewTextStyle: {
        fontFamily: "Montserrat-Bold",
        fontSize: 14,
        color: colors.TEXT_DARK
    },
    summaryText: {
        color: colors.TEXT_DARK,
        fontFamily: 'Montserrat-Light',
        fontSize: 12,
        alignSelf: "center",
    },
    Drivername: {
        color: colors.TEXT_DARK,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20,
        alignSelf: "center",
        marginBottom: 20
    },
    buttonStyle: {
        height: 50,
        elevation: 0,
        backgroundColor: colors.PRIMARY,
        borderColor: colors.TRANSPARENT,
        borderWidth: 0,
        borderRadius: 10,
        marginBottom: 30,
        marginHorizontal: 20

    },
    btnText: {
        fontSize: 14,
        color: colors.BUTTON_TEXT,
        fontFamily: 'Montserrat-Bold',
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 70 / 2,
        alignSelf: 'center',
        marginBottom: 10,
        backgroundColor: colors.ITEM
    },
    ratingContainer: {
        borderTopWidth: 8,
        borderBottomWidth: 8,
        borderColor: colors.ITEM,
        paddingTop: 15,
        marginBottom: 30,
    }
});