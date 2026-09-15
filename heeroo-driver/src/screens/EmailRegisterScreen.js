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
    SafeAreaView
} from "react-native";
import MaterialButtonDark from "../components/MaterialButtonDark";
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import languageJSON from '../common/language';
import { TouchableOpacity } from "react-native-gesture-handler";
import SegmentedControlTab from 'react-native-segmented-control-tab';
import Icon from 'react-native-vector-icons/Ionicons';
import { Header } from '@rneui/themed';
import { BackBtn } from '../components';
import { colors } from '../common/theme'


export default class EmailRegisterScreen extends Component {


    constructor(props) {
        super(props);
        this.state = {
            email: '',
            password: '',
            confirmpassword: '',
            customStyleIndex: 0,
            loading: false
        }
    }

    onAction = async () => {
        const { email, password, confirmpassword, customStyleIndex } = this.state;
        if (this.validateEmail(email) && this.validatePassword(password, 'alphanumeric')) {
            this.setState({ loading: true });
            if (password == confirmpassword) {
                try {
                    await firebase.auth().createUserWithEmailAndPassword(email, password)
                    this.setState({ loading: false });
                } catch (error) {
                    console.log("erreur trouvé " + error)
                    Alert.alert(languageJSON.Error, languageJSON.email_already_used);
                    this.setState({
                        email: '',
                        password: '',
                        confirmpassword: '',
                        loading: false
                    });
                    this.emailInput.focus();
                }
            } else {
                this.setState({ loading: false });
                this.confirmPassInput.focus();
                Alert.alert(languageJSON.error, languageJSON.confrim_password_not_match_err);
            }
        }
    }

    validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        const emailValid = re.test(email);
        if (!emailValid) {
            this.emailInput.focus();
            Alert.alert(languageJSON.error, languageJSON.valid_email_check);
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
                                Alert.alert(languageJSON.error, languageJSON.forgot_password_success_messege);
                            }).catch(function (error) {
                                console.log(error);
                                Alert.alert(languageJSON.error, languageJSON.email_not_found);
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
                Alert.alert(languageJSON.error, languageJSON.password_blank_messege);
            }
        }
        else if (complexity == 'alphanumeric') {
            var passwordValid = regx1.test(password);
            if (!passwordValid) {
                this.passInput.focus();
                Alert.alert(languageJSON.error, languageJSON.password_alphaNumeric_check);

            }
        }
        else if (complexity == 'complex') {
            var passwordValid = regx2.test(password);
            if (!passwordValid) {
                this.passInput.focus();
                Alert.alert(languageJSON.error, languageJSON.password_complexity_check);
            }
        }
        return passwordValid
    }

    handleCustomIndexSelect = (index) => {
        this.setState(prevState => ({ ...prevState, customStyleIndex: index }));
    };


    render() {

        return (
            <KeyboardAvoidingView behavior="padding" style={styles.container}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<BackBtn {...this.props} />}
                    centerComponent={<Text style={styles.headerText}>{languageJSON.register_link}</Text>}
                    containerStyle={styles.headerContainerStyle}
                />
                <View
                    style={styles.bg}>
                    <Text style={styles.title}>{languageJSON.register_email}</Text>

                    <TextInput
                        placeholderTextColor="#727e8b"
                        ref={(ref) => { this.emailInput = ref }}
                        style={styles.textInput}
                        placeholder={languageJSON.email_placeholder}
                        onChangeText={(value) => this.setState({ email: value })}
                        autoCapitalize='none'
                        keyboardType="email-address"
                        value={this.state.email}
                    />
                    <TextInput
                        placeholderTextColor="#727e8b"
                        ref={(ref) => { this.passInput = ref }}
                        style={styles.textInput}
                        placeholder={languageJSON.password_placeholder}
                        onChangeText={(value) => this.setState({ password: value })}
                        value={this.state.password}
                        autoCapitalize='none'
                        secureTextEntry={true}
                    />

                    <TextInput
                        placeholderTextColor="#727e8b"
                        ref={(ref) => { this.confirmPassInput = ref }}
                        style={styles.textInput}
                        placeholder={languageJSON.confrim_password_placeholder}
                        onChangeText={(value) => this.setState({ confirmpassword: value })}
                        value={this.state.confirmpassword}
                        autoCapitalize='none'
                        secureTextEntry={true}
                    />

                    <MaterialButtonDark
                        loading={this.state.loading}
                        onPress={this.onAction}
                        style={styles.materialButtonDark}
                    >{languageJSON.register_link}</MaterialButtonDark>
                    <Text style={styles.linkText} onPress={() => this.props.navigation.navigate("EmailLogin")}>
                        {languageJSON.go_login_link1} <Text style={styles.linkTextBold}>{languageJSON.go_login_link2} </Text>
                    </Text>
                </View>
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
        paddingHorizontal: 0
    },
    headerText: {
        fontSize: 22,
        color: colors.TEXT_DARK,
        fontFamily: "Montserrat-Bold",
    },
    bg: {
        flex: 1,
        justifyContent: "flex-end",
        marginBottom: 30,
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
        marginBottom: 20
    },
});