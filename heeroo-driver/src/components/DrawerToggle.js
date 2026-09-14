import React from 'react';
import {
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/Ionicons';


export default class DrawerToggle extends React.Component {

    toggleDrawer = () => {
        this.props.navigation.toggleDrawer();
    }
    render() {
        const { style } = this.props;
        return (
            <TouchableOpacity
                style={[styles.drawerToggle, style]}
                onPress={this.toggleDrawer}>
                <Icon name="md-menu" size={Platform.OS == "ios" ? 26 : 25} color={colors.TEXT} />
            </TouchableOpacity>
        );
    }
}

const styles = StyleSheet.create({
    drawerToggle: {
        width: Platform.OS == "ios" ? 46 : 36,
        height: Platform.OS == "ios" ? 46 : 36,
        borderRadius: Platform.OS == "ios" ? 46 : 36,
        backgroundColor: colors.ITEM,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
