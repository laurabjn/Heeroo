import React, { Component } from "react";
import {
    StyleSheet,
    View,
    Image,
    ImageBackground,
    Text,
    Dimensions,
    KeyboardAvoidingView,
    Linking,
    Platform,
    SafeAreaView
} from "react-native";
import MaterialButtonDark from "../components/MaterialButtonDark";
import MaskedInput from 'react-native-mask-input'
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import languageJSON from '../common/language';
import { TouchableOpacity } from "react-native-gesture-handler";
import { google_map_key } from '../common/key';
import { colors } from '../common/theme';
import { PhoneInput } from "../components";
import { checkLocationPermission } from "../common/permission";
import Geolocation from '../common/geolocation';
import Geocoder from 'react-native-geocoding';

export default class LoginScreen extends Component {

    recaptchaVerifier = null;
    firebaseConfig = firebase.apps.length ? firebase.app().options : undefined;

    constructor(props) {
        super(props);
        Geocoder.init(google_map_key);
        this.state = {
            phoneNumber: null,
            verificationId: null,
            verificationCode: null,
            loading: false,
            isoCountryCode: "sn"
        }
        this.phoneRef = null
    }

    componentDidMount() {
        this.getCountry()
    }

    getCountry = async () => {

        if (checkLocationPermission()) {

            Geolocation.getCurrentPosition(
                position => {

                    Geocoder.from(position.coords.latitude, position.coords.longitude)
                        .then(json => {

                            json.results[0].address_components.forEach(element => {
                                if (element.types[0] == "country") {
                                    isoCountryCode = element.short_name
                                }
                            });

                            this.phoneRef?.selectCountry(isoCountryCode.toLocaleLowerCase())

                        })
                        .catch((error) => {
                            console.log('error')
                            console.log(error)
                        });
                },
                error => {
                    console.log('error from current pos from login')
                    console.log(error)
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
            );
        }

    }


    onPressLogin = async () => {
        const { formattedNumber } = this.phoneRef.state
        if (this.phoneRef.isValidNumber()) {

            try {
                const phoneProvider = new firebase.auth.PhoneAuthProvider();
                const verificationId = await phoneProvider.verifyPhoneNumber(
                    formattedNumber,
                    this.recaptchaVerifier
                );
                this.setState({ verificationId: verificationId, loading: false });
            } catch (error) {
                this.setState({ loading: false });
                alert(error.message);
            }
        } else {
            this.setState({ loading: false });
            alert(languageJSON.mobile_no_blank_error);
        }
    }


    onSignIn = async () => {
        this.setState({
            loading: true
        });
        try {
            const credential = firebase.auth.PhoneAuthProvider.credential(
                this.state.verificationId,
                this.state.verificationCode
            );
            await firebase.auth().signInWithCredential(credential);
            this.setState({

                loading: false
            });
        } catch (err) {
            alert(languageJSON.otp_error);
            this.setState({
                loading: false
            });

        }
    }

    async CancelLogin() {
        this.setState({
            phoneNumber: null,
            verificationId: null,
            verificationCode: null
        });
    }

    async openTerms() {
        Linking.openURL("https://samajakarta.com/cgu.html").catch(err => console.error("Couldn't load page", err));
    }

    render() {

        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.bg}>
                    <Text style={styles.logintext}>{languageJSON.login_title}</Text>
                    <View style={styles.box1}>
                        <PhoneInput
                            initialCountry={this.state.isoCountryCode}
                            placeholder={languageJSON.mobile_no_placeholder}
                            ref={ref => this.phoneRef = ref}
                        />

                        {this.state.verificationId ? null :
                            <MaterialButtonDark
                                onPress={() => this.onPressLogin()}
                                style={styles.materialButtonDark}
                            >{languageJSON.request_otp}</MaterialButtonDark>
                        }
                        {!!this.state.verificationId ?
                            <View style={styles.box2}>
                                <MaskedInput
                                    style={styles.textInput}
                                    mask={'000000'}
                                    placeholder={languageJSON.otp_here}
                                    onChangeText={(value) => this.setState({ verificationCode: value })}
                                    value={this.state.verificationCode}
                                    editable={!!this.state.verificationId}
                                />
                            </View>
                            : null}
                        {!!this.state.verificationId ?
                            <MaterialButtonDark
                                loading={this.state.loading}
                                onPress={this.onSignIn}
                                style={styles.materialButtonDark}
                            >{languageJSON.authorize}</MaterialButtonDark>
                            : null}
                        {this.state.verificationId ?
                            <View style={styles.actionLine}>
                                <TouchableOpacity style={styles.actionItem} onPress={() => this.CancelLogin()}>
                                    <Text style={styles.actionText}>{languageJSON.cancel}</Text>
                                </TouchableOpacity>
                            </View>
                            : null}
                        {this.state.verificationId ? null :
                            <Text style={styles.sepText}>{languageJSON.spacer_message}</Text>
                        }
                        {this.state.verificationId ? null :
                            <TouchableOpacity style={styles.socialIcon} onPress={() => { this.props.navigation.navigate('EmailLogin') }}>
                                <Text style={styles.btnText}>{languageJSON.go_email_link}</Text>
                            </TouchableOpacity>
                        }
                        {this.state.verificationId ? null :
                            <View>
                                <TouchableOpacity style={styles.terms} onPress={() => this.openTerms()}>
                                    <Text style={styles.actionText}>{languageJSON.terms}</Text>
                                </TouchableOpacity>
                            </View>
                        }
                    </View>
                </View>
            </SafeAreaView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white"
    },
    bg: {
        flex: 1,
        justifyContent: "flex-end",
        marginBottom: 30
    },
    logintext: {
        color: colors.TEXT_DARK,
        fontSize: 14,
        fontFamily: "Montserrat-Light",
        marginHorizontal: 30,
        marginBottom: 23
    },
    blackline: {
        width: 140,
        height: 1,
        backgroundColor: "rgba(0,0,0,1)",
        marginTop: 12,
        alignSelf: "center"
    },
    box1: {
        paddingHorizontal: 20,
    },
    textInput: {
        height: 50,
        borderRadius: 10,
        backgroundColor: "#e2e6ec",
        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: "black",
        paddingHorizontal: 19,
        marginBottom: 13
    },
    materialButtonDark: {
        marginTop: 5,
    },
    actionLine: {
        height: 20,
        flexDirection: "row",
        marginTop: 20,
        alignSelf: 'center'
    },
    actionItem: {
        height: 20,
        marginLeft: 15,
        marginRight: 15,
        alignSelf: "center"
    },
    actionText: {
        fontSize: 12,
        color: colors.TEXT,
        fontFamily: "Montserrat-Light",
    },
    seperator: {
        flexDirection: "row",
        marginTop: 40,
        alignItems: "center"
    },
    lineLeft: {
        width: 50,
        height: 1,
        backgroundColor: "#e2e6ec"
    },
    sepText: {
        color: "#1b3443",
        fontSize: 10,
        textAlign: "center",
        fontFamily: "Montserrat-SemiBold",
        marginTop: 30
    },
    lineLeftFiller: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "center"
    },
    lineRight: {
        width: 50,
        height: 1,
        backgroundColor: "#e2e6ec"
    },
    socialIcon: {
        height: 50,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        backgroundColor: colors.SECONDARY,
        marginTop: 26
    },
    terms: {
        marginTop: 20,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: "center",
        opacity: .54
    },
    btnText: {
        color: colors.BUTTON_TEXT,
        fontSize: 12,
        letterSpacing: 0,
        fontFamily: "Montserrat-Bold",
    }
});
