import React, { Component } from "react";
import {
    StyleSheet,
    View,
    ImageBackground,
    Text,
    Dimensions,
    KeyboardAvoidingView,
    Alert,
    TextInput,
    Image,
    Keyboard
} from "react-native";
import MaterialButtonDark from "../components/MaterialButtonDark";
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import languageJSON from '../common/language';
import { colors } from '../common/theme';
import { TouchableOpacity } from "react-native-gesture-handler";
import { Header } from 'react-native-elements';
import { checkUserEmail } from "../helpers/user";

export default class EmailLoginScreen extends Component {
    state = {
        email: '',
        password: '',
        confirmpassword: '',
        customStyleIndex: 0,
        loading: false,
    }

    onAction = async () => {
        this.setState({ loading: true });
        const { email, password, confirmpassword, customStyleIndex } = this.state;
        if (this.validateEmail(email)) {
            if (password != '') {
                try {
                    const signIn = await firebase.auth().signInWithEmailAndPassword(email, password)
                    if (signIn) {
                        this.setState({ loading: false });
                    }
                } catch (error) {
                    this.emailInput.focus();
                    if (error.code == "auth/user-not-found") {
                        const check = await checkUserEmail(email)
                        if (check?.equal) {
                            Alert.alert(
                                languageJSON.emailExistInPhoneAccountTitle,
                                languageJSON.emailExistInPhoneAccount,
                                [
                                    {
                                        text: languageJSON.ok,
                                        onPress: () => {
                                            this.props.navigation.navigate("EmailLogin")
                                        },
                                        style: 'cancel',
                                    }
                                ]
                            )
                        } else {
                            Alert.alert(
                                "",
                                languageJSON.email_uncorrect,
                                [
                                    { text: languageJSON.ok, onPress: () => { }, style: 'cancel', }
                                ]
                            )
                        }
                    } else {
                        Alert.alert(
                            "",
                            languageJSON.password_uncorrect,
                            [
                                { text: languageJSON.ok, onPress: () => { }, style: 'cancel', }
                            ]
                        )
                    }
                    this.setState({
                        email: '',
                        password: '',
                        confirmpassword: '',
                        loading: false,
                    });
                }
            } else {
                this.passInput.focus();
                alert(languageJSON.password_blank_messege);
                this.setState({ loading: false });
            }
        } else {
            this.setState({ loading: false });
        }
    }

    validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        const emailValid = re.test(email);
        if (!emailValid) {
            this.emailInput.focus();
            alert(languageJSON.valid_email_check);
        }
        return emailValid;
    }

    async Forgot_Password(email) {
        if (this.validateEmail(email)) {

            Alert.alert(
                languageJSON.forgot_password_link,
                languageJSON.forgot_password_confirm,
                [
                    { text: languageJSON.cancel, onPress: () => { }, style: 'cancel', },
                    {
                        text: languageJSON.ok,
                        onPress: () => {
                            firebase.auth().sendPasswordResetEmail(email).then(function () {
                                alert(languageJSON.forgot_password_success_messege);
                            }).catch(async function (error) {
                                console.log(error);
                                const check = await checkUserEmail(email)
                                if (check?.equal) {
                                    Alert.alert(
                                        languageJSON.emailExistInPhoneAccountTitle,
                                        languageJSON.resetEmailExistInPhoneAccount,
                                        [
                                            {
                                                text: languageJSON.ok,
                                                onPress: () => {
                                                },
                                                style: 'cancel',
                                            }
                                        ]
                                    )
                                } else {
                                    alert(languageJSON.email_not_found);
                                }
                            });
                        },
                    }
                ],
                { cancelable: true },
            )
        }
    }

    validatePassword(password, complexity) {
        const regx1 = /^([a-zA-Z0-9@*#]{8,15})$/
        const regx2 = /(?=^.{6,10}$)(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&amp;*()_+}{&quot;:;'?/&gt;.&lt;,])(?!.*\s).*$/
        if (complexity == 'any') {
            var passwordValid = password.length >= 1;
            if (!passwordValid) {
                this.passInput.focus();
                alert(languageJSON.password_blank_messege);
            }
        }
        else if (complexity == 'alphanumeric') {
            var passwordValid = regx1.test(password);
            if (!passwordValid) {
                this.passInput.focus();
                alert(languageJSON.password_alphaNumeric_check);

            }
        }
        else if (complexity == 'complex') {
            var passwordValid = regx2.test(password);
            if (!passwordValid) {
                this.passInput.focus();
                alert(languageJSON.password_complexity_check);
            }
        }
        return passwordValid
    }

    handleCustomIndexSelect = (index) => {
        this.setState(prevState => ({ ...prevState, customStyleIndex: index }));
    }

    async openTerms() {
        Linking.openURL("https://samajakarta.com/cgu.html").catch(err => console.error("Couldn't load page", err));
    }

    navToRegister() {
        this.props.navigation.navigate("EmailRegister")
    }
    render() {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <Header
                    backgroundColor={"transparent"}
                    centerComponent={<Text style={styles.headerText}>{languageJSON.login_button}</Text>}
                    containerStyle={styles.headerContainerStyle}
                />
                <View style={styles.bg} >
                    <Text style={styles.title}>{languageJSON.email_login}</Text>

                    <TextInput
                        placeholderTextColor={"rgb(114,126,139)"}
                        ref={(ref) => { this.emailInput = ref }}
                        style={styles.textInput}
                        placeholder={languageJSON.email_placeholder}
                        onChangeText={(value) => this.setState({ email: value })}
                        autoCapitalize='none'
                        keyboardType="email-address"
                        value={this.state.email}
                    />
                    <TextInput
                        placeholderTextColor={"rgb(114,126,139)"}
                        ref={(ref) => { this.passInput = ref }}
                        style={styles.textInput}
                        placeholder={languageJSON.password_placeholder}
                        onChangeText={(value) => this.setState({ password: value })}
                        value={this.state.password}
                        autoCapitalize='none'
                        secureTextEntry={true}
                    />
                    <MaterialButtonDark
                        loading={this.state.loading}
                        onPress={this.onAction}
                        style={styles.materialButtonDark}
                    >{languageJSON.login_button}</MaterialButtonDark>

                    <Text style={styles.linkText} onPress={() => this.navToRegister()}>
                        {languageJSON.go_register_link1} <Text style={styles.linkTextBold}>{languageJSON.go_register_link2} </Text>
                    </Text>
                    <Text style={[styles.linkText, styles.mgb30]} onPress={() => this.Forgot_Password(this.state.email)}>
                        {languageJSON.forgot_password_link1} <Text style={styles.linkTextBold}>{languageJSON.forgot_password_link2} </Text>
                    </Text>
                </View>
                <TouchableOpacity style={styles.terms} onPress={() => this.openTerms()}>
                    <Text style={styles.actionText}>{languageJSON.terms}</Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        backgroundColor: "white"
    },
    headerContainerStyle: {
        borderBottomWidth: 0,
        paddingHorizontal: 0,
    },
    headerText: {
        fontSize: 22,
        color: colors.TEXT_DARK,
        fontFamily: "Montserrat-Bold",
    },
    bg: {
        flex: 1,
        justifyContent: "flex-end",
    },
    backButton: {
        marginVertical: 10,
        backgroundColor: "#f4f4f5",
        alignSelf: "flex-start",
        width: 36,
        height: 36,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
    },
    segmentcontrol: {
        color: "rgba(255,255,255,1)",
        fontSize: 18,
        fontFamily: "Montserrat-Light",
        marginTop: 0,
        alignSelf: "center",
        height: 50,
    },
    blackline: {
        width: 140,
        height: 1,
        backgroundColor: "rgba(0,0,0,1)",
        marginTop: 12,
        alignSelf: "center"
    },
    box1: {
        marginTop: 40
    },
    textInput: {
        fontSize: 14,
        fontFamily: "Montserrat-Light",
        height: 50,
        borderRadius: 10,
        backgroundColor: "#e2e6ec",
        paddingHorizontal: 19,
        color: "black",
        marginBottom: 10
    },
    materialButtonDark: {
        marginTop: 5,
        marginBottom: 29
    },
    linkTextBold: {
        fontSize: 12,
        color: colors.PRIMARY,
        fontFamily: "Montserrat-Bold",
    },
    linkText: {
        fontSize: 12,
        color: colors.TEXT,
        fontFamily: "Montserrat-Light",
        marginBottom: 15
    },
    title: {
        fontSize: 10,
        fontFamily: "Montserrat-SemiBold",
        color: colors.TEXT_DARK,
        marginBottom: 24
    },
    mgb30: {
        marginBottom: 30
    },
    terms: {
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: "center",
        opacity: .54,
        marginBottom: 10
    },
    actionText: {
        fontSize: 10,
        color: colors.TEXT,
        fontFamily: "Montserrat-Light",
    },
});