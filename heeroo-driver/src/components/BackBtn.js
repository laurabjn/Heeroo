import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
    Platform,
} from 'react-native';
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/Ionicons';

export default class BackBtn extends React.Component {

  handlePress() {
    // onBack permet à un écran de définir son propre retour (ex. annuler l'inscription)
    if (this.props.onBack) {
      this.props.onBack();
    } else if (this.props.navigation && this.props.navigation.canGoBack()) {
      this.props.navigation.goBack();
    }
  }

  render() {
    return (
      <TouchableOpacity style={[styles.backButton, this.props.style]} onPress={() => this.handlePress()}>
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
