import React from "react";
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,

} from "react-native";
import { Avatar, Button } from "react-native-elements";
import { colors } from "../common/theme";
import firebase from 'firebase/compat/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/firestore';
import languageJSON from '../common/language';

export default class PromoComp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      data: [],
      settings: {
        code: '',
        symbol: '',
        cash: false,
        wallet: false
      }
    };
    this.loadPromos();
  }

  componentDidMount() {
    this._retrieveSettings();
  }

  _retrieveSettings = async () => {
    try {
      const value = await AsyncStorage.getItem('settings');
      if (value !== null) {
        this.setState({ settings: JSON.parse(value) });
      }
    } catch (error) {
      console.log("Asyncstorage issue 1");
    }
  };


  loadPromos() {
    const getpromo = firebase.database().ref('offers/');
    getpromo.once('value', getpromo => {
      if (getpromo.val()) {
        let promoObj = getpromo.val();
        var allPromoData = [];
        for (key in promoObj) {
          promoObj[key].promoKey = key;
          allPromoData.push(promoObj[key]);
        }
        if (allPromoData) {
          this.setState({
            data: allPromoData
          }, () => {
            console.log("this.state")
          })
        }
      }
    })
  }



  onPressButton(item, index) {
    const { onPressButton } = this.props;
    onPressButton(item, index)
  }


  newData = ({ item, index }) => {
    return (
      <View style={styles.container} >
        <View flex={1} >
          <Text style={styles.couponCode}>{item.promo_name}</Text>
          <Text style={styles.textStyle}>{item.promo_description}</Text>
          <Text style={styles.timeTextStyle}>{languageJSON.min_order_value} {this.state.settings.symbol}{item.min_order}</Text>
        </View>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => this.onPressButton(item, index)}>
          <Text style={styles.btnText} >{languageJSON.apply}</Text>
        </TouchableOpacity>
      </View>
    );
  };
  render() {
    return (
      <View>
        <FlatList
          keyExtractor={(item, index) => index.toString()}
          data={this.state.data}
          renderItem={this.newData}
        />
      </View>
    );
  }
}
//Screen Styling
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flex: 1,
    marginBottom: 15,
  },
  textStyle: {
    flex: 1,
    fontFamily: "Montserrat-Light",
    fontSize: 15,
  },
  couponCode: {
    flex: 1,
    fontFamily: "Montserrat-Bold"
  },
  timeTextStyle: {
    fontSize: 11,
    fontFamily: "Montserrat-Light",
    color: "#a6a6a6",
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.PRIMARY,
    borderRadius: 5,
    paddingHorizontal: 10
  },
  btnText: {
    fontFamily: "Montserrat-Bold",
    textAlign: "center",
    color: colors.TEXT_DARK,
    fontSize: 10,
  },
});
