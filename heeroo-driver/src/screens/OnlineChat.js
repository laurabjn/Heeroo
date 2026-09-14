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
  TouchableWithoutFeedback,
  StatusBar,
  TextInput,
  SafeAreaView
} from "react-native";
import { colors } from "../common/theme";
import { Icon, Header } from "react-native-elements";
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { RequestPushMsg } from '../common/RequestPushMsg';
var { height } = Dimensions.get('window');
import languageJSON from '../common/language';
import { BackBtn } from '../components'

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
      tripData: "",
      idFound: false,
      id: "",
      carbookedInfo: "",
      allChat: []

    };

  }

  componentDidMount() {
    this.getChat()
  }


  getChat() {
    this.getParamData = this.props.route.params.passData
    let msgData = firebase.database().ref(`chat/` + this.getParamData.bookingId + '/message')
    msgData.on('value', msgData => {
      let rootEntry = msgData.val();
      let allMessages = []
      for (let key in rootEntry) {
        let entryKey = rootEntry[key]
        for (let msgKey in entryKey) {
          entryKey[msgKey].smsId = msgKey
          allMessages.push(entryKey[msgKey])
        }

      }
      this.setState({ allChat: allMessages })
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
    if (inputmessage == '' || inputmessage == undefined || inputmessage == null) {
      alert(languageJSON.chat_blank);
    } else {
      let bookingData = firebase.database().ref('bookings/' + this.getParamData.bookingId)
      bookingData.once('value', response => {
        if (response.val()) {
          this.setState({ carbookedInfo: response.val() }, () => {
            let currentUserUid = firebase.auth().currentUser.uid
            let totalId = this.state.carbookedInfo.customer + ',' + this.state.carbookedInfo.driver
            this.setState({ id: totalId })
            const splited_name = this.state.carbookedInfo ? this.state.carbookedInfo.driver_name.split(" ") : "";
            const driver_name = splited_name[0] + " " + (splited_name[1] && splited_name[1].substring(0, 1)) + ".";
            const notificationBody = "Le chaufeur " + driver_name + languageJSON.send_msg + inputmessage;
            let chat = firebase.database().ref('chat')
            chat.once('value', chat => {
              if (chat.val()) {
                let allChat = chat.val();
                for (let key in allChat) {
                  if (this.getParamData.bookingId == key) {
                    this.setState({ idFound: true })
                  }
                }
                if (this.state.idFound == true) {
                  firebase.database().ref('chat' + '/' + this.getParamData.bookingId + '/' + 'message' + '/' + this.state.id).push({
                    message: inputmessage,
                    from: currentUserUid,
                    type: "msg",
                    msgDate: firebase.database.ServerValue.TIMESTAMP,
                    msgTime: firebase.database.ServerValue.TIMESTAMP,
                    source: "driver"
                  }).then(() => {
                    this.sendPushNotification(this.state.carbookedInfo.customer, this.getParamData.bookingId, notificationBody, languageJSON.message_notification_title);

                  })
                }
                else {
                  firebase.database().ref('chat' + '/' + this.getParamData.bookingId + '/').update({
                    distance: this.state.carbookedInfo.distance,
                    car: this.state.carbookedInfo.carType,
                    bookingId: this.getParamData.bookingId
                  }).then(() => {
                    firebase.database().ref('chat' + '/' + this.getParamData.bookingId + '/' + 'message' + '/' + this.state.id).push({
                      message: inputmessage,
                      from: currentUserUid,
                      type: "msg",
                      msgDate: firebase.database.ServerValue.TIMESTAMP,
                      msgTime: firebase.database.ServerValue.TIMESTAMP,
                      source: "driver"
                    })

                    this.sendPushNotification(this.state.carbookedInfo.customer, this.getParamData.bookingId, notificationBody, languageJSON.message_notification_title);
                  })
                }
              } else {
                firebase.database().ref('chat' + '/' + this.getParamData.bookingId + '/').update({
                  distance: this.state.carbookedInfo.distance,
                  car: this.state.carbookedInfo.carType,
                  bookingId: this.getParamData.bookingId
                }).then(() => {
                  if (this.state.id) {
                    firebase.database().ref('chat' + '/' + this.getParamData.bookingId + '/' + 'message' + '/' + this.state.id).push({
                      message: inputmessage,
                      from: currentUserUid,
                      type: "msg",
                      msgDate: firebase.database.ServerValue.TIMESTAMP,
                      msgTime: firebase.database.ServerValue.TIMESTAMP,
                      source: "driver"
                    })
                    this.sendPushNotification(this.state.carbookedInfo.customer, this.getParamData.bookingId, notificationBody, languageJSON.message_notification_title);
                  } else {
                    //alert("ID not found");
                  }
                })
              }
            })
          }
          )
        }
      })
      this.setState({ inputmessage: "" })
    }
  }

  renderItem({ item }) {
    return (

      item.source == "driver" ?
        <View style={styles.drivermsgStyle}>
          <Text style={styles.msgTextStyle}>{item ? item.message : languageJSON.chat_history_not_found}</Text>
          <Text style={styles.msgTimeStyle}>{item ? new Date(item.msgTime).toLocaleString() : ""}</Text>
        </View>
        :
        <View style={styles.riderMsgStyle}>
          <Text style={styles.riderMsgText}>{item ? item.message : languageJSON.chat_history_not_found}</Text>
          <Text style={styles.riderMsgTime}>{item ? new Date(item.msgTime).toLocaleString() : ""}</Text>
        </View>

    );
  }

  sendPushNotification = (customerUID, bookingId, msg, title) => {
    const customerRoot = firebase.database().ref('users/' + customerUID);
    customerRoot.once('value', customerData => {
      if (customerData.val()) {
        let allData = customerData.val()
        RequestPushMsg(allData.pushToken ? allData.pushToken : null, msg, null, title)
      }
    })
  }

  render() {
    return (
      <View style={styles.container}>
        <Header
          backgroundColor={colors.TRANSPARENT}
          leftComponent={<BackBtn {...this.props} />}
          containerStyle={styles.headerContainerStyle}
          centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.chat}</Text>}
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
              placeholder={languageJSON.type_messege}
              onChangeText={text => this.setState({ inputmessage: text })}
            />

            <TouchableOpacity onPress={() => this.sendMessege(this.state.inputmessage)}>
              <Text style={styles.send}>{languageJSON.send}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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