import React, { Component } from "react";
import {
    StyleSheet,
    View,
    Text,
    KeyboardAvoidingView,
    Linking,
    Platform
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
import { facebook_id } from '../common/key';
import { colors } from '../common/theme';
import { PhoneInput } from "../components";
import Geolocation from '@react-native-community/geolocation';
import Geocoder from 'react-native-geocoding';
import { checkLocationPermission } from "../common/permission";
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
            isoCountryCode: null
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
                error => Alert.alert('Error', JSON.stringify(error)),
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
            );

        }
    }

    /*async FbLogin() {

            await Facebook.initializeAsync(facebook_id);
            const {
                type,
                token
            } = await Facebook.logInWithReadPermissionsAsync({
                permissions: ['public_profile', "email"],
            });
            if (type === 'success') {
                const credential = firebase.auth.FacebookAuthProvider.credential(token);
                firebase.auth().signInWithCredential(credential)
                    .then((user) => {
                        if (user) {
                            if (user.additionalUserInfo.isNewUser == true) {
                                var data = user.additionalUserInfo;
                                data.profile.mobile = "";
                                this.props.navigation.navigate("Reg", { requireData: data })
                            } else {
                                this.props.navigation.navigate('Root');
                            }
                        }
                    }).catch(error => {
                        alert(languageJSON.facebook_login_auth_error`${error.message}`);
                    }
                    )
            }
            else {
                alert(languageJSON.facebook_login_auth_error);
            }
        } catch ({ message }) {
            alert(languageJSON.facebook_login_auth_error`${message}`);
        }
    }

    appleSigin = async () => {

        const csrf = Math.random().toString(36).substring(2, 15);
        const nonce = Math.random().toString(36).substring(2, 10);
        const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
        try {
            const applelogincredentials = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
                state: csrf,
                nonce: hashedNonce
            });
            const provider = new firebase.auth.OAuthProvider('apple.com');
            const credential = provider.credential({
                idToken: applelogincredentials.identityToken,
                rawNonce: nonce,
            });
            firebase.auth().signInWithCredential(credential)
                .then((user) => {
                    if (user) {
                        if (user.additionalUserInfo.isNewUser == true) {
                            var data = user.additionalUserInfo;
                            this.props.navigation.navigate("Reg", { requireData: data })
                        } else {
                            this.props.navigation.navigate('Root');
                        }
                    }
                })
                .catch((error) => {
                    alert(languageJSON.apple_signin_error);
                    console.log(error);
                });

        } catch (e) {
            if (e.code === 'ERR_CANCELED') {
                console.log("Cencelled");
            } else {
                alert(languageJSON.apple_signin_error);
            }
        }
    }*/

    onPressLogin = async () => {
        const { formattedNumber } = this.phoneRef.state
        if (this.phoneRef.isValidNumber()) {
            //console.log('APP ::')

            //var applicationVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container');

            //const verificationId = await firebase.auth().signInWithPhoneNumber(formattedNumber)

            //this.setState({ verificationId: verificationId });

            /*.then(function (result) {
                    console.log('confirmationResult')
                    console.log(result)
                    this.setState({ verificationId: result });

                }).catch(function (error) {
                    console.log('error')
                    console.log(error)
                });
*/

        } else {
            alert(languageJSON.mobile_no_blank_error);
        }
    }

    onSignIn = async () => {
        try {
            const credential = firebase.auth.PhoneAuthProvider.credential(
                this.state.verificationId,
                this.state.verificationCode
            );
            await firebase.auth().signInWithCredential(credential);
            this.setState({
                phoneNumber: null,
                verificationId: null,
                verificationCode: null
            });
        } catch (err) {
            alert(languageJSON.otp_error);
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
            <View style={styles.container}>
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
                            <MaskedInput
                                style={styles.textInput}
                                mask={'000000'}
                                placeholder={languageJSON.otp_here}
                                onChangeText={(value) => this.setState({ verificationCode: value })}
                                value={this.state.verificationCode}
                                editable={!!this.state.verificationId}
                            />
                            : null}
                        {!!this.state.verificationId ?
                            <MaterialButtonDark
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
                            <TouchableOpacity style={styles.terms} onPress={() => this.openTerms()}>
                                <Text style={styles.actionText}>{languageJSON.terms}</Text>
                            </TouchableOpacity>
                        }
                    </View>
                </View>
            </View>
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
        marginBottom: 30
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
        backgroundColor: "#181717"

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
