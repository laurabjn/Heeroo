import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/Ionicons';

export default class BackBtn extends React.Component {

  render() {
    return (
      <TouchableOpacity style={[styles.backButton, this.props.style]} onPress={() => { this.props.navigation.goBack() }}>
        <Icon name="arrow-back" size={Platform.OS == "ios" ? 30 : 25} color={colors.TEXT} />
      </TouchableOpacity>
    );
  }
}

//style for this component
const styles = StyleSheet.create({
  backButton: {
    marginVertical: 10,
    backgroundColor: colors.ITEM,
    alignSelf: "flex-start",

    width: Platform.OS == "ios" ? 44 : 40,
    height: Platform.OS == "ios" ? 44 : 40,
    borderRadius: Platform.OS == "ios" ? 44 : 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
