import React from 'react';
import { 
    StyleSheet,
    TouchableOpacity,
  } from 'react-native';
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/SimpleLineIcons';


export default class NotificationBtn extends React.Component {
  render() {
    const { style, children, btnClick, buttonStyle } = this.props;
    return (
        <TouchableOpacity
            style={[styles.drawerToggle,style]}
            onPress={ ()=>{this.props.navigation.navigate("Notifications")}}>
            <Icon name="bell" size={Platform.OS == "ios" ?22 :20} color={colors.TEXT} />
        </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
    drawerToggle:{
        width: Platform.OS == "ios" ? 44:40,
        height: Platform.OS == "ios" ? 44:40,
        borderRadius: Platform.OS == "ios" ? 44:40,
        backgroundColor: colors.ITEM,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
