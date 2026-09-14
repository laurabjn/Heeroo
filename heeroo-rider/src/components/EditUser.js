import React from 'react';
import { View, Text, Dimensions, ScrollView, KeyboardAvoidingView, Image, TouchableWithoutFeedback, LayoutAnimation, Platform } from 'react-native';
import { Icon, Button, Header, Input } from '@rneui/themed';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
var { height } = Dimensions.get('window');
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';

import { BackBtn } from '../components';

export default class EditUser extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            fname: '',
            lname: '',
            email: '',
            mobile: '',
            fnameValid: true,
            lnameValid: true,
            mobileValid: true,
            emailValid: true,
            loginType: ''
        }
    }

    async UNSAFE_componentWillMount() {
        var curuser = firebase.auth().currentUser;
        const userData = firebase.database().ref('users/' + curuser.uid);
        if (curuser.email) this.setState({ loginType: 'email' });
        userData.once('value', userData => {
            this.setState({
                fname: userData.val().firstName,
                lname: userData.val().lastName,
                email: userData.val().email,
                mobile: userData.val().mobile
            });
        })
    }


    // first name validation
    validateFirstName() {
        const { fname } = this.state;
        const fnameValid = fname.length > 0;
        LayoutAnimation.easeInEaseOut();
        this.setState({ fnameValid });
        fnameValid || this.fnameInput.shake();
        return fnameValid;
    }

    // last name validation
    validateLastname() {
        const { lname } = this.state
        const lnameValid = lname.length > 0
        LayoutAnimation.easeInEaseOut();
        this.setState({ lnameValid });
        lnameValid || this.lnameInput.shake();
        return lnameValid;
    }

    // mobile number validation
    validateMobile() {
        /*const { mobile } = this.state;
        const mobileValid = (mobile.length == 10)
        LayoutAnimation.easeInEaseOut()
        this.setState({ mobileValid })
        mobileValid || this.mobileInput.shake();
        return mobileValid;*/
        return true;
    }

    // email validation
    validateEmail() {
        const { email } = this.state
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        const emailValid = re.test(email)
        LayoutAnimation.easeInEaseOut()
        this.setState({ emailValid });
        emailValid || this.emailInput.shake()
        return emailValid;
    }


    //register button press for validation
    onPressRegister() {
        const { onPressRegister } = this.props;
        LayoutAnimation.easeInEaseOut();
        const fnameValid = this.validateFirstName();
        const lnameValid = this.validateLastname();
        const mobileValid = this.validateMobile();
        const emailValid = this.validateEmail();

        if (fnameValid && lnameValid && mobileValid && emailValid) {
            //register function of smart component
            onPressRegister(this.state.fname, this.state.lname, this.state.mobile, this.state.email);
            this.setState({ fname: '', lname: '', mobile: '', email: '' });
        }
    }

    render() {
        return (
            <View style={styles.main}>
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<BackBtn {...this.props} />}
                    containerStyle={styles.headerContainerStyle}
                    centerComponent={<Text style={styles.headerStyle}>{languageJSON.update_profile_title}</Text>}
                />
                {/* <View style={styles.logo}>
                        <Image source={require('../../assets/images/logo.png')} />
                    </View> */}
                <View style={styles.form}>
                    <View style={styles.containerStyle}>
                        <View style={styles.textInputContainerStyle}>
                            <Input
                                ref={input => (this.fnameInput = input)}
                                editable={true}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.first_name_placeholder}
                                placeholderTextColor={colors.TEXT_LIGHT}
                                value={this.state.fname}
                                keyboardType={'email-address'}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ fname: text }) }}
                                errorMessage={this.state.fnameValid ? null : languageJSON.first_name_blank_error}
                                secureTextEntry={false}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateFirstName(); this.lnameInput.focus() }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>

                        <View style={styles.textInputContainerStyle}>
                            <Input
                                ref={input => (this.lnameInput = input)}
                                editable={true}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.last_name_placeholder}
                                placeholderTextColor={colors.TEXT_LIGHT}
                                value={this.state.lname}
                                keyboardType={'email-address'}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ lname: text }) }}
                                errorMessage={this.state.lnameValid ? null : languageJSON.last_name_blank_error}
                                secureTextEntry={false}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateLastname(); this.mobileInput.focus() }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>
                        <View style={styles.textInputContainerStyle}>
                            <Input
                                ref={input => (this.mobileInput = input)}
                                editable={this.state.loginType == 'email' ? true : false}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.mobile_no_placeholder}
                                placeholderTextColor={colors.TEXT_LIGHT}
                                value={this.state.mobile}
                                keyboardType={'number-pad'}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ mobile: text }) }}
                                errorMessage={this.state.mobileValid ? null : languageJSON.mobile_no_blank_error}
                                secureTextEntry={false}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateMobile(); }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>

                        <View style={styles.textInputContainerStyle}>
                            <Input
                                ref={input => (this.emailInput = input)}
                                editable={this.state.loginType != 'email' ? true : false}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.email_placeholder}
                                placeholderTextColor={colors.TEXT_LIGHT}
                                value={this.state.email}
                                keyboardType={'email-address'}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ email: text }) }}
                                errorMessage={this.state.emailValid ? null : languageJSON.valid_email_check}
                                secureTextEntry={false}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateEmail(); }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>
                    </View>
                    <Button
                        onPress={() => { this.onPressRegister() }}
                        title={languageJSON.update_button}
                        titleStyle={styles.buttonTitle}
                        buttonStyle={styles.registerButton}
                    />
                </View>
            </View>
        );
    }
};

const styles = {
    main: {
        flex: 1,
        backgroundColor: "white"
    },
    headerContainerStyle: {
        borderBottomWidth: 0,
        paddingHorizontal: 20
    },
    headerInnerContainer: {
        marginLeft: 10,
        marginRight: 10
    },
    inputContainerStyle: {
        borderColor: "#e2e6ec",
        borderBottomWidth: 0,
    },
    textInputStyle: {

    },
    iconContainer: {
        width: 35
    },
    registerButton: {
        backgroundColor: colors.PRIMARY,
        height: 50,
        borderRadius: 10,
        borderWidth: 0,
        marginVertical: 40,
        marginHorizontal: 20
    },
    buttonTitle: {
        fontSize: 12,
        color: colors.BUTTON_TEXT,
        fontFamily: 'Montserrat-Bold',
    },
    inputTextStyle: {
        color: colors.TEXT_DARK,
        fontSize: 14,
        fontFamily: "Montserrat-Light",
        height: 32
    },
    errorMessageStyle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 0
    },
    containerStyle: {
        marginTop: 40,
        borderColor: "#e2e6ec",
        paddingHorizontal: 20,
    },
    flex1: {
        flex: 1,
        justifyContent: "flex-end"
    },
    form: {
        flex: 1,
    },
    logo: {
        width: '100%',
        justifyContent: "flex-start",
        marginTop: 10,
        alignItems: 'center',
    },
    scrollViewStyle: {
        height: height
    },
    textInputContainerStyle: {
        flexDirection: 'row',
        alignItems: "center",
        paddingVertical: 15,
        borderColor: "#e2e6ec",
        borderBottomWidth: 1,
    },
    headerStyle: {
        fontSize: 18,
        color: colors.TEXT,
        textAlign: 'center',
        flexDirection: 'row',
        marginTop: 0
    },
    capturePhoto: {
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: colors.ITEM,
        marginHorizontal: 20,
        paddingVertical: 20,
        marginTop: 15
    },
    capturePhotoTitle: {
        fontFamily: "Montserrat-Light",
        color: colors.TEXT,
        fontSize: 14,
        textAlign: 'center',
        paddingBottom: 15,

    },
    errorPhotoTitle: {
        fontFamily: "Montserrat-Light",
        color: colors.RED,
        fontSize: 13,
        textAlign: 'center',
        paddingBottom: 15,
    },
    photoResult: {
        alignSelf: 'center',
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: 10,
        marginLeft: 20,
        marginRight: 20,
        paddingTop: 15,
        paddingBottom: 10,
        marginTop: 15,
        width: '80%',
        height: height / 4
    },
    imagePosition: {
        position: 'relative'
    },
    photoClick: {
        paddingRight: 48,
        position: 'absolute',
        zIndex: 1,
        marginTop: 18,
        alignSelf: 'flex-end'
    },
    capturePicClick: {
        backgroundColor: colors.ITEM,
        flexDirection: 'row',
        position: 'relative',
        zIndex: 1
    },
    imageStyle: {
        width: 30,
        height: height / 15
    },
    flexView1: {
        flex: 12
    },
    imageFixStyle: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    imageStyle2: {
        width: 150,
        height: height / 15
    },
    myView: {
        flex: 2,
        height: 50,
        width: 1,
        alignItems: 'center'
    },
    myView1: {
        height: height / 20,
        width: 3,
        backgroundColor: colors.WHITE,
        alignItems: 'center',
        marginTop: 10
    },
    myView2: {
        flex: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    myView3: {
        flex: 2.2,
        alignItems: 'center',
        justifyContent: 'center'
    },
    textStyle: {
        color: colors.GREY.btnPrimary,
        fontFamily: 'Montserrat-Light',
        fontSize: 13
    },
    headerStyle: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    borderBottom0: {
        borderBottomWidth: 0
    },
    loadModalContainer: {
        backgroundColor: "rgba(0,0,0,.4)",
        flex: 1,
        justifyContent: "center",
        padding: 20,
    },
    loadModalInnerContainer: {
        backgroundColor: "white",
        borderRadius: 10,
        padding: 15,
        flexDirection: "row",
        alignItems: 'center',
    },
    loadModalText: {
        flex: 1,
        fontFamily: "Montserrat-SemiBold",
        fontSize: 14,
        color: colors.HOLDER_TEXT,
        marginLeft: 15
    }
}