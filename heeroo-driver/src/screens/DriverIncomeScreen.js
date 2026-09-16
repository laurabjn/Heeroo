import React from 'react';
import { Header } from '@rneui/themed';
import { colors } from '../common/theme';
import {
    StyleSheet,
    View,
    Text,
    TouchableWithoutFeedback,
    Dimensions,
} from 'react-native';
var { width } = Dimensions.get('window');
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import languageJSON from '../common/language';
import DrawerToggle from '../components/DrawerToggle';
import WalletTopup from '../components/WalletTopup';


export default class DriverIncomePage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currency: {
                code: '',
                symbol: ''
            }
        };
        this._retrieveCurrency();

    }

    _retrieveCurrency = async () => {
        firebase.database().ref('users/' + firebase.auth().currentUser.uid + '/').once('value', userData => {
            firebase.database().ref('settings/').once('value', value => {
                if (value.val()) {

                    let symbol = " €"
                    let code = " EUR"
                    let data = value

                    data.forEach(element => {

                        if (userData.val().country == element.country) {
                            symbol = " " + element.symbol
                            code = " " + element.code
                        }
                    });

                    this.setState({
                        currency: {
                            code: code,
                            symbol: symbol
                        },
                    })
                }
            })
        })
    }

    componentDidMount() {
        let userUid = firebase.auth().currentUser.uid;
        let ref = firebase.database().ref('bookings/');
        ref.on('value', allBookings => {
            if (allBookings.val()) {
                let data = allBookings.val();
                var myBookingarr = [];
                for (let k in data) {
                    if (data[k].driver == userUid) {
                        data[k].bookingKey = k
                        myBookingarr.push(data[k])
                    }
                }

                if (myBookingarr) {
                    this.setState({ myBooking: myBookingarr }, () => {
                        this.eraningCalculation()
                    })

                }
            }
        })
    }

    eraningCalculation() {

        if (this.state.myBooking) {

            let today = new Date();
            let tdTrans = 0;
            let mnTrans = 0;
            let totTrans = 0;
            for (let i = 0; i < this.state.myBooking.length; i++) {
                const { tripdate, driver_share } = this.state.myBooking[i];
                let tDate = new Date(tripdate);
                if (driver_share != undefined) {
                    if (tDate.getDate() === today.getDate() && tDate.getMonth() === today.getMonth()) {
                        tdTrans = tdTrans + driver_share;
                    }
                    if (tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear()) {
                        mnTrans = mnTrans + driver_share;
                    }

                    totTrans = totTrans + driver_share;

                }
            }
            this.setState({
                totalEarning: totTrans,
                today: tdTrans,
                thisMothh: mnTrans
            })
            //console.log('today- '+tdTrans +' monthly- '+ mnTrans + ' Total-'+ totTrans);

        }
    }
    render() {
        return (

            <View style={styles.mainView}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.incomeText}</Text>}
                    containerStyle={styles.headerStyle}
                />
                <WalletTopup />
                <View style={styles.todaysIncomeContainer}>
                    <Text style={styles.todayEarningHeaderText}>{languageJSON.today}</Text>
                    <Text style={styles.todayEarningMoneyText}>{this.state.currency.symbol} {this.state.today ? parseFloat(this.state.today).toFixed(0) : '0'}</Text>
                </View>
                <View style={styles.listContainer}>
                    <View style={styles.totalEarning}>
                        <Text style={styles.todayEarningHeaderText2}>{languageJSON.thismonth}</Text>
                        <Text style={styles.todayEarningMoneyText2}>{this.state.currency.symbol} {this.state.thisMothh ? parseFloat(this.state.thisMothh).toFixed(0) : '0'}</Text>
                    </View>
                    <View style={styles.thismonthEarning}>
                        <Text style={styles.todayEarningHeaderText2}>{languageJSON.totalearning}</Text>
                        <Text style={styles.todayEarningMoneyText2}>{this.state.currency.symbol} {this.state.totalEarning ? parseFloat(this.state.totalEarning).toFixed(0) : '0'}</Text>
                    </View>
                </View>
            </View>

        );
    }

}
const styles = StyleSheet.create({
    mainView: {
        flex: 1,
        backgroundColor: colors.WHITE,
    },
    headerStyle: {
        borderBottomWidth: 0,
        paddingHorizontal: 20,
    },
    headerTitleStyle: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    todaysIncomeContainer: {
        flex: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
        borderRadius: 10,
        backgroundColor: colors.ITEM,
        marginTop: 30
    },
    listContainer: {
        flex: 5,
        backgroundColor: '#fff',
        marginTop: 1,
        flexDirection: 'row',
        paddingHorizontal: 6,
        paddingVertical: 6,
        paddingBottom: 6,
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    todayEarningHeaderText: {
        fontFamily: "Montserrat-SemiBold",
        fontSize: 20,
        paddingBottom: 5,
        color: colors.TEXT
    },
    todayEarningMoneyText: {
        fontFamily: "Montserrat-Bold",
        fontSize: 55,
        color: colors.PRIMARY
    },
    totalEarning: {
        height: 90,
        width: '49%',
        backgroundColor: colors.SECONDARY,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    thismonthEarning: {
        height: 90,
        width: '49%',
        backgroundColor: colors.PRIMARY,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    todayEarningHeaderText2: {
        fontFamily: "Montserrat-Bold",
        paddingBottom: 5,
        color: colors.WHITE,
        fontSize: 14,
    },
    todayEarningMoneyText2: {
        fontFamily: "Montserrat-Bold",
        paddingBottom: 5,
        color: colors.WHITE,
        fontSize: 20,
    },
})