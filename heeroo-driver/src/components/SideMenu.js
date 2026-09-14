import React, { useState, useEffect } from 'react';
import { Text, View, Dimensions, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { Icon } from 'react-native-elements';
import SideMenuHeader from './SideMenuHeader';

import { colors } from '../common/theme';
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

    useEffect(() => {
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
            <DrawerItemList {...props} />
            <DrawerItem style={styles.drawerStyle} labelStyle={styles.drawerLabelStyle} label='Déconnexion' onPress={() => signOut()} />
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
    drawerLabelStyle: {
        color: 'white',
        fontFamily: 'Montserrat-Regular',
        textAlign: 'center',
        width: '100%',
        fontSize: 12,
        textTransform: 'uppercase',
    },
})