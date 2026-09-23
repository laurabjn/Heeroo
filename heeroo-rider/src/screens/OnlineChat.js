import React, { Component } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Dimensions,
  Keyboard,
  TextInput,
  TouchableWithoutFeedback,
  StatusBar,
  Alert,
    Platform,
} from "react-native";
import { colors } from "../common/theme";
import { Icon, Header } from "@rneui/themed";
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/firestore';
import languageJSON from '../common/language';
var { height } = Dimensions.get('window');
import { RequestPushMsg } from '../common/RequestPushMsg';
import { BackBtn } from '../components'
import moment from 'moment'
import { formatDateTime } from '../common/dateFormat';
export default class OnlineChat extends Component {
  getParamData;
  constructor(props) {
    super(props);
    this.state = {
      search: "",
      text: "",
      data: "",
      tempData: [],
      persons: [],
      messages: [],
      driverName: "",
      inputmessage: "",
      messegeData: [],
      user: "",
      flag: false,
      position: 'absolute',
      paddingHeight: 0,
      messageCntHeight: height - 150,
      carbookedInfo: "",
      id: "",
      chat: false,
      allChat: [],
      messegesData: []

    };
  }


  componentDidMount() {
    this.getParamData = this.props.route.params.passData
    let bookingData = firebase.database().ref('bookings/' + this.getParamData.bokkingId)
    bookingData.on('value', response => {
      if (response.val()) {
        this.setState({ carbookedInfo: response.val() })
      }
    })
    let msgData = firebase.database().ref(`chat/` + this.getParamData.bokkingId + '/message')
    msgData.on('value', msgData => {
      let rootEntry = msgData.val();
      let allMesseges = []
      for (let key in rootEntry) {
        let entryKey = rootEntry[key]
        for (let msgKey in entryKey) {
          entryKey[msgKey].smsId = msgKey
          allMesseges.push(entryKey[msgKey])
        }

      }
      this.setState({ allChat: allMesseges })
    })
    this.keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      this._keyboardDidShow,
    );
    this.keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      this._keyboardDidHide,
    );
  }


  componentWillUnmount() {
    this.keyboardDidShowListener.remove();
    this.keyboardDidHideListener.remove();
  }
  _keyboardDidShow = (e) => {
    if (this.state.position !== 'relative') {
      this.setState({
        position: 'relative', paddingHeight: e.endCoordinates.height
      }, () => {

      })
    }
  }

  _keyboardDidHide = (e) => {
    if (this.state.position !== 'absolute') {
      this.setState({
        position: 'absolute', paddingHeight: 0
      }, () => {
      })
    }
  }


  sendMessege(inputmessage) {
    let totalId = this.state.carbookedInfo.customer + ',' + this.state.carbookedInfo.driver
    this.setState({ id: totalId })

    if (inputmessage == '' || inputmessage == undefined || inputmessage == null) {
      Alert.alert(languageJSON.alert, languageJSON.chat_empty_message);
    } else {
      let chat = firebase.database().ref('chat')
      // if(chat){
      chat.once('value', chat => {
        const splited_name = this.state.carbookedInfo ? this.state.carbookedInfo.customer_name.split(" ") : "";
        const customer_name = splited_name[0] + " " + (splited_name[1] && splited_name[1].substring(0, 1)) + ".";
        const notificationBody = "Le passager " + customer_name + " Vous envoyez un message: \n" + inputmessage;
        if (chat.val()) {
          let allChat = chat.val();
          for (let key in allChat) {
            if (this.getParamData.bokkingId == key) {
              this.setState({ chat: true })
            }
          }
          if (this.state.chat == true) {
            firebase.database().ref('chat' + '/' + this.getParamData.bokkingId + '/' + 'message' + '/' + this.state.id).push({
              message: inputmessage,
              from: this.state.carbookedInfo.customer,
              type: "msg",
              msgDate: firebase.database.ServerValue.TIMESTAMP,
              msgTime: firebase.database.ServerValue.TIMESTAMP,
              source: "rider"
            }).then(() => {
              // Notification de chat désormais envoyée par le serveur (déclencheur onChatMessage)
              // this.sendPushNotification(this.state.carbookedInfo.driver, this.getParamData.bokkingId, notificationBody, languageJSON.message_notification_title)
            })
          }
          else {
            firebase.database().ref('chat' + '/' + this.getParamData.bokkingId + '/').update({
              distance: this.state.carbookedInfo.distance,
              car: this.state.carbookedInfo.carType,
              bookingId: this.getParamData.bokkingId
            }).then(() => {
              firebase.database().ref('chat' + '/' + this.getParamData.bokkingId + '/' + 'message' + '/' + this.state.id).push({
                message: inputmessage,
                from: this.state.carbookedInfo.customer,
                type: "msg",
                msgDate: firebase.database.ServerValue.TIMESTAMP,
                msgTime: firebase.database.ServerValue.TIMESTAMP,
                source: "rider"
              })
              // Notification de chat désormais envoyée par le serveur (déclencheur onChatMessage)
              // this.sendPushNotification(this.state.carbookedInfo.driver, this.getParamData.bokkingId, notificationBody, languageJSON.message_notification_title)
            })
          }
        } else {
          firebase.database().ref('chat' + '/' + this.getParamData.bokkingId + '/').update({
            distance: this.state.carbookedInfo.distance,
            car: this.state.carbookedInfo.carType,
            bookingId: this.getParamData.bokkingId
          }).then(() => {
            if (this.state.id) {
              firebase.database().ref('chat' + '/' + this.getParamData.bokkingId + '/' + 'message' + '/' + this.state.id).push({
                message: inputmessage,
                from: this.state.carbookedInfo.customer,
                type: "msg",
                msgDate: firebase.database.ServerValue.TIMESTAMP,
                msgTime: firebase.database.ServerValue.TIMESTAMP,
                source: "rider"
              })
              // Notification de chat désormais envoyée par le serveur (déclencheur onChatMessage)
              // this.sendPushNotification(this.state.carbookedInfo.driver, this.getParamData.bokkingId, notificationBody, languageJSON.message_notification_title)
            } else { }

          })
        }
      })
      this.setState({ inputmessage: "" });
    }
  }

  sendPushNotification(customerUID, bookingId, msg, title) {
    const customerRoot = firebase.database().ref('users/' + customerUID);
    customerRoot.once('value', customerData => {
      if (customerData.val()) {
        let allData = customerData.val()
        RequestPushMsg(allData.pushToken ? allData.pushToken : null, msg, null, title)
      }
    })
  }
  renderItem({ item }) {
    return (

      item.source == "rider" ?
        <View style={styles.drivermsgStyle}>
          <Text style={styles.msgTextStyle}>{item ? item.message : languageJSON.chat_not_found}</Text>
          <Text style={styles.msgTimeStyle}>{item ? formatDateTime(item.msgTime) : null}</Text>
        </View>
        :
        <View style={styles.riderMsgStyle}>
          <Text style={styles.riderMsgText}>{item ? item.message : languageJSON.chat_not_found}</Text>
          <Text style={styles.riderMsgTime}>{item ? formatDateTime(item.msgTime) : null}</Text>
        </View>

    );
  }



  render() {
    return (
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <Header
          backgroundColor={colors.TRANSPARENT}
          leftComponent={<BackBtn {...this.props} />}
          containerStyle={styles.headerContainerStyle}
          centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.chat_title}</Text>}
        />
        <FlatList
          style={styles.list}
          data={this.state.allChat.reverse()}
          renderItem={this.renderItem}
          inverted
        />
        <View >
          <View style={styles.footer}>
            <TextInput
              value={this.state.inputmessage}
              style={styles.input}
              underlineColorAndroid="transparent"
              placeholder={languageJSON.chat_input_title}
              onChangeText={text => this.setState({ inputmessage: text })}
            />

            <TouchableOpacity onPress={() => this.sendMessege(this.state.inputmessage)}>
              <Text style={styles.send}>{languageJSON.send_button_text}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

}
//Screen Styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
    //marginTop: StatusBar.currentHeight,
  },
  list: {
    paddingHorizontal: 10
  },
  container1: {
    height: height - 150
  },
  container2: {
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  backIconStyle: {
    alignSelf: 'flex-start',
    marginLeft: 20
  },
  contentContainerStyle: {
    flexGrow: 1
  },
  inrContStyle: {
    marginLeft: 10,
    marginRight: 10
  },
  row: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  avatar: {
    borderRadius: 20,
    width: 40,
    height: 40,
    marginRight: 10
  },
  rowText: {
    flex: 1
  },
  message: {
    fontSize: 18
  },
  sender: {
    color: colors.PRIMARY,
    fontFamily: 'Montserrat-Bold',
    paddingRight: 10
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: colors.ITEM,
    margin: 10,
    borderRadius: 10
  },
  input: {
    paddingHorizontal: 20,
    fontSize: 12,
    flex: 1,
    color: colors.DARK,
    fontFamily: 'Montserrat-Regular',

  },
  send: {
    color: colors.PRIMARY,
    fontFamily: 'Montserrat-Bold',
    paddingRight: 10,
    padding: 20
  },
  drivermsgStyle: {
    backgroundColor: colors.ITEM,
    marginVertical: 5,
    marginLeft: 40,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  msgTextStyle: {
    fontFamily: "Montserrat-Regular",
    fontSize: 12,
    color: colors.TEXT_DARK,
  },
  msgTimeStyle: {
    fontFamily: "Montserrat-Light",
    fontSize: 10,
    color: colors.TEXT_DARK,
    textAlign: 'right'
  },
  riderMsgStyle: {
    marginVertical: 5,
    marginRight: 40,
    backgroundColor: colors.ITEM,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  riderMsgText: {
    fontFamily: "Montserrat-Regular",
    fontSize: 12,
    color: colors.TEXT_DARK,
  },
  riderMsgTime: {
    fontFamily: "Montserrat-Light",
    fontSize: 10,
    color: colors.TEXT_DARK,
    textAlign: 'right'
  },
  headerContainerStyle: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: "flex-start",
    alignItems: "center",
    borderBottomWidth: 0
  },
  headerTitleStyle: {
    color: colors.TEXT,
    fontFamily: 'Montserrat-Bold',
    fontSize: 20,
  },
});