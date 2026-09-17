import React from 'react';
import {
    StyleSheet,
    View,
    Image,
    Dimensions,
    Text,
    TouchableOpacity,
    ScrollView,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Alert,
    Switch
} from 'react-native';
import { Icon, Header } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';

import { colors } from '../common/theme';

var { width, height } = Dimensions.get('window');
import { checkCameraPermission } from '../common/permission';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';;
import languageJSON from '../common/language';
import { DrawerToggle } from '../components';


export default class ProfileScreen extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            firstName: '',
            lastName: '',
            profile_image: null,
            loader: false,
            checked: true
        }
    }

    async UNSAFE_componentWillMount() {
        var curuser = firebase.auth().currentUser;
        this.setState({ currentUser: curuser }, () => {
            const userData = firebase.database().ref('users/' + this.state.currentUser.uid);
            userData.on('value', userData => {
                if (userData.val()) {
                    this.setState({ ...userData.val() }, (res) => {
                    });
                }

            })
        })

    }

    showActionSheet = () => {
        Alert.alert(
            languageJSON.photo_upload_action_sheet_title,
            null,
            [
                { text: languageJSON.camera, onPress: () => this._pickImage('camera') },
                { text: languageJSON.galery, onPress: () => this._pickImage('library') },
                { text: languageJSON.cancel, style: 'cancel' },
            ],
            { cancelable: true }
        );
    }

    _pickImage = async (source) => {
        const permission = source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
            return;
        }
        const options = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
        this.setState({ loader: true });
        try {
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (!result.canceled && result.assets && result.assets.length > 0) {
                await this.uploadmultimedia(result.assets[0].uri);
            } else {
                this.setState({ loader: false });
            }
        } catch (e) {
            console.log('pickImage error', e);
            this.setState({ loader: false });
        }
    };

    //upload picture function
    async uploadmultimedia(uri) {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const imageRef = firebase.storage().ref().child(`users/${this.state.currentUser.uid}`);
            await imageRef.put(blob);
            const url = await imageRef.getDownloadURL();
            await firebase.database().ref('/users/' + this.state.currentUser.uid + '/').update({ profile_image: url });
            this.setState({ loader: false, profile_image: url });
        } catch (error) {
            console.log('[ProfileScreen] upload photo échoué', error);
            this.setState({ loader: false });
            Alert.alert(languageJSON.Error || 'Erreur', "L'envoi de la photo a échoué. Réessayez.");
        }
    }

    editProfile = () => {
        this.props.navigation.push('editUser');
    }


    loader() {
        return (
            <View style={[styles.loadingcontainer, styles.horizontal]}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        )
    }

    //sign out and clear all async storage
    async signOut() {
        firebase.auth().signOut().then(() => {
            props.navigation.reset({
                index: 0,
                routes: [{ name: 'AuthLoading' }],
            })
        });

    }

    //Delete current user
    async deleteAccount() {
        Alert.alert(
            languageJSON.confrim,
            languageJSON.delete_account_question,
            [
                {
                    text: languageJSON.cancel,
                    onPress: () => console.log('Cancel Pressed'),
                    style: 'cancel',
                },
                {
                    text: languageJSON.yes, onPress: () => {
                        var ref = firebase.database().ref('users/' + this.state.currentUser.uid + '/')
                        ref.remove().then(() => {
                            this.signOut();
                            firebase.auth().currentUser.delete()
                        });
                    }
                },
            ],
            { cancelable: false },
        );
    }

    onChangeFunction(data) {
        if (data == true) {
            firebase.database().ref(`/users/` + this.state.currentUser.uid + '/').update({
                driverActiveStatus: false
            }).then(() => {
                this.setState({ driverActiveStatus: false });
            })
        } else if (data == false) {
            firebase.database().ref(`/users/` + this.state.currentUser.uid + '/').update({
                driverActiveStatus: true
            }).then(() => {
                this.setState({ driverActiveStatus: true });
            })
        }
    }

    render() {
        let { image } = this.state;
        return (
            <View style={styles.mainView}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.my_profile}</Text>}
                    containerStyle={styles.headerStyle}
                />
                <ScrollView style={styles.scrollStyle}>
                    <View style={styles.scrollViewStyle} >
                        <Text style={styles.profStyle}>{languageJSON.active_status}</Text>
                        <Switch
                            style={styles.switchAlignStyle}
                            value={this.state.driverActiveStatus}
                            onValueChange={() => {
                                this.onChangeFunction(this.state.driverActiveStatus);
                            }}
                        />
                    </View>

                    <View style={styles.viewStyle}>
                        <View style={styles.imageParentView}>
                            <View style={styles.imageViewStyle} >
                                {
                                    this.state.loader == true ? this.loader() : <TouchableOpacity onPress={this.showActionSheet}>
                                        <Image source={this.state.profile_image ? { uri: this.state.profile_image } : require('../../assets/images/avatar.png')} style={{ borderRadius: 95 / 2, width: 95, height: 95 }} />
                                    </TouchableOpacity>
                                }
                            </View>
                        </View>
                        <View flex={1} >
                            <Text style={styles.textPropHelloStyle} >{languageJSON.hello}</Text>
                            <Text style={styles.textPropStyle} >{this.state.firstName + " " + this.state.lastName}</Text>
                        </View>
                        <Icon
                            size={20}
                            name='pencil'
                            type='simple-line-icon'
                            color={colors.TEXT}
                            onPress={this.editProfile}
                            containerStyle={styles.editIconStyle}
                        />
                    </View>

                    <View style={styles.newViewStyle}>
                        <View style={styles.myViewStyle}>
                            <Text style={styles.text1}>{languageJSON.email}</Text>
                            <Text style={styles.text2}>{this.state.email}</Text>
                        </View>

                        <View style={styles.myViewStyle}>
                            <Text style={styles.text1}>{languageJSON.mobile_no}</Text>
                            <Text style={styles.text2}>{this.state.mobile}</Text>
                        </View>

                        <View style={styles.myViewStyle}>
                            <Text style={styles.text1}>{languageJSON.companyName}</Text>
                            <Text style={styles.text2}>{this.state.companyName ? this.state.companyName : " -"}</Text>
                        </View>
                        <View style={styles.myViewStyle}>
                            <Text style={styles.text1}>{languageJSON.companyAddress}</Text>
                            <Text style={styles.text2}>{this.state.companyAddress ? this.state.companyAddress : " -"}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={[styles.deleteView, { marginTop: 30 }]} onPress={() => { this.deleteAccount() }}>
                        <Text style={styles.deleteText}>{languageJSON.delete_account}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { this.signOut() }} style={styles.logoutView}>
                        <Text style={styles.logoutText}>{languageJSON.sign_out}</Text>
                    </TouchableOpacity>
                </ScrollView>

            </View>
        );
    }
}

//Screen Styling
const styles = StyleSheet.create({
    headerStyle: {
        borderBottomWidth: 0,
        paddingHorizontal: 20
    },
    headerTitleStyle: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    logo: {
        flex: 1,
        position: 'absolute',
        top: 110,
        width: '100%',
        justifyContent: "flex-end",
        alignItems: 'center'
    },
    footer: {
        flex: 1,
        position: 'absolute',
        bottom: 0,
        height: 150,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center'
    },
    scrollStyle: {
        flex: 1,
        height: height,
        backgroundColor: colors.WHITE
    },
    scrollViewStyle: {
        marginTop: 20,
        marginHorizontal: 10,
        padding: 20,
        borderRadius: 10,
        backgroundColor: colors.ITEM,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    profStyle: {
        fontSize: 14,
        color: colors.TEXT,
        fontFamily: 'Montserrat-Light'
    },
    viewStyle: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        marginHorizontal: 28
    },
    imageParentView: {
        width: 111,
        height: 111,
        borderRadius: 111 / 2,
        borderStyle: "solid",
        borderWidth: 2,
        borderColor: colors.SECONDARY,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20
    },
    imageViewStyle: {
        borderRadius: 95 / 2,
        width: 95,
        height: 95,
        backgroundColor: "#e2e6ec",
        justifyContent: 'center',
        alignItems: 'center'
    },
    textPropHelloStyle: {
        fontSize: 14,
        color: colors.TEXT_LIGHT,
        fontFamily: 'Montserrat-Light',
    },
    textPropStyle: {
        fontSize: 16,
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
    },
    newViewStyle: {
        flex: 1,
        marginTop: 30,
        borderTopColor: colors.SEPARATOR,
        borderTopWidth: 1,
        paddingHorizontal: 20
    },
    myViewStyle: {
        flexDirection: 'row',
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomColor: colors.SEPARATOR,
        borderBottomWidth: 1,
        paddingVertical: 20,
        paddingHorizontal: 10
    },
    text1: {
        fontSize: 14,
        color: colors.TEXT_LIGHT,
        fontFamily: 'Montserrat-Light',
    },
    text2: {
        flex: 1,
        fontSize: 14,
        color: colors.TEXT,
        fontFamily: 'Montserrat-Light',
        textAlign: 'right',
    },
    mainView: {
        flex: 1,
        backgroundColor: colors.WHITE,

    },
    loadingcontainer: {
        flex: 1,
        justifyContent: 'center'
    },
    editIconStyle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: colors.TEXT,
        justifyContent: 'center',
        alignItems: 'center'
    },
    deleteView: {
        borderColor: colors.ITEM,
        borderBottomWidth: 10,
        borderTopWidth: 10,
        paddingVertical: 20,
        alignItems: 'center',
    },
    deleteText: {
        fontSize: 12,
        color: colors.DANGER,
        fontFamily: 'Montserrat-Regular',
    },
    logoutView: {
        backgroundColor: colors.PRIMARY,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
        borderRadius: 10,
        marginHorizontal: 20
    },
    logoutText: {
        fontSize: 12,
        color: colors.BUTTON_TEXT,
        fontFamily: 'Montserrat-Bold',
    }
});
