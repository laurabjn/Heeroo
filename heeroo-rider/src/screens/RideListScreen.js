import React from 'react';
import { RideList } from '../components';
import {
    StyleSheet,
    View,
    Text,
    TouchableWithoutFeedback
} from 'react-native';
import { Header } from 'react-native-elements';
import { colors } from '../common/theme';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/firestore';
import languageJSON from '../common/language';
import { DrawerToggle } from '../components';
import moment from 'moment'

export default class RideListPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currentUser: firebase.auth().currentUser,
        }
    }

    componentDidMount() {
        this.getMyRides();
    }

    //Go to ride details page
    goDetails(item, index) {
        if (item && item.trip_cost > 0) {
            item.roundoffCost = Math.round(item.trip_cost).toFixed(0);
            item.roundoff = (Math.round(item.roundoffCost) - item.trip_cost).toFixed(0);
        } else {
            item.roundoffCost = Math.round(item.estimate).toFixed(0);
            item.roundoff = (Math.round(item.roundoffCost) - item.estimate).toFixed(0);
        }
        this.props.navigation.push('RideDetails', { data: item });
    }

    //Fetching My Rides
    getMyRides() {
        const ridesListPath = firebase.database().ref('/users/' + this.state.currentUser.uid + '/my-booking/');
        ridesListPath.on('value', myRidesData => {

            if (myRidesData.val()) {
                var ridesOBJ = myRidesData.val();
                var allRides = [];
                for (let key in ridesOBJ) {
                    ridesOBJ[key].bookingId = key;
                    var Bdate = moment(ridesOBJ[key].tripdate).format("DD/MM/YYYY [à] HH:mm");
                    ridesOBJ[key].bookingDate = Bdate;
                    allRides.push(ridesOBJ[key]);
                }
                if (allRides) {
                    this.setState({
                        myrides: allRides.reverse()
                    })
                }
            }
        })
    }

    render() {
        return (
            <View style={styles.mainView}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.ride_list_title}</Text>}
                    containerStyle={styles.headerStyle}
                />
                {!!this.state.myrides && this.state.myrides.length > 0 ?
                    < RideList onPressButton={(item, index) => { this.goDetails(item, index) }} data={this.state.myrides}></RideList>
                    :
                    <View style={styles.no_reservation}>
                        <Text style={styles.no_reservation_text} >{languageJSON.no_reservation}</Text>
                    </View>
                }
            </View>
        );
    }
}

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
        //marginTop: StatusBar.currentHeight 
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
