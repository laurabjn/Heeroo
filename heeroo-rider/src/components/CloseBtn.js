import React from 'react';
import { 
    StyleSheet,
    TouchableOpacity,
  } from 'react-native';
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/AntDesign';

export default class CloseBtn extends React.Component {

  render() {
    return (
        <TouchableOpacity style={[styles.backButton,this.props.style]} onPress={this.props.onPress}>
            <Icon name="close" size={Platform.OS == "ios" ?30 :25} color="#727e8b" />
        </TouchableOpacity>
    );
  }
}

//style for this component
const styles = StyleSheet.create({
     backButton: {
        marginVertical:10,
        backgroundColor: colors.ITEM,
        alignSelf:"flex-start",
        
        width: Platform.OS == "ios" ? 44:44,
        height: Platform.OS == "ios" ? 44:44,
        borderRadius: Platform.OS == "ios" ? 44:44,
        alignItems:"center",
        justifyContent:"center",
    },
});
