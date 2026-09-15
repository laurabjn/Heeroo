import React from 'react';
import { View, Text, Dimensions, ScrollView, StatusBar, KeyboardAvoidingView, Image, TouchableWithoutFeedback, LayoutAnimation, Platform, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Background from './Background';
import { Icon, Button, Header, Input } from '@rneui/themed';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
import { BackBtn } from '../components'
import AntDesign from "react-native-vector-icons/AntDesign";
import { Camera } from '../icons';
import firebase from 'firebase/compat/app';
import * as ImagePicker from 'expo-image-picker';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import { checkCameraPermission } from "../common/permission";
var { height } = Dimensions.get('window');

export default class DiverReg extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            fname: '',
            lname: '',
            email: this.props.reqData ? this.props.reqData.profile.email : '',
            mobile: this.props.reqData ? this.props.reqData.profile.mobile : '',
            vehicleNum: '',
            vehicleName: '',
            companyName: '',
            companyAddress: '',
            image: null,

            fnameValid: true,
            lnameValid: true,
            mobileValid: true,
            emailValid: true,
            vehicleNumValid: true,
            vehicleNameValid: true,
            imageValid: true,
            companyNameValid: true,
            companyAddressValid: true,
            file_identity_frontValid: true,
            file_identity_front: null,

            //  not implemented yet
            file_identity_backValid: true,
            file_identity_back: null,

            carteGriseValid: true,
            carteGrise: null,

            permisValid: true,
            permis: null,

            carteVTCValid: true,
            carteVTC: null,

            rirValid: true,
            rir: null,

            attestationValid: true,
            attestation: null,

            carteVerteValid: true,
            carteVerte: null,

            assuranceRCValid: true,
            assuranceRC: null,

            photoAvantVehiculeValid: true,
            photoAvantVehicule: null,

            photoChauffeurValid: true,
            photoChauffeur: null,

        }
    }

    renderFile = (key, style) => (
        <TouchableOpacity
            onPress={() => {

                this.showActionSheet(key)
            }}
            style={[styles.myViewStyle, style]} >
            <View flex={1}  >
                <Text style={styles.text1} >{languageJSON[key]}</Text>
            </View>
            {this.state[key + "_loading"] ?
                <ActivityIndicator size="small" color="red" />
                :
                <AntDesign name={this.state[key] ? "check-circle" : "plus-circle"} size={25} color={this.state[key] ? colors.PRIMARY : colors.SEPARATOR_LIGHT} />
            }
        </TouchableOpacity>
    )

    showActionSheet = (key) => {
        this.setState({ file_key: key });
        Alert.alert(
            languageJSON.photo_upload_action_sheet_title,
            languageJSON[key],
            [
                { text: languageJSON.camera, onPress: () => this._pickImage('camera') },
                { text: languageJSON.galery, onPress: () => this._pickImage('library') },
                { text: languageJSON.cancel, style: 'cancel' },
            ],
            { cancelable: true }
        );
    }

    validateFile(key) {
        const file = this.state[key];
        const valid = (file != null);
        LayoutAnimation.easeInEaseOut()
        this.setState({ [key + "Valid"]: valid })
        return valid
    }

    _pickImage = async (source) => {
        const key = this.state.file_key;
        const permission = source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
            return;
        }
        const options = { mediaTypes: ['images'], allowsEditing: false, quality: 0.7 };
        this.setState({ [key + "_loading"]: true });
        try {
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (!result.canceled && result.assets && result.assets.length > 0) {
                await this.uploadmultimedia(result.assets[0].uri);
            } else {
                this.setState({ [key + "_loading"]: false });
            }
        } catch (e) {
            console.log('pickImage error', e);
            this.setState({ [key + "_loading"]: false });
        }
    };


    async uploadmultimedia(url) {
        const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
                resolve(xhr.response); // when BlobModule finishes reading, resolve with the blob
            };
            xhr.onerror = function () {
                reject(new TypeError(languageJSON.network_request_failed)); // error occurred, rejecting
            };
            xhr.responseType = 'blob'; // use BlobModule's UriHandler
            xhr.open('GET', url, true); // fetch the blob from uri in async mode
            xhr.send(null); // no initial data
        });

        var imageRef = firebase.storage().ref().child(`users/${firebase.auth().currentUser.uid + this.state.file_key}`);

        return imageRef.put(blob).then(() => {
            blob.close()
            return imageRef.getDownloadURL()
        }).then((url) => {

            var d = new Date();
            this.setState({
                [this.state.file_key]: url,
                [this.state.file_key + "_loading"]: false
            })
        })
    }

    // first name validation
    validateFirstName() {
        const { fname } = this.state
        const fnameValid = fname.length > 0
        LayoutAnimation.easeInEaseOut()
        this.setState({ fnameValid })
        fnameValid || this.fnameInput.shake();
        return fnameValid
    }

    // last name validation
    validateLastname() {
        const { lname } = this.state
        const lnameValid = lname.length > 0
        LayoutAnimation.easeInEaseOut()
        this.setState({ lnameValid })
        lnameValid || this.lnameInput.shake();
        return lnameValid
    }

    // mobile number validation
    validateMobile() {
        const { mobile } = this.state
        const mobileValid = (mobile.length > 0)
        LayoutAnimation.easeInEaseOut()
        this.setState({ mobileValid })
        mobileValid || this.mobileInput.shake();
        return mobileValid
    }

    // email validation
    validateEmail() {
        const { email } = this.state
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        const emailValid = re.test(email)
        LayoutAnimation.easeInEaseOut()
        this.setState({ emailValid })
        emailValid || this.emailInput.shake()
        return emailValid
    }

    // vehicle name validation
    validateVehicleName() {
        const { vehicleName } = this.state;
        const vehicleNameValid = vehicleName.length >= 1
        LayoutAnimation.easeInEaseOut()
        this.setState({ vehicleNameValid })
        vehicleNameValid || this.vehicleNameInput.shake();
        return vehicleNameValid
    }

    // vehicle number validation
    validateVehicleNum() {
        const { vehicleNum } = this.state;
        var regx3 = /^[A-Z]{2}[ -][0-9]{1,2}(?: [A-Z])?(?: [A-Z]*)? [0-9]{4}$/
        // const vehicleNumValid = regx3.test(vehicleNum)
        const vehicleNumValid = vehicleNum.length >= 1
        LayoutAnimation.easeInEaseOut()
        this.setState({ vehicleNumValid })
        vehicleNumValid || this.vehicleNumInput.shake();
        return vehicleNumValid
    }

    // image upload validation
    validateImage() {
        const { image } = this.state;
        const imageValid = (image != null);
        LayoutAnimation.easeInEaseOut()
        this.setState({ imageValid })
        imageValid;
        return imageValid
    }

    validateCompanyName() {
        const { companyName } = this.state;
        const companyNameValid = companyName.length >= 1
        LayoutAnimation.easeInEaseOut()
        this.setState({ companyNameValid })
        companyNameValid || this.companyNameInput.shake();
        return companyNameValid
    }

    validateCompanyAddress() {
        const { companyAddress } = this.state;
        const companyAddressValid = companyAddress.length >= 1
        LayoutAnimation.easeInEaseOut()
        this.setState({ companyAddressValid })
        companyAddressValid || this.companyAddressInput.shake();
        return companyAddressValid
    }

    //imagepicker for license upload
    CapturePhoto = async () => {
        //permission check
        const { status: cameraStatus } = await Permissions.askAsync(Permissions.CAMERA)
        const { status: cameraRollStatus } = await Permissions.askAsync(Permissions.CAMERA_ROLL);

        if (cameraStatus === 'granted' && cameraRollStatus === 'granted') {
            let result = await ImagePicker.launchImageLibraryAsync({
                allowsEditing: true,
                aspect: [4, 3],
                // base64: true,
                quality: 1.0
            });
            if (!result.cancelled) {
                this.setState({ image: result.uri });
            }
        } else {
            throw new Error('Camera permission not granted');
        }
    }

    //upload cancel
    cancelPhoto = () => {
        this.setState({ image: null });
    }

    //register button press for validation
    onPressRegister = () => {
        const { onPressRegister } = this.props;
        LayoutAnimation.easeInEaseOut();
        const fnameValid = this.validateFirstName();
        const lnameValid = this.validateLastname();
        const mobileValid = this.validateMobile();
        const emailValid = this.validateEmail();
        const vehicleNameValid = this.validateVehicleName();
        const comanyNameValid = this.validateCompanyName();
        const companyAddressValid = this.validateCompanyAddress();
        const file_identity_frontValid = this.validateFile("file_identity_front");
        const file_identity_backValid = this.validateFile("file_identity_back");

        const carteGriseValid = this.validateFile("carteGrise");
        const permisValid = this.validateFile("permis");
        const carteVTCValid = this.validateFile("carteVTC");
        const rirValid = this.validateFile("rir");
        const attestationValid = this.validateFile("attestation");
        const carteVerteValid = this.validateFile("carteVerte");
        const assuranceRCValid = this.validateFile("assuranceRC");
        const photoAvantVehiculeValid = this.validateFile("photoAvantVehicule");
        const photoChauffeurValid = this.validateFile("photoChauffeur");



        if (fnameValid && lnameValid && mobileValid && emailValid && vehicleNameValid && comanyNameValid && companyAddressValid && file_identity_frontValid && file_identity_backValid
            && carteGriseValid && permisValid && carteVTCValid && rirValid && attestationValid && carteVerteValid && assuranceRCValid && photoAvantVehiculeValid && photoChauffeurValid) {
            console.log('success')

            onPressRegister(

                this.state.fname,
                this.state.lname,
                this.state.mobile,
                this.state.email,
                this.state.vehicleNum,
                this.state.vehicleName,
                this.state.image,
                this.state.companyName,
                this.state.companyAddress,
                this.state.file_identity_front,
                this.state.file_identity_back,
                this.state.carteGrise,
                this.state.permis,
                this.state.carteVTC,
                this.state.rir,
                this.state.attestation,
                this.state.carteVerte,
                this.state.assuranceRC,
                this.state.photoAvantVehicule,
                this.state.photoChauffeur,

            );

        } else {
            console.log('error ')
            console.log('fnameValid' + fnameValid)
            console.log('lnameValid' + lnameValid)
            console.log('mobileValid' + mobileValid)
            console.log('emailValid' + emailValid)
            console.log('vehicleNameValid' + vehicleNameValid)
            console.log('comanyNameValid' + comanyNameValid)
            console.log('companyAddressValid' + companyAddressValid)
            console.log('file_identity_frontValid' + file_identity_frontValid)
            console.log('file_identity_backValid' + file_identity_backValid)
            console.log('carteGriseValid' + carteGriseValid)
            console.log('permisValid' + permisValid)
            console.log('carteVTCValid' + carteVTCValid)
            console.log('rirValid' + rirValid)
            console.log('attestationValid' + attestationValid)
            console.log('carteVerteValid' + carteVerteValid)
            console.log('assuranceRCValid' + assuranceRCValid)
            console.log('photoAvantVehiculeValid' + photoAvantVehiculeValid)
            console.log('photoChauffeurValid' + photoChauffeurValid)
            Alert.alert(languageJSON.error, languageJSON.verify_informations);
        }
    }

    render() {
        const { loading } = this.props;
        let { image } = this.state;
        return (
            <View style={styles.container} >
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<BackBtn {...this.props} />}
                    containerStyle={styles.headerContainerStyle}
                    centerComponent={<Text style={styles.headerStyle}>{languageJSON.driver_registration}</Text>}
                />
<KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollViewStyle}>
                    <View style={styles.containerStyle}>

                        <View style={styles.textInputContainerStyle}>

                            <Input
                                ref={input => (this.fnameInput = input)}
                                editable={true}
                                returnKeyType={'next'}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.first_name}
                                placeholderTextColor={colors.TEXT}
                                value={this.state.fname}
                                keyboardType={'email-address'}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ fname: text }) }}
                                errorMessage={this.state.fnameValid ? null : languageJSON.first_name_error}
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
                                returnKeyType={'next'}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.last_name}
                                placeholderTextColor={colors.TEXT}
                                value={this.state.lname}
                                keyboardType={'email-address'}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ lname: text }) }}
                                errorMessage={this.state.lnameValid ? null : languageJSON.last_name_error}
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
                                ref={input => (this.emailInput = input)}
                                editable={true}
                                returnKeyType={'next'}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.email}
                                placeholderTextColor={colors.TEXT}
                                value={this.state.email}
                                keyboardType={'email-address'}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ email: text }) }}
                                errorMessage={this.state.emailValid ? null : languageJSON.email_blank_error}
                                secureTextEntry={false}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateEmail(); this.mobileInput.focus() }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>
                        <View style={styles.textInputContainerStyle}>

                            <Input
                                ref={input => (this.mobileInput = input)}
                                editable={this.props.reqData.profile.mobile ? false : true}
                                returnKeyType={'done'}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.mobile}
                                placeholderTextColor={colors.TEXT}
                                value={this.state.mobile}
                                keyboardType={'numeric'}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ mobile: text }) }}
                                errorMessage={this.state.mobileValid ? null : languageJSON.mobile_no_blank_error}
                                secureTextEntry={false}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateMobile(); this.vehicleNameInput.focus() }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>

                        <View style={styles.textInputContainerStyle}>

                            <Input
                                ref={input => (this.companyNameInput = input)}
                                editable={this.props.reqData.profile.companyName ? false : true}
                                returnKeyType={'done'}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.companyName}
                                placeholderTextColor={colors.TEXT}
                                value={this.state.companyName}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ companyName: text }) }}
                                errorMessage={this.state.companyNameValid ? null : languageJSON.companyName_no_blank_error}
                                secureTextEntry={false}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateCompanyName(); this.companyNameInput.focus() }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>

                        <View style={styles.textInputContainerStyle}>

                            <Input
                                ref={input => (this.companyAddressInput = input)}
                                editable={this.props.reqData.profile.companyAddress ? false : true}
                                returnKeyType={'done'}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.companyAddress}
                                placeholderTextColor={colors.TEXT}
                                value={this.state.companyAddress}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ companyAddress: text }) }}
                                errorMessage={this.state.companyAddressValid ? null : languageJSON.companyAddress_no_blank_error}
                                secureTextEntry={false}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateCompanyAddress(); this.companyAddressInput.focus() }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>

                        <View style={[styles.textInputContainerStyle]}>

                            <Input
                                ref={input => (this.vehicleNameInput = input)}
                                editable={true}
                                returnKeyType={'next'}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.vehicle_model_name}
                                placeholderTextColor={colors.TEXT}
                                value={this.state.vehicleName}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ vehicleName: text }) }}
                                errorMessage={this.state.vehicleNameValid ? null : languageJSON.vehicle_model_name_blank_error}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateVehicleName();; this.vehicleNameInput.focus() }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>

                        <View style={[styles.textInputContainerStyle]}>

                            <Input
                                ref={input => (this.vehicleNumInput = input)}
                                editable={true}
                                returnKeyType={'done'}
                                underlineColorAndroid={colors.TRANSPARENT}
                                placeholder={languageJSON.vehicle_reg_no}
                                placeholderTextColor={colors.TEXT}
                                value={this.state.vehicleNum}
                                inputStyle={styles.inputTextStyle}
                                onChangeText={(text) => { this.setState({ vehicleNum: text }) }}
                                errorMessage={this.state.vehicleNumValid ? null : languageJSON.vehicle_number_blank_err}
                                blurOnSubmit={true}
                                onSubmitEditing={() => { this.validateVehicleNum();; this.vehicleNumInput.focus() }}
                                errorStyle={styles.errorMessageStyle}
                                inputContainerStyle={styles.inputContainerStyle}
                                containerStyle={styles.textInputStyle}
                            />
                        </View>
                        {this.renderFile("file_identity_front", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.file_identity_frontValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("file_identity_back", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.file_identity_backValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("carteGrise", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.carteGriseValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("permis", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.permisValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("carteVTC", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.carteVTCValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("rir", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.rirValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("attestation", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.attestationValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("carteVerte", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.carteVerteValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("assuranceRC", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.assuranceRCValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("photoAvantVehicule", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.photoAvantVehiculeValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        {this.renderFile("photoChauffeur", { borderBottomWidth: 0, borderColor: "#e2e6ec", borderBottomWidth: 1 })}
                        {!this.state.photoChauffeurValid && <Text style={styles.errorText}>{languageJSON.valid_identityfront_check}</Text>}

                        <Button
                            onPress={() => this.onPressRegister()}
                            title={languageJSON.reg_no}
                            loading={loading}
                            loadingProps={{ color: colors.BUTTON_TEXT }}
                            titleStyle={styles.buttonTitle}
                            buttonStyle={styles.registerButton}
                        />
                    </View>
                </ScrollView>
</KeyboardAvoidingView>
            </View>
        );
    }
};

//style for this component
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
        flex: 1,
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
    },
    textInputContainerStyle: {
        flexDirection: 'row',
        alignItems: "center",
        paddingVertical: 15,
        borderColor: "#e2e6ec",
        borderBottomWidth: 1,
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
        color: colors.TEXT_DARK,
        fontFamily: 'Montserrat-Bold',
        fontSize: 16
    },
    myViewStyle: {
        flexDirection: 'row',
        justifyContent: "space-between",
        alignItems: "center",

        borderBottomColor: colors.SEPARATOR,
        borderBottomWidth: 1,
        paddingVertical: 20,
        paddingHorizontal: 10,
        flex: 1,
        minHeight: 80
    },
    text1: {
        fontSize: 14,
        color: colors.TEXT,
        fontFamily: 'Montserrat-Light',
    },
    text1Caption: {
        color: colors.TEXT_LIGHT,
        fontSize: 14,
        fontFamily: "Montserrat-Light",
    },
    text2: {
        flex: 1,
        fontSize: 14,
        color: colors.TEXT,
        fontFamily: 'Montserrat-Light',
        textAlign: 'right',
    },
}