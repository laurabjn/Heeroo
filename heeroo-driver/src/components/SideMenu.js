import React, { useState, useEffect } from 'react';
import { Text, View, Dimensions, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Icon } from '@rneui/themed';
import SideMenuHeader from './SideMenuHeader';

import { colors } from '../common/theme';
import languageJSON from '../common/language';
import { chargerSOS, ouvrirSOS } from '../common/sos';
import AsyncStorage from '@react-native-async-storage/async-storage';

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import {
    DrawerContentScrollView,
    DrawerItemList,
    DrawerItem
} from '@react-navigation/drawer';

export default function SideMenu(props) {

    const [currentUser, setcurrentUser] = useState({})
    // Charge a l'ouverture du tiroir et non a l'appui : au moment d'appeler
    // a l'aide, il n'y a plus de temps pour attendre le reseau. Reste a null
    // si la lecture echoue, et ouvrirSOS sait s'en passer.
    const [sos, setSos] = useState(null)

    useEffect(() => {
        chargerSOS().then(setSos);
        var curuser = firebase.auth().currentUser.uid;
        const userData = firebase.database().ref('users/' + curuser);
        userData.on('value', currentUserData => {
            if (currentUserData.val()) {
                setcurrentUser(currentUserData.val())
                if (currentUserData.val().driverActiveStatus == undefined) {
                    userData.update({
                        driverActiveStatus: true
                    })
                }
            }
        })
    }, []);

    //sign out and clear all async storage
    const signOut = async () => {
        firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/pushToken').remove();
        firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/userPlatform').remove();
        AsyncStorage.clear();
        firebase.auth().signOut()
    }

    return (
        <DrawerContentScrollView {...props} style={styles.mainViewStyle} >
            <SideMenuHeader userEmail={currentUser.email} userName={currentUser.firstName + ' ' + currentUser.lastName} />
            {/* En tete de liste, et non en bas pres de la deconnexion : un
                appel a l'aide ne se cherche pas. Le tiroir s'ouvre depuis les
                huit ecrans principaux, course en cours comprise — c'est ce
                qui rend le SOS joignable partout, et non seulement pendant
                une course. */}
            <DrawerItem
                style={styles.sosStyle}
                labelStyle={styles.sosLabelStyle}
                label={languageJSON.panic_text}
                onPress={() => ouvrirSOS(sos)}
            />
            <DrawerItemList {...props} />
            <DrawerItem style={styles.drawerStyle} labelStyle={styles.drawerLabelStyle} label={languageJSON.sign_out} onPress={() => signOut()} />
        </DrawerContentScrollView>
    )
}

//style for this component
const styles = StyleSheet.create({
    myHeader: {
        marginTop: 0,
    },
    menuItemView: {
        justifyContent: 'flex-end',
        marginBottom: 40,
    },
    menuName: {
        color: colors.DRAWER_TEXT,
        fontFamily: 'Montserrat-Regular',
        textAlign: "center",
        fontSize: 12,
        textTransform: 'uppercase',
    },
    mainViewStyle: {
        backgroundColor: Platform.OS == "ios" ? colors.DRAWER_BG : colors.DRAWER_BG_ANDROID,
        height: '100%',
        shadowColor: "rgba(0, 0, 0, 0.12)",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowRadius: 10,
        shadowOpacity: 1,
        borderTopRightRadius: 25,
        borderBottomRightRadius: 25,
        overflow: 'hidden',
        paddingHorizontal: 20
    },
    blurView: {
        ...StyleSheet.absoluteFill,

    },
    compViewStyle: {
        position: 'relative',
        flex: 3
    },
    iconStyle: {
        justifyContent: 'center',
        alignItems: 'center'
    }, drawerStyle: {
        width: '100%',
        marginTop: '100%'

    },
    sosStyle: {
        width: '100%',
        marginTop: 10,
        marginBottom: 10,
    },
    // Rouge, et seul element rouge du tiroir : il ne se confond avec rien.
    sosLabelStyle: {
        color: colors.RED,
        fontFamily: 'Montserrat-Regular',
        textAlign: 'center',
        width: '100%',
        fontSize: 12,
        textTransform: 'uppercase',
    },
    drawerLabelStyle: {
        color: 'white',
        fontFamily: 'Montserrat-Regular',
        textAlign: 'center',
        width: '100%',
        fontSize: 12,
        textTransform: 'uppercase',
    },
})