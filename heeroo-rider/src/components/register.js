import React from 'react';
import { View, Text, Dimensions, Modal, ActivityIndicator, ScrollView, KeyboardAvoidingView, Image, TouchableWithoutFeedback, LayoutAnimation, Platform, Keyboard } from 'react-native';
import Background from './Background';
import { Icon, Avatar, Button, Header, Input } from 'react-native-elements'
import { colors } from '../common/theme';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
var { height } = Dimensions.get('window');
import languageJSON from '../common/language';
import { BackBtn } from '../components'

export default class Registration extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            fname: this.props.reqData ? this.props.reqData.profile.first_name : '',
            lname: this.props.reqData ? this.props.reqData.profile.last_name : '',
            email: this.props.reqData ? this.props.reqData.profile.email : '',
            mobile: this.props.reqData ? this.props.reqData.profile.mobile : '',
            refferalId: '',
            fnameValid: true,
            lnameValid: true,
            mobileValid: true,
            emailValid: true,
            reffralIdValid: true,
            loadingModal: false
        }
    }

    // first name validation
    validateFirstName() {
        Keyboard.dismiss()
        const { fname } = this.state
        const fnameValid = fname.length > 0
        LayoutAnimation.easeInEaseOut()
        this.setState({ fnameValid })
        fnameValid || this.fnameInput.shake();
        return fnameValid
    }

    validateLastname() {
        Keyboard.dismiss()
        const { lname } = this.state
        const lnameValid = lname.length > 0
        LayoutAnimation.easeInEaseOut()
        this.setState({ lnameValid })
        lnameValid || this.lnameInput.shake();
        return lnameValid
    }

    // mobile number validation
    validateMobile() {
        Keyboard.dismiss()
        const { mobile } = this.state
        const mobileValid = (mobile.length > 0)
        LayoutAnimation.easeInEaseOut()
        this.setState({ mobileValid })
        mobileValid || this.mobileInput.shake();
        return mobileValid
    }

    // email validation
    validateEmail() {
        Keyboard.dismiss()
        const { email } = this.state
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        const emailValid = re.test(email)
        LayoutAnimation.easeInEaseOut()
        this.setState({ emailValid })
        emailValid || this.emailInput.shake()
        return emailValid
    }


    //register button press for validation
    onPressRegister() {
        const { onPressRegister } = this.props;
        LayoutAnimation.easeInEaseOut();
        const fnameValid = this.validateFirstName();
        const lnameValid = this.validateLastname();
        const emailValid = this.validateEmail();
        const mobileValid = this.validateMobile();

        if (fnameValid && lnameValid && emailValid && mobileValid) {

            if (this.state.refferalId != '') {
                this.setState({ loadingModal: true })
                const userRoot = firebase.database().ref('users/');
                userRoot.once('value', userData => {
                    if (userData.val()) {
                        let allUsers = userData.val();
                        var flag = false;
                        for (key in allUsers) {
                            if (allUsers[key].refferalId) {
                                if (this.state.refferalId.toLowerCase() == allUsers[key].refferalId) {
                                    flag = true;
                                    var referralVia = {
                                        userId: key,
                                        refferalId: allUsers[key].refferalId
                                    }
                                    break;
                                } else {
                                    flag = false;
                                }
                            }
                        }
                        if (flag == true) {
                            this.setState({ reffralIdValid: true, loadingModal: false });
                            onPressRegister(this.state.fname, this.state.lname, this.state.email, this.state.mobile, true, referralVia);
                            this.setState({ fname: '', lname: '', email: '', mobile: '', password: '', confPassword: '', refferalId: '' })
                        } else {
                            this.refferalInput.shake();
                            this.setState({ reffralIdValid: false, loadingModal: false });
                        }
                    }
                })
            } else {
                //refferal id is blank
                onPressRegister(this.state.fname, this.state.lname, this.state.email, this.state.mobile, false, null);
                this.setState({ fname: '', lname: '', email: '', mobile: '', refferalId: '' })
            }
        }
    }

    loading() {
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

    render() {

        const { onPressBack, loading } = this.props

        return (
            <View style={styles.container} >
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<BackBtn {...this.props} />}
                    centerComponent={<Text style={styles.headerStyle}>{languageJSON.registration_title}</Text>}
                    containerStyle={styles.headerContainerStyle}
                    innerContainerStyles={styles.headerInnerContainer}
                />
                <ScrollView >
                    <View style={styles.containerStyle}>
                        <View >

                            <View style={styles.textInputContainerStyle}>

                                <Input
                                    ref={input => (this.fnameInput = input)}
                                    editable={this.props.reqData.profile.first_name ? false : true}
                                    underlineColorAndroid={colors.TRANSPARENT}
                                    placeholder={languageJSON.first_name_placeholder}
                                    placeholderTextColor={colors.TEXT}
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
                                    editable={this.props.reqData.profile.last_name ? false : true}
                                    underlineColorAndroid={colors.TRANSPARENT}
                                    placeholder={languageJSON.last_name_placeholder}
                                    placeholderTextColor={colors.TEXT}
                                    value={this.state.lname}
                                    keyboardType={'email-address'}
                                    inputStyle={styles.inputTextStyle}
                                    onChangeText={(text) => { this.setState({ lname: text }) }}
                                    errorMessage={this.state.lnameValid ? null : languageJSON.last_name_blank_error}
                                    secureTextEntry={false}
                                    blurOnSubmit={true}
                                    onSubmitEditing={() => { this.validateLastname(); this.emailInput.focus() }}
                                    errorStyle={styles.errorMessageStyle}
                                    inputContainerStyle={styles.inputContainerStyle}
                                    containerStyle={styles.textInputStyle}
                                />
                            </View>


                            <View style={styles.textInputContainerStyle}>

                                <Input
                                    ref={input => (this.mobileInput = input)}
                                    editable={this.props.reqData.profile.mobile ? false : true}
                                    underlineColorAndroid={colors.TRANSPARENT}
                                    placeholder={languageJSON.mobile_no_placeholder}
                                    placeholderTextColor={colors.TEXT}
                                    value={this.state.mobile}
                                    keyboardType={'number-pad'}
                                    inputStyle={styles.inputTextStyle}
                                    onChangeText={(text) => { this.setState({ mobile: text }) }}
                                    errorMessage={this.state.mobileValid ? null : languageJSON.mobile_no_blank_error}
                                    secureTextEntry={false}
                                    blurOnSubmit={true}
                                    onSubmitEditing={() => { this.validateMobile(); this.passwordInput?.focus() }}
                                    errorStyle={styles.errorMessageStyle}
                                    inputContainerStyle={styles.inputContainerStyle}
                                    containerStyle={styles.textInputStyle}
                                />
                            </View>
                            <View style={styles.textInputContainerStyle}>

                                <Input
                                    ref={input => (this.emailInput = input)}
                                    editable={this.props.reqData.profile.email ? false : true}
                                    underlineColorAndroid={colors.TRANSPARENT}
                                    placeholder={languageJSON.email_placeholder}
                                    placeholderTextColor={colors.TEXT}
                                    value={this.state.email}
                                    keyboardType={'email-address'}
                                    inputStyle={styles.inputTextStyle}
                                    onChangeText={(text) => { this.setState({ email: text }) }}
                                    errorMessage={this.state.emailValid ? null : languageJSON.valid_email_check}
                                    secureTextEntry={false}
                                    blurOnSubmit={true}
                                    onSubmitEditing={() => { this.validateEmail(); this.mobileInput.focus() }}
                                    errorStyle={styles.errorMessageStyle}
                                    inputContainerStyle={styles.inputContainerStyle}
                                    containerStyle={styles.textInputStyle}
                                />
                            </View>
                            <View style={[styles.textInputContainerStyle]}>


                                <Input
                                    ref={input => (this.refferalInput = input)}
                                    editable={true}
                                    underlineColorAndroid={colors.TRANSPARENT}
                                    placeholder={languageJSON.referral_id_placeholder}
                                    placeholderTextColor={colors.TEXT}
                                    value={this.state.refferalId}
                                    inputStyle={styles.inputTextStyle}
                                    onChangeText={(text) => { this.setState({ refferalId: text }) }}
                                    errorMessage={this.state.reffralIdValid == true ? null : languageJSON.refferal_id_not_match_error}
                                    secureTextEntry={false}
                                    blurOnSubmit={true}
                                    inputContainerStyle={styles.inputContainerStyle}
                                    containerStyle={styles.textInputStyle}
                                />
                            </View>
                            <Button
                                onPress={() => { this.onPressRegister() }}
                                title={languageJSON.register_button}
                                loading={loading}
                                loadingProps={{ color: colors.BUTTON_TEXT }}
                                titleStyle={styles.buttonTitle}
                                buttonStyle={styles.registerButton}
                            />
                        </View>
                    </View>
                </ScrollView>
                {this.loading()}
            </View>
        );
    }
};

const styles = {
    container: {
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