import React from 'react';
import { RideList } from '../components';
import {
    StyleSheet,
    View,
    Text,
    StatusBar,
    TouchableWithoutFeedback
} from 'react-native';
import { Header } from 'react-native-elements';
import { colors } from '../common/theme';

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';

import languageJSON from '../common/language';
import { DrawerToggle } from '../components';


export default class RideListPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            allBookings: [],
            allCurrency: []

        }
        this.getAllCurencySymbol()
    }
    getAllCurencySymbol() {
        firebase.database().ref('settings/').once('value', value => {
            if (value.val()) {
                this.setState({
                    allCurrency: value.val()
                })

            }
        })
    }
    componentDidMount() {
        let userUid = firebase.auth().currentUser.uid;
        let dbRef = firebase.database().ref('users/' + userUid + '/my_bookings');
        dbRef.on('value', (snap) => {
            var allBookings = []
            let bookings = snap.val();
            for (let key in bookings) {
                bookings[key].bookingUid = key;
                allBookings.push(bookings[key]);
            }
            this.setState({
                allBookings: allBookings.reverse()
            })
        })
    }

    //go to ride details page
    goDetails(item, index) {
        if (item && item.trip_cost > 0) {
            item.roundoffCost = Math.round(item.trip_cost).toFixed(0);
            item.roundoff = (Math.round(item.roundoffCost) - item.trip_cost).toFixed(0)
            this.props.navigation.push('RideDetails', { data: item });

        } else {
            item.roundoffCost = Math.round(item.estimate).toFixed(0);
            item.roundoff = (Math.round(item.roundoffCost) - item.estimate).toFixed(0)
            this.props.navigation.push('RideDetails', { data: item });
        }

    }


    render() {

        return (
            <View style={styles.mainView}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.my_booking}</Text>}
                    containerStyle={styles.headerStyle}
                />
                {this.state.allBookings == 0 ?
                    <View style={styles.no_reservation}>
                        <Text style={styles.no_reservation_text} >{languageJSON.no_reservation}</Text>
                    </View>
                    : <RideList data={this.state.allBookings} settings={this.state.allCurrency} onPressButton={(item, index) => { this.goDetails(item, index) }}></RideList>
                }
            </View>
        );
    }
}

//Screen Styling
const styles = StyleSheet.create({
    headerStyle: {
        borderBottomWidth: 0,
        paddingHorizontal: 20,
    },
    headerTitleStyle: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    containerView: { flex: 1 },
    textContainer: { textAlign: "center" },
    mainView: {
        flex: 1,
        backgroundColor: colors.WHITE,

    },
    no_reservation: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    no_reservation_text: {
        fontSize: 14,
        fontFamily: "Montserrat-Light",
        color: colors.TEXT,
    }
});
