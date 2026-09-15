import React from 'react';
import { View, StyleSheet, TouchableHighlight, Image, TouchableWithoutFeedback, Text, } from 'react-native';
import { Header, } from '@rneui/themed';
import languageJSON from '../common/language';
import { colors } from '../common/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import PaymentWebView from '../components/PaymentWebView';
export default class SelectGatewayPage extends React.Component {


  constructor(props) {
    super(props);
    this.state = {
      payData: null,
      providers: null,
      userdata: null,
      settings: null,
      selectedProvider: null
    };
  }


  componentDidMount() {
    let payData = this.props.route.params.payData
    let uData = this.props.route.params.allData
    let Settings = this.props.route.params.settings
    let providers = this.props.route.params.providers
    this.setState({ payData: payData, userdata: uData, settings: Settings, providers: providers });
  }


  onSuccessHandler = (order_details) => {
    if (this.state.userdata.paymentType) {
      firebase.database().ref('users/' + this.state.userdata.driver + '/my_bookings/' + this.state.userdata.bookingKey + '/').update({
        payment_status: "PAID",
        payment_mode: this.state.userdata.paymentMode,
        customer_paid: this.state.userdata.customer_paid,
        discount_amount: this.state.userdata.discount_amount,
        usedWalletMoney: this.state.userdata.usedWalletAmmount,
        cardPaymentAmount: this.state.userdata.cardPaymentAmount,
        getway: order_details.gateway,
        transaction_id: order_details.transaction_id
      }).then(() => {
        firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/my-booking/' + this.state.userdata.bookingKey + '/').update({
          payment_status: "PAID",
          payment_mode: this.state.userdata.paymentMode,
          customer_paid: this.state.userdata.customer_paid,
          discount_amount: this.state.userdata.discount_amount,
          usedWalletMoney: this.state.userdata.usedWalletAmmount,
          cardPaymentAmount: this.state.userdata.cardPaymentAmount,
          getway: order_details.gateway,
          transaction_id: order_details.transaction_id
        }).then(() => {
          firebase.database().ref('bookings/' + this.state.userdata.bookingKey + '/').update({
            payment_status: "PAID",
            payment_mode: this.state.userdata.paymentMode,
            customer_paid: this.state.userdata.customer_paid,
            discount_amount: this.state.userdata.discount_amount,
            usedWalletMoney: this.state.userdata.usedWalletAmmount,
            cardPaymentAmount: this.state.userdata.cardPaymentAmount,
            getway: order_details.gateway,
            transaction_id: order_details.transaction_id
          }).then(() => {

            if (this.state.userdata.usedWalletAmmount) {
              if (this.state.userdata.usedWalletAmmount > 0) {
                firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/walletHistory').push({
                  type: 'Debit',
                  amount: this.state.userdata.usedWalletAmmount,
                  date: firebase.database.ServerValue.TIMESTAMP,
                  txRef: this.state.userdata.bookingKey,
                }).then(() => {
                  firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/').update({
                    walletBalance: this.state.userdata.currentwlbal - this.state.userdata.usedWalletAmmount
                  })
                })
              }
            }
          })
          setTimeout(() => {
            this.props.navigation.navigate('ratingPage', { data: this.state.userdata });
          }, 3000)

        })

      })

    } else {
      let Walletballance = this.state.userdata.walletBalance + parseInt(this.state.payData.amount)
      firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/walletBalance').set(Walletballance).then(() => {
        firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/walletHistory').push({
          type: 'Credit',
          amount: parseInt(this.state.payData.amount),
          date: firebase.database.ServerValue.TIMESTAMP,
          txRef: this.state.payData.order_id,
          getway: order_details.gateway,
          transaction_id: order_details.transaction_id
        })

        setTimeout(() => {
          this.props.navigation.navigate('wallet')
        }, 3000)
      });
    }
  };

  onCanceledHandler = () => {
    console.log("onCanceledHandler");
    if (this.state.userdata.paymentType) {
      setTimeout(() => {
        this.props.navigation.navigate('CardDetails')
      }, 5000)
    } else {
      setTimeout(() => {
        this.props.navigation.navigate('wallet')
      }, 5000)
    }
  };

  goBack() {
    this.setState({ selectedProvider: null });
    this.props.navigation.goBack();
  }

  selectProvider = (provider) => {
    this.setState({ selectedProvider: provider });
  };

  render() {
    return (
      <View style={styles.container}>
        <Header
          backgroundColor={colors.GREY.default}
          leftComponent={{ icon: 'arrow-back', type: 'ionicon', color: colors.WHITE, size: 30, component: TouchableWithoutFeedback, onPress: () => { this.goBack() } }}
          centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.payment}</Text>}
          containerStyle={styles.headerStyle}
          innerContainerStyles={{ marginLeft: 10, marginRight: 10 }}
        />
        {this.state.selectedProvider ? <PaymentWebView provider={this.state.selectedProvider} payData={this.state.payData} onSuccess={this.onSuccessHandler} onCancel={this.onCanceledHandler} /> : null}
        {this.state.providers && this.state.selectedProvider == null ?
          <View>
            {
              this.state.providers.map((provider) => {
                return (
                  <View style={[styles.box, { marginTop: 12 }]} key={provider.name}>
                    <TouchableHighlight onPress={this.selectProvider.bind(this, provider)} underlayColor='#99d9f4'>
                      <Image
                        style={styles.thumb}
                        source={{ uri: provider.image }}
                      />
                    </TouchableHighlight>
                  </View>
                );
              })
            }

          </View>
          : null
        }
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.WHITE,
    flex: 1
  },
  headerStyle: {
    backgroundColor: colors.GREY.default,
    borderBottomWidth: 0
  },
  headerTitleStyle: {
    color: colors.WHITE,
    fontFamily: 'Montserrat-Bold',
    fontSize: 20
  },
  box: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ededed',
    borderRadius: 8,
    marginBottom: 4,
    marginHorizontal: 20,
    marginTop: 8
  },

  thumb: {
    height: 35,
    width: 100,
    resizeMode: 'contain'

  }
});