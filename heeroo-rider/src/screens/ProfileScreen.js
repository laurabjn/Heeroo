import React, { useState, useEffect } from 'react';
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
    Alert
} from 'react-native';
import { Icon, Header } from '@rneui/themed';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
import AsyncStorage from '@react-native-async-storage/async-storage';
var { width, height } = Dimensions.get('window');
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import { DrawerToggle } from '../components';
import * as ImagePicker from 'expo-image-picker';

export default function SideMenu(props) {

    const [profile_image, setprofile_image] = useState(null)
    const [loader, setloader] = useState(null)
    const [currentUser, setcurrentUser] = useState({})
    const [userData, setuserData] = useState({})
    const [tempAddress, settempAddress] = useState({})
    const [settings, setsettings] = useState({
        code: '',
        symbol: '',
        cash: false,
        wallet: false
    })
    useEffect(() => {

        var curuser = firebase.auth().currentUser.uid;
        const userRoot = firebase.database().ref('users/' + curuser);
        userRoot.on('value', userData => {
            if (userData.val()) {
                // L'adresse n'existe qu'une fois la position géocodée depuis la carte
                const user = userData.val();
                const str = user.location && user.location.add ? user.location.add : '';
                const parts = str.split(',');
                const tempAdd = parts.length >= 5 ? parts[3] + ',' + parts[4] : str;
                settempAddress(tempAdd)
                setuserData(user)
            }
        })
    }, []);

    useEffect(() => {
        _retrieveSettings();
    });

    const _retrieveSettings = async () => {
        try {
            const value = await AsyncStorage.getItem('settings');
            if (value !== null) {
                setsettings(JSON.parse(value))
            }
        } catch (error) {
            console.log("Asyncstorage issue 10");
        }
    };




    const showActionSheet = () => {
        Alert.alert(
            languageJSON.photo_upload_action_sheet_title,
            null,
            [
                { text: languageJSON.camera, onPress: () => _pickImage('camera') },
                { text: languageJSON.galery, onPress: () => _pickImage('library') },
                { text: languageJSON.cancel, style: 'cancel' },
            ],
            { cancelable: true }
        );
    }

    const _pickImage = async (source) => {
        const permission = source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
            return;
        }
        const options = {
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        };
        setloader(true);
        try {
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const uri = result.assets[0].uri;
                setprofile_image(uri);
                await uploadmultimedia(uri);
            }
        } catch (e) {
            console.log('pickImage error', e);
        }
        setloader(false);
    };

    const uploadmultimedia = async (uri) => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const imageRef = firebase.storage().ref().child(`users/${currentUser.uid}`);
            await imageRef.put(blob);
            const url = await imageRef.getDownloadURL();
            await firebase.database().ref('/users/' + currentUser.uid + '/').update({ profile_image: url });
            setprofile_image(url);
        } catch (error) {
            console.log('[ProfileScreen] upload photo échoué', error);
            Alert.alert(languageJSON.Error || 'Erreur', "L'envoi de la photo a échoué. Réessayez.");
        }
    }

    const editProfile = () => {
        props.navigation.push('editUser');
    }



    const getloader = () => {
        return (
            <View style={[styles.loadingcontainer, styles.horizontal]}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        )
    }

    //sign out and clear all async storage
    const signOut = async () => {
        firebase.auth().signOut().then(() => {
            props.navigation.reset({
                index: 0,
                routes: [{ name: 'AuthLoading' }],
            })
        });

    }

    //Delete current user
    const deleteAccount = async () => {
        Alert.alert(
            languageJSON.delete_account_modal_title,
            languageJSON.delete_account_modal_subtitle,
            [
                {
                    text: languageJSON.cancel,
                    onPress: () => console.log('Cancel Pressed'),
                    style: 'cancel',
                },
                {
                    text: languageJSON.yes, onPress: () => {
                        var ref = firebase.database().ref('users/' + currentUser.uid + '/')
                        ref.remove().then(() => {
                            signOut()
                            firebase.auth().currentUser.delete()
                        });
                    }
                },
            ],
            { cancelable: false },
        );
    }



    return (
        <View style={styles.mainView}>
            <Header
                backgroundColor={"transparent"}
                leftComponent={<DrawerToggle {...props} />}
                centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.profile_page_title}</Text>}
                containerStyle={styles.headerStyle}
            />
            <View style={styles.scrollStyle}>
                <View style={styles.viewStyle}>
                    <View style={styles.imageParentView}>
                        <View style={styles.imageViewStyle} >
                            {
                                loader == true ? getloader() : <TouchableOpacity onPress={showActionSheet}>
                                    <Image source={profile_image ? { uri: profile_image } : require('../../assets/images/avatar.png')} style={{ borderRadius: 95 / 2, width: 95, height: 95 }} />
                                </TouchableOpacity>
                            }
                        </View>
                    </View>
                    <View flex={1} >
                        <Text style={styles.textPropHelloStyle} >{languageJSON.hello}</Text>
                        <Text style={styles.textPropStyle} >{userData.firstName + " " + userData.lastName}</Text>
                    </View>
                    <Icon
                        size={20}
                        name='pencil'
                        type='simple-line-icon'
                        color={colors.TEXT}
                        onPress={editProfile}
                        containerStyle={styles.editIconStyle}
                    />
                </View>

                <View style={styles.newViewStyle}>
                    <View style={styles.myViewStyle}>
                        <Text style={styles.text1}>{languageJSON.email_placeholder}</Text>
                        <Text style={styles.text2}>{userData.email}</Text>
                    </View>
                    <View style={styles.myViewStyle}>
                        <Text style={styles.text1}>{languageJSON.mobile_no_placeholder}</Text>
                        <Text style={styles.text2}>{userData.mobile}</Text>
                    </View>

                </View>

                <TouchableOpacity style={styles.deleteView} onPress={() => { deleteAccount() }}>
                    <Text style={styles.deleteText}>{languageJSON.delete_account_lebel}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { signOut() }} style={styles.logoutView}>
                    <Text style={styles.logoutText}>{languageJSON.logout}</Text>
                </TouchableOpacity>

            </View>

        </View>
    );
}

//Screen Styling
const styles = StyleSheet.create({
    horizontal: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10,
    },
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
        color: colors.GREY.btnPrimary,
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
