import React from 'react';
import { 
    StyleSheet,
    TouchableOpacity,
  } from 'react-native';
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/Ionicons';


export default class DrawerToggle extends React.Component {

    toggleDrawer=()=>{
        this.props.navigation.toggleDrawer();
    }
  render() {
    const { style, children, btnClick, buttonStyle } = this.props;
    return (
        <TouchableOpacity
            style={[styles.drawerToggle,style]}
            onPress={this.toggleDrawer}>
            <Icon name="md-menu" size={Platform.OS == "ios" ?30 :25} color={colors.TEXT} />
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
