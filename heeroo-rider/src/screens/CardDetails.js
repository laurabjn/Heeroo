import React from 'react';
import {
  StyleSheet,
  View,
  Image,
  Dimensions,
  Text,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Modal,
  Alert,
} from 'react-native';

import { Header, CheckBox } from '@rneui/themed';
import { colors } from '../common/theme';
var { width, height } = Dimensions.get('window');
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';

import { PromoComp } from "../components";
import languageJSON from '../common/language';
import { isCardPaymentAvailable, payBookingWithCard } from '../common/stripePayment';
import { DrawerToggle, CloseBtn } from '../components';

export default class CardDetailsScreen extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      loadingModal: false,
      pinModalVisible: false,
      billingModalVisible: false,
      dropdown: true,
      sdropdown: true,
      savedCardchecked: false,
      savedCards: [],
      cvvModal: false,
      cvvofSaveCard: "",
      selectedSaveCardDetails: '',
      cardData: '',
      otpModal: false,
      useWalletCash: false,
      walletBalance: 0,
      promodalVisible: false,
      settings: {
        code: '',
        symbol: '',
        cash: false,
        wallet: false
      },
      providers: null,
    }
  }

  _retrieveSettings(countryCode) {
    firebase.database().ref('settings/').once('value', value => {
      if (value.val()) {

        let symbol = " €"
        let code = " EUR"
        let data = value

        data.forEach(element => {

          if (countryCode == element.country) {
            symbol = " " + element.symbol
            code = " " + element.code
          }
        });
        this.setState({
          settings:
          {
            code: code,
            symbol: symbol,
            country: countryCode,
            cash: true,
            wallet: false
          },
        });

        /*
        console.log("firebase call error = ");
        console.log(error);
    }*/
      }
    })

  };


  componentDidMount() {
    this._retrieveSettings(this.props.route.params.data.pickup.country);
    //firebase.database().ref('settings/').on()
  }

  async UNSAFE_componentWillMount() {
    var pdata = this.props.route.params.data;
    if (pdata) {
      const data = {
        userUId: firebase.auth().currentUser,
        amount: pdata.trip_cost,
        discount: 0,
        payableAmmount: pdata.trip_cost,
        email: pdata.email,
        phonenumber: pdata.phonenumber,
        firstname: pdata.firstname,
        lastname: pdata.lastname,
        txRef: pdata.bookingKey // booking id
      }
      this.setState({
        userData: pdata,
        payDetails: data,
      })
    } else {
      console.log('PDATA not found')
    }
    this.loadWalletCash()

  }

  loadWalletCash() {
    const uRoot = firebase.database().ref('users/' + firebase.auth().currentUser.uid);
    uRoot.on('value', uval => {
      if (uval.val()) {
        let data = uval.val()
        if (data.walletBalance && data.walletBalance > 0) {
          this.setState({ walletBalance: data.walletBalance })
        }
      }
    })
  }

  onCardChange = cardData => {
    this.setState({ cardData });
  };


  useWallet() {
    this.setState({ useWalletCash: !this.state.useWalletCash }, () => {
      if (this.state.useWalletCash == true) {
        if (this.state.walletBalance >= this.state.payDetails.payableAmmount) {
          this.setState({
            usedWalletAmmount: this.state.payDetails.payableAmmount
          })
        } else {
          let data = this.state.payDetails
          data.payableAmmount = data.payableAmmount - this.state.walletBalance;
          this.setState({ usedWalletAmmount: this.state.walletBalance, payDetails: data })
        }
      } else {
        let data = this.state.payDetails;
        data.payableAmmount = data.amount - data.discount;
        this.setState({ usedWalletAmmount: 0, payDetails: data })
      }
    })
  }

  cashPayment() {
    //this.setState({ loadingModal: true });
    this.setValueToDB('Espèces')
  }


  walletPayment() {
    //this.setState({ loadingModal: true });
    this.setValueToDB('Wallet')
  }

  setValueToDB(paymentMode) {
    if (paymentMode) {
      let paramData = this.state.userData;
      firebase.database().ref('users/' + paramData.driver + '/my_bookings/' + paramData.bookingKey + '/').update({
        payment_mode: paymentMode,
        customer_paid: this.state.payDetails.amount - this.state.payDetails.discount,
        discount_amount: this.state.payDetails.discount,
        usedWalletMoney: this.state.usedWalletAmmount ? this.state.usedWalletAmmount : 0,
        cashPaymentAmount: paymentMode == 'Wallet' ? 0 : this.state.payDetails.payableAmmount
      }).then(() => {
        firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/my-booking/' + paramData.bookingKey + '/').update({
          payment_mode: paymentMode,
          customer_paid: this.state.payDetails.amount - this.state.payDetails.discount,
          discount_amount: this.state.payDetails.discount,
          usedWalletMoney: this.state.usedWalletAmmount ? this.state.usedWalletAmmount : 0,
          cashPaymentAmount: paymentMode == 'Wallet' ? 0 : this.state.payDetails.payableAmmount
        }).then(() => {
          firebase.database().ref('bookings/' + paramData.bookingKey + '/').update({
            payment_mode: paymentMode,
            customer_paid: this.state.payDetails.amount - this.state.payDetails.discount,
            discount_amount: this.state.payDetails.discount,
            usedWalletMoney: this.state.usedWalletAmmount ? this.state.usedWalletAmmount : 0,
            cashPaymentAmount: paymentMode == 'Wallet' ? 0 : this.state.payDetails.payableAmmount
          }).then(() => {
            this.setState({ loadingModal: false });
            if (this.state.usedWalletAmmount) {
              if (this.state.usedWalletAmmount > 0) {
                firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/walletHistory').push({
                  type: 'Debit',
                  amount: this.state.usedWalletAmmount,
                  date: firebase.database.ServerValue.TIMESTAMP,
                  txRef: this.state.payDetails.txRef,
                }).then(() => {
                  firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/').update({
                    walletBalance: this.state.walletBalance - this.state.usedWalletAmmount
                  })
                })
              }
            }
          })
          this.props.navigation.navigate('Map', { screen: 'ratingPage', params: { data: paramData } });
        })

      })
    }

  }

  async payWithCard() {
    const booking = this.state.userData;
    if (!booking || !booking.bookingKey) return;
    this.setState({ loadingModal: true });
    try {
      const result = await payBookingWithCard({ bookingId: booking.bookingKey, email: this.state.payDetails.email });
      if (result.canceled) {
        this.setState({ loadingModal: false });
        return;
      }
      // Le webhook Stripe marque la course payée côté serveur ; on reflète
      // l'état localement pour ne pas faire attendre l'utilisateur.
      const paid = {
        payment_status: 'PAID',
        payment_mode: 'Card',
        getway: 'stripe',
        transaction_id: result.paymentIntentId,
        customer_paid: this.state.payDetails.amount - this.state.payDetails.discount,
        discount_amount: this.state.payDetails.discount,
        usedWalletMoney: 0,
        cardPaymentAmount: this.state.payDetails.payableAmmount,
      };
      const uid = firebase.auth().currentUser.uid;
      await firebase.database().ref('bookings/' + booking.bookingKey + '/').update(paid);
      await firebase.database().ref('users/' + uid + '/my-booking/' + booking.bookingKey + '/').update(paid);
      if (booking.driver) {
        await firebase.database().ref('users/' + booking.driver + '/my_bookings/' + booking.bookingKey + '/').update(paid);
      }
      this.setState({ loadingModal: false });
      this.props.navigation.navigate('Map', { screen: 'ratingPage', params: { data: booking } });
    } catch (error) {
      this.setState({ loadingModal: false });
      Alert.alert(languageJSON.Error, error.message || String(error));
    }
  }

  loading() {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={this.state.loadingModal}
        onRequestClose={() => {
          this.setState({ loadingModal: false })
        }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(22,22,22,0.8)", justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '85%', backgroundColor: "#DBD7D9", borderRadius: 10, flex: 1, maxHeight: 70 }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', flex: 1, justifyContent: "center" }}>
              <Image
                style={{ width: 80, height: 80, backgroundColor: colors.TRANSPARENT }}
                source={require('../../assets/images/loader.gif')}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#000", fontSize: 16, }}>{languageJSON.please_wait}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  requestmodalclose() {
    this.setState({
      cvvModal: false,
      otpModal: false,
      pinModalVisible: false
    })

  }


  promoModal() {

    return (
      <Modal
        animationType="none"
        transparent={true}
        visible={this.state.promodalVisible}
        onRequestClose={() => {
          this.setState({ promodalVisible: false })
        }}>
        <View style={styles.promoModalContainer}>
          <View style={styles.promoModal}>
            <CloseBtn style={styles.promoClose} onPress={() => this.setState({ promodalVisible: false })} />
            <PromoComp onPressButton={(item, index) => { this.SelectCopupon(item, index) }}></PromoComp>
          </View>
        </View>
      </Modal>
    )
  }

  SelectCopupon(item, index) {
    var toDay = new Date();
    var promoValidity = item.promo_validity
    var expiryDay = promoValidity.split('/')[0];
    var em = promoValidity.split('/')[1];
    var expiryMonth = em == 12 ? em - 1 : em
    var expiryYear = promoValidity.split('/')[2];
    var fexpDate = expiryMonth + '/' + expiryDay + '/' + expiryYear
    var expDate = new Date(fexpDate)
    if (this.state.payDetails.amount >= item.min_order) {
      var userAvail = item.user_avail

      // Checking is promo useby anyone
      if (userAvail != undefined) {

        if (toDay > expDate && userAvail.count == item.promo_usage_limit) {
          alert(languageJSON.promo_exp)
        } else if (userAvail.count == item.promo_usage_limit) {
          alert(languageJSON.promo_limit)
        } else {
          let discounttype = item.promo_discount_type.toUpperCase();
          //percentage discount block
          if (discounttype == 'PERCENTAGE') {
            let discount = this.state.payDetails.amount * item.promo_discount_value / 100; // discount Calculations
            if (discount > item.max_promo_discount_value) {
              let discount = item.max_promo_discount_value; // discount assign if discount greater than maximum discount

              let data = this.state.payDetails
              data.discount = discount
              data.promo_applied = true
              data.promo_details = { promo_key: item.promoKey, promo_name: item.promo_name, discount_type: item.promo_discount_type, promo_discount_value: item.promo_discount_value, max_discount: item.max_promo_discount_value, minimumorder: item.min_order },
                data.payableAmmount = data.amount - discount
              this.setState({
                payDetails: data
              }, () => {
                this.setState({ promodalVisible: false, modalVisible: false, alertModalVisible: false })
              })
              //alert(estimatefare)
            } else {
              // Estimate fare calculation with percentage discount
              let data = this.state.payDetails
              data.discount = discount
              data.promo_applied = true
              data.promo_details = { promo_key: item.promoKey, promo_name: item.promo_name, discount_type: item.promo_discount_type, promo_discount_value: item.promo_discount_value, max_discount: item.max_promo_discount_value, minimumorder: item.min_order },
                data.payableAmmount = data.amount - discount
              this.setState({
                payDetails: data
              }, () => {
                this.setState({ promodalVisible: false, modalVisible: false, alertModalVisible: false })
              })
            }

            // Flat discount block 
          } else {
            let discount = item.max_promo_discount_value;
            //let estimatefare = this.state.estimateFare - discount; // Estimate fare calculation with flat discount
            let data = this.state.payDetails
            data.discount = discount
            data.promo_applied = true
            data.promo_details = { promo_key: item.promoKey, promo_name: item.promo_name, discount_type: item.promo_discount_type, promo_discount_value: item.promo_discount_value, max_discount: item.max_promo_discount_value, minimumorder: item.min_order },
              data.payableAmmount = data.amount - discount
            this.setState({
              payDetails: data
            }, () => {
              this.setState({ promodalVisible: false, modalVisible: false, alertModalVisible: false })
            })
          }
        }
      } else {
        // if promo is not useby anyone.
        if (toDay > fexpDate) {
          alert(languageJSON.promo_exp)
        } else {
          let discounttype = item.promo_discount_type.toUpperCase();
          if (discounttype == 'PERCENTAGE') {
            var discount = this.state.payDetails.amount * item.promo_discount_value / 100; // discount Calculations 
            if (discount > item.max_promo_discount_value) {
              let discount = item.max_promo_discount_value; // discount assign if discount greater than maximum discount
              //let estimatefare = this.state.estimateFare - discount; // Estimate fare calculations with percentage discount
              let data = this.state.payDetails
              data.discount = discount
              data.promo_applied = true
              data.promo_details = { promo_key: item.promoKey, promo_name: item.promo_name, discount_type: item.promo_discount_type, promo_discount_value: item.promo_discount_value, max_discount: item.max_promo_discount_value, minimumorder: item.min_order },
                data.payableAmmount = data.amount - discount
              this.setState({
                payDetails: data
              }, () => {
                this.setState({ promodalVisible: false, modalVisible: false, alertModalVisible: false })
              })
            } else {
              //let estimatefare = this.state.estimateFare - discount; // Estimate fare calculation with percentage discount
              let data = this.state.payDetails
              data.discount = discount
              data.promo_applied = true
              data.promo_details = { promo_key: item.promoKey, promo_name: item.promo_name, discount_type: item.promo_discount_type, promo_discount_value: item.promo_discount_value, max_discount: item.max_promo_discount_value, minimumorder: item.min_order },
                data.payableAmmount = data.amount - discount
              this.setState({
                payDetails: data
              }, () => {
                this.setState({ promodalVisible: false, modalVisible: false, alertModalVisible: false })
              })
            }
          } else {
            let discount = item.max_promo_discount_value;
            //let estimatefare = this.state.estimateFare - discount; // Estimate fare calculation with flat discount
            let data = this.state.payDetails
            data.discount = discount
            data.promo_applied = true
            data.promo_details = { promo_key: item.promoKey, promo_name: item.promo_name, discount_type: item.promo_discount_type, promo_discount_value: item.promo_discount_value, max_discount: item.max_promo_discount_value, minimumorder: item.min_order },
              data.payableAmmount = data.amount - discount
            this.setState({
              payDetails: data
            }, () => {
              this.setState({ promodalVisible: false, modalVisible: false, alertModalVisible: false })
            })
          }
        }
      }
      // if your order value lower than minimum order value. 
    } else {
      alert(languageJSON.promo_eligiblity)
    }
  }

  openPromoModal() {
    let data = this.state.payDetails;
    data.payableAmmount = data.amount - data.discount;
    this.setState({
      promodalVisible: !this.state.promodalVisible, usedWalletAmmount: 0, payDetails: data, useWalletCash: false
    })
  }
  render() {
    console.log('carddetail')
    return (
      <View style={styles.mainView}>
        <Header
          backgroundColor={"transparent"}
          leftComponent={<DrawerToggle {...this.props} />}
          centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.payment}</Text>}
          containerStyle={styles.headerStyle}
        />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollStyle}>
          <View >
            <Text style={styles.billTitle}>{languageJSON.bill_details}</Text>
            <TouchableOpacity
              onPress={() => { this.openPromoModal() }}>
              <Text style={styles.promoText}>{languageJSON.apply_promo}</Text>
            </TouchableOpacity>

            <View style={styles.billItem}>
              <Text style={styles.billName}>{languageJSON.your_fare}</Text>
              <Text style={styles.billAmount}>{parseFloat(this.state.payDetails.amount).toFixed(0)} {this.state.settings.symbol}</Text>
            </View>
            <View style={styles.billItem}>
              <Text style={styles.billName}>{languageJSON.promo_discount}</Text>
              <Text style={styles.billAmount}>- {this.state.payDetails ? this.state.payDetails.discount ? parseFloat(this.state.payDetails.discount).toFixed(0) : '0.00' : '0.00'} {this.state.settings.symbol}</Text>
            </View>
            {this.state.useWalletCash == true &&
              <View style={styles.billItem}>
                <Text style={styles.billName}>{languageJSON.wallet_discount}</Text>
                <Text style={styles.billAmount}>- {this.state.usedWalletAmmount ? parseFloat(this.state.usedWalletAmmount).toFixed(0) : '0.00'} {this.state.settings.symbol}</Text>
              </View>}

            <View style={styles.billItem}>
              <Text style={styles.billName}>{languageJSON.grand_total}</Text>
              <Text style={styles.billAmount}>{this.state.payDetails.payableAmmount ? (this.state.payDetails.amount - this.state.payDetails.discount).toFixed(0) : 0.00} {this.state.settings.symbol}</Text>
            </View>
            <View style={[styles.billItem, styles.billItemComm]}>
              <Text style={styles.billNameMontant}>{languageJSON.payable_ammount}</Text>
              <Text style={styles.billAmountMontant}>{this.state.payDetails.payableAmmount ? parseFloat(this.state.payDetails.payableAmmount).toFixed(0) : 0.00} {this.state.settings.symbol}</Text>
            </View>
          </View>
          {this.state.useWalletCash == true && this.state.walletBalance >= this.state.payDetails.amount ?
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.buttonWrapper2}
                onPress={() => {
                  this.walletPayment()

                }}>
                <Text style={styles.buttonTitle}>{languageJSON.paynow_button}</Text>
              </TouchableOpacity>
            </View>
            :
            <View style={styles.buttonContainer}>
              {this.state.settings.cash ?
                <TouchableOpacity
                  style={styles.buttonWrapper}
                  onPress={() => {
                    this.cashPayment()

                  }}>
                  <Text style={styles.buttonTitle}>{languageJSON.pay_cash}</Text>
                </TouchableOpacity>
                : null}
              {isCardPaymentAvailable() ?
                <TouchableOpacity
                  style={styles.cardPayBtn}
                  onPress={() => {
                    this.payWithCard()
                  }}>
                  <Text style={styles.buttonTitle}>{languageJSON.payWithCard}</Text>
                </TouchableOpacity>
                : null}
            </View>
          }

        </ScrollView>

        {
          this.loading()
        }
        {
          this.promoModal()
        }
      </View>
    );
  }
}

const styles = StyleSheet.create({

  mainView: {
    flex: 1,
    backgroundColor: colors.WHITE,
    paddingHorizontal: 20,

  },
  headerStyle: {
    zIndex: 2,
    paddingHorizontal: 0,
    borderBottomWidth: 0,
    marginBottom: 30
  },
  headerTitleStyle: {
    color: colors.TEXT,
    fontFamily: 'Montserrat-Bold',
    fontSize: 20
  },
  scrollStyle: {
    flex: 1,
    backgroundColor: colors.WHITE,
    justifyContent: "flex-end",
    paddingBottom: 30
  },

  //
  billItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: .7,
    borderColor: colors.SEPARATOR_LIGHT
  },
  billName: {
    fontSize: 14,
    fontFamily: 'Montserrat-Light',
    color: colors.TEXT_SEMI_DARKER
  },
  billAmount: {
    fontSize: 16,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.TEXT
  },
  billNameMontant: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: colors.TEXT_SEMI_DARKER
  },
  billAmountMontant: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: colors.PRIMARY
  },
  billTitle: {
    fontSize: 16,
    color: colors.TEXT_SEMI_DARKER,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 10
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  buttonWrapper: {
    //marginBottom: 15,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 25

  },
  buttonTitle: {
    fontSize: 14,
    color: colors.BUTTON_TEXT,
    fontFamily: 'Montserrat-Bold',
  },
  buttonWrapper2: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 25
  },
  cardPayBtn: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.BUTTON_PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 25
  },
  checkboxContainer: {
    backgroundColor: colors.WHITE,
    borderWidth: 0,
    padding: 0,
    marginBottom: 30
  },
  checkboxText: {
    fontSize: 14,
    color: colors.TEXT,
    fontFamily: 'Montserrat-Regular',
  },
  billItemComm: {
    borderBottomWidth: 0,
    marginBottom: 20
  },
  promoText: {
    fontSize: 16,
    color: colors.PRIMARY,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 10
  },
  promoModalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 20
  },
  promoModal: {
    backgroundColor: colors.WHITE,
    borderRadius: 10,
    padding: 10
  },
  promoClose: {
    alignSelf: "flex-end",
    marginTop: 0,
    marginBottom: 20,
  }
});