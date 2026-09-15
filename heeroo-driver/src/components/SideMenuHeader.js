import React from 'react';
import { Text, View, Image, TouchableOpacity } from 'react-native';
import { Icon } from '@rneui/themed'
import { colors } from '../common/theme';
import  languageJSON  from '../common/language';
//make a compontent
const SideMenuHeader = ({headerStyle, userPhoto, userName, userEmail, onPress}) =>{

   return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.viewStyle,headerStyle]}>
                <Text style={styles.ProfileNameStyle}>{userName}</Text>
                <Text style={styles.emailStyle}>{userEmail?userEmail.toLowerCase():""}</Text>
        </TouchableOpacity>
   );

};

//style for this component
const styles = {
    viewStyle:{
        alignItems:'center',
        justifyContent:'center',
        paddingTop:60,
        paddingBottom:20,
        minHeight:150
    },
    textStyle:{
        fontSize:20,
        color:colors.WHITE
    },
    userImageView: {
        borderRadius: 50,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: colors.WHITE,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight:15
    },
    ProfileNameStyle:{
        color: colors.WHITE, 
        fontFamily:"Montserrat-SemiBold",
        fontSize: 22,
    },
    iconViewStyle:{
        justifyContent: 'center', 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginTop: 4
    },
    emailStyle:{
        color: colors.DRAWER_TEXT,
        fontFamily:"Montserrat-Regular", 
        fontSize: 13,
        textAlign:"center"
    },
    imageStyle:{
        width: 80, 
        height:80
    }
}
//make the component available to other parts of the app
export default SideMenuHeader;