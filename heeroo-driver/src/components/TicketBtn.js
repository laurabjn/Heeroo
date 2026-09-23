import React from 'react';
import {
    Modal,
    StyleSheet,
    TouchableOpacity,
    View,
    Text, SafeAreaView,
    ScrollView,
    Platform,
} from 'react-native';
import { displayName } from '../../app.json'
import { colors } from '../common/theme';
import Icon from 'react-native-vector-icons/AntDesign';
import language from '../common/language';
import { formatDateTime } from '../common/dateFormat';

export default class TicketBtn extends React.Component {

    state = {
        showTicket: false
    }

    render() {
        const { data } = this.props;
        return (
            <View>
                <TouchableOpacity style={[styles.backButton]} onPress={() => this.setState({ showTicket: true })} >
                    <Icon name="file-text" size={20} color={colors.TEXT} />
                </TouchableOpacity>
                <Modal
                    visible={this.state.showTicket}>
                    <SafeAreaView flex={1} >
                        <ScrollView flex={1} paddingHorizontal={15} >
                            <View flexDirection="row" paddingVertical={10} marginBottom={15} justifyContent="space-between" >
                                <Text style={styles.headerText} >{language.ticket_title}</Text>
                                <Icon name="close" size={25} color={colors.TEXT} onPress={() => this.setState({ showTicket: false })} />
                            </View>
                            <Text style={styles.rulesText}  >{language.ticket_rules}</Text>
                            <Text style={[styles.titleText, { marginBottom: 0 }]} >{data.company_name ? data.company_name : " - "}</Text>
                            <Text style={[styles.text, { marginBottom: 15 }]} >{language.ticket_start_address}</Text>
                            <Text style={[styles.text, { marginBottom: 0 }]} >{data.company_address ? data.company_address : " - "}</Text>
                            <Text style={[styles.text, { marginBottom: 15 }]} >{data.driver_contact ? data.driver_contact : " - "}</Text>
                            <Text style={[styles.text, { marginBottom: 15 }]} ><Text style={{ fontFamily: "Montserrat-Bold" }} >{language.ticket_driver + " : "}</Text>{data.driver_name}</Text>
                            <Text style={[styles.text, { marginBottom: 15 }]} ><Text style={{ fontFamily: "Montserrat-Bold" }} >{language.ticket_rider + " : "}</Text>{data.customer_name + " " + data.customer_contact}</Text>
                            <Text style={[styles.text, { marginBottom: 15 }]} ><Text style={{ fontFamily: "Montserrat-Bold" }} >{language.ticket_ride_date + " : "}</Text>{formatDateTime(data.tripdate)}</Text>

                            <Text style={[styles.text, { marginBottom: 15 }]} ><Text style={{ fontFamily: "Montserrat-Bold" }} >{language.ticket_ride_deal_date + " : "}</Text>{data.trip_start_time ? formatDateTime(data.trip_start_time) : " - "}</Text>

                            <Text style={[styles.text, { marginBottom: 15 }]} ><Text style={{ fontFamily: "Montserrat-Bold" }} >{language.ticket_ride_start_address + " : "}</Text>{data.pickup.add ? data.pickup.add : " - "}</Text>

                            <Text style={[styles.text, { marginBottom: 15 }]} ><Text style={{ fontFamily: "Montserrat-Bold" }} >{language.ticket_ride_end_address + " : "}</Text>{data.drop.add ? data.drop.add : " - "}</Text>
                            <Text style={[styles.text, { marginBottom: 15 }]} ><Text style={{ fontFamily: "Montserrat-Bold" }} >{language.ticket_via + " : "}</Text>{displayName}</Text>
                        </ScrollView>
                    </SafeAreaView>
                </Modal>
            </View>

        );
    }
}

//style for this component
const styles = StyleSheet.create({
    backButton: {
        backgroundColor: colors.ITEM,
        width: Platform.OS == "ios" ? 46 : 36,
        height: Platform.OS == "ios" ? 46 : 36,
        borderRadius: Platform.OS == "ios" ? 46 : 36,
        alignItems: "center",
        justifyContent: "center",
    },
    headerText: {
        fontFamily: "Montserrat-Bold",
        fontSize: 20,
        color: colors.TEXT_SEMI_DARKER,
    },
    rulesText: {
        fontFamily: "Montserrat-Regular",
        fontSize: 14,
        color: colors.TEXT,
        marginBottom: 15
    },
    text: {
        fontFamily: "Montserrat-Regular",
        fontSize: 14,
        color: colors.TEXT,
    },
    titleText: {
        fontFamily: "Montserrat-Bold",
        fontSize: 14,
        color: colors.TEXT,

    },
});
