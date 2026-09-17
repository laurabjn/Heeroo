import React, { useState, useEffect } from 'react';
import { Text, View, Dimensions, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { Icon } from '@rneui/themed';
import firebase from 'firebase/compat/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';

import SideMenuHeader from './SideMenuHeader';
import { colors } from '../common/theme';
import languageJSON from '../common/language';
var { width, height } = Dimensions.get('window');
import {
    DrawerContentScrollView,
    DrawerItemList,
    DrawerItem
} from '@react-navigation/drawer';


export default function SideMenu(props) {

    const [currentUser, setcurrentUser] = useState({})
    const [userData, setuserData] = useState({})

    useEffect(() => {
        const user = firebase.auth().currentUser;
        if (!user) return undefined;
        const userRoot = firebase.database().ref('users/' + user.uid);
        const onValue = userRoot.on('value', userData => {
            if (userData.val()) {
                setuserData(userData.val())
            }
        })
        // Détache l'écouteur quand le menu disparaît (déconnexion), sinon il
        // resterait accroché à une lecture désormais interdite par les règles.
        return () => userRoot.off('value', onValue);
    }, []);

    useEffect(() => {
        tripSatusCheck();

    })
    //sign out and clear all async storage
    const signOut = async () => {
        firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/pushToken').remove();
        firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/userPlatform').remove();
        AsyncStorage.clear();

        firebase.auth().signOut()
    }

    //CHECKING TRIP END OR START
    const tripSatusCheck = () => {
        var curuser = firebase.auth().currentUser;
        setcurrentUser(curuser)

    }

    if (currentUser) {
        return (
            <DrawerContentScrollView {...props} style={styles.mainViewStyle} >
                <SideMenuHeader userEmail={currentUser.email} userName={userData.firstName + ' ' + userData.lastName} />
                <DrawerItemList {...props} />
                <DrawerItem style={styles.drawerStyle} labelStyle={styles.drawerLabelStyle} label='Déconnexion' onPress={() => signOut()} />
            </DrawerContentScrollView>
        )
    } else {

        return (
            <></>
        )
    }
}

const styles = StyleSheet.create({
    mainViewStyle: {
        backgroundColor: '#000000',
        borderTopRightRadius: 25,
        borderBottomRightRadius: 25,
        elevation: 1,

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