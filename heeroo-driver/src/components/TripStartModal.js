import React, { Component } from "react";
import { Modal, View, StyleSheet, Text, TouchableOpacity,TextInput } from "react-native";
import { Icon, Button } from "react-native-elements";
import { colors } from "../common/theme";
import  languageJSON  from '../common/language';
export default class TripStartModal extends Component {
constructor(props) {
super(props);
this.state = {};
}
enterCode(){
        const { enterCode } = this.props;
        enterCode('entercode')
    }

render() {
const { requestmodalclose, modalvisable,onChangeText } = this.props;
return (
<Modal
visible={modalvisable}
animationType={"slide"}
transparent={true}
onRequestClose={requestmodalclose}
>
<TouchableOpacity activeOpacity={1} onPress={requestmodalclose} style={styles.container}>
  <View style={styles.modalContainer}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={requestmodalclose}
        >
        <Icon
        name="close"
        type="fontawesome"
        color={colors.BLACK}
        size={30}
        />
      </TouchableOpacity>
      <TextInput
        // value={this.state.inputmessage}
        style={styles.input}
        underlineColorAndroid="transparent"
        placeholder={languageJSON.enter_code}
        onChangeText={onChangeText}
        maxLength={5}
        />
      <Button
        titleStyle={styles.btnText}
        buttonStyle={styles.myButtonStyle}
        title={languageJSON.submit}
        onPress={()=>this.enterCode()} />
  </View>
</TouchableOpacity>
</Modal>
);
}
}
//Screen Styling
const styles = StyleSheet.create({
container: {
  flex: 1,
  justifyContent: "flex-start",
  paddingLeft:80,
  paddingTop:100,
  paddingRight:15,
  backgroundColor: "rgba(0,0,0,.4)",
},
modalContainer: {
  borderRadius: 15,
  backgroundColor: colors.WHITE,
  elevation: 15,
  padding:15
},
closeBtn:{
  alignSelf:"flex-end",
  paddingBottom:10,

},
input:{
  height:50,
  borderRadius:10,
  backgroundColor:colors.ITEM,
  marginBottom:30,
  paddingHorizontal:15
},
myButtonStyle:{
    height:50,
    borderRadius:10,
    backgroundColor:colors.PRIMARY
},
btnText:{
    color: colors.DARK,
    fontFamily:'Montserrat-Bold',
    fontSize: 12
},
});