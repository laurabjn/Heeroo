import React from 'react';
import { 
    StyleSheet,
    TouchableOpacity,
  } from 'react-native';
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/Feather';


export default class NavigateBtn extends React.Component {
  render() {
    const { style,onPress } = this.props;
    return (
        <TouchableOpacity
            style={[styles.drawerToggle,style]}
            onPress={onPress}>
            <Icon name="navigation" size={16} color="#727e8b" />
        </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
    drawerToggle:{
        width: 36,
        height: 36,
        borderRadius: 36,
        backgroundColor: "#c1c0c8",
        justifyContent: 'center',
        alignItems: 'center',
    }
});
