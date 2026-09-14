import React from 'react';
import { 
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/EvilIcons';


export default class SearchBtn extends React.Component {
  render() {
    const { style, onPress } = this.props;
    return (
        <TouchableOpacity
            style={[styles.drawerToggle,style]}
            onPress={onPress}>
            <Icon name="search" size={Platform.OS == "ios" ?30 :25} color="#727e8b" />
        </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
    drawerToggle:{
        width: Platform.OS == "ios" ? 44:36,
        height: Platform.OS == "ios" ? 44:36,
        borderRadius: Platform.OS == "ios" ? 44:36,
        backgroundColor: colors.ITEM,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
