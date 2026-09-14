import React from 'react';
import { Text, View, Image, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { colors } from '../common/theme';
//make a compontent
const SideMenuHeader = ({ userName, userEmail }) => {
    return (
        <View style={styles.viewStyle}>
            <Text style={styles.ProfileNameStyle}>{userName}</Text>
            <Text style={styles.emailStyle}>{userEmail ? userEmail.toLowerCase() : ""}</Text>
        </View>
    );

};

//style for this component
const styles = {
    viewStyle: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
        paddingBottom: 70,
    },
    ProfileNameStyle: {
        color: colors.WHITE,
        fontFamily: "Montserrat-SemiBold",
        fontSize: 22,
        marginBottom: 10
    },
    emailStyle: {
        color: colors.DRAWER_TEXT,
        fontFamily: "Montserrat-Regular",
        fontSize: 13,
    },

}
//make the component available to other parts of the app
export default SideMenuHeader;