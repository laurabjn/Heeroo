import React from 'react';
import { View, Text, SectionList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Icon } from '@rneui/themed'
import { colors } from '../common/theme';
import { Path } from '../components';
import languageJSON from '../common/language';
import countryCurrency from './../constants/countryCurrency.json'


// Statut lisible d'une course : libellé, couleur, et si elle est terminée (passée).
function rideStatus(item) {
    const paid = item.payment_status == 'PAID';
    switch (item.status) {
        case 'NEW': return { label: "Nouvelle demande", color: '#fdd42c', done: false };
        case 'ACCEPTED': return { label: "À prendre en charge", color: '#00aced', done: false };
        case 'ARRIVED': return { label: "Sur place", color: '#00aced', done: false };
        case 'START': return { label: "Course en cours", color: '#00aced', done: false };
        case 'END': return paid
            ? { label: "Terminée", color: '#00df8f', done: true }
            : { label: "Paiement en attente", color: '#ff9f43', done: false };
        case 'NOT PAID':
        case 'DUE': return { label: "Règlement attendu", color: '#ff9f43', done: false };
        case 'WAITING': return { label: "Non réglée", color: '#ff9f43', done: true };
        case 'PAID': return { label: "Terminée", color: '#00df8f', done: true };
        case 'CANCELLED': return { label: "Annulée", color: '#ff6a66', done: true };
        default: return { label: String(item.status || ''), color: '#9b9b9b', done: true };
    }
}

export default class RideList extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            currency: {
                code: '',
                symbol: ''
            }
        };


    }

    getCurrencySymbol(country) {
        const settings = this.props.settings
        let result = ''

        settings.forEach(element => {
            if (country == element.country) {
                result = '' + element.symbol

            }
        });
        return result
    }

    //on press of each item function
    onPressButton(item, index) {
        const { onPressButton } = this.props;
        onPressButton(item, index)
    }


    //flatlist return function
    newData = ({ item, index }) => {

        const status = rideStatus(item);
        return (
            <TouchableOpacity style={styles.itemStyle} onPress={() => this.onPressButton(item, index)}>
                <View style={[styles.bookHeader]} >
                    <Text style={[styles.dateStyle]}>{item.tripdate ? new Date(item.tripdate).toLocaleString() : ""}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.color }]}><Text style={styles.statusText}>{status.label}</Text></View>
                </View>
                <View style={[styles.bookHeader]} >
                    {item.status == 'END' && item.payment_status == 'PAID' && <Text style={[styles.fareStyle]}>{item.status == 'END' && item.payment_status == 'PAID' ? item.trip_cost > 0 ? parseFloat(item.trip_cost).toFixed(0) + " " + this.getCurrencySymbol(item.pickup.country) : parseFloat(item.estimate).toFixed(0) + " " + this.getCurrencySymbol(item.pickup.country) : null}</Text>}
                    <Text style={[styles.carText]}>{item.carType ? item.carType : null}</Text>
                </View>
                <View flexDirection='row' flex={1}  >
                    <Path border={4} />
                    <View flex={1} >
                        <Text style={[styles.holderText]}>{languageJSON.from_position}</Text>
                        <Text style={[styles.placeStyle]} numberOfLines={1} >{item.pickup.add ? item.pickup.add : ""}</Text>
                        <View style={styles.separator} />
                        <Text style={[styles.holderText]}>{languageJSON.to_position}</Text>
                        <Text style={[styles.placeStyle]} numberOfLines={1} >{item.drop.add ? item.drop.add : ""}</Text>
                    </View>
                </View>
            </TouchableOpacity >
        )
    }

    render() {
        const { data } = this.props
        const rides = data || [];
        const ongoing = rides.filter((r) => !rideStatus(r).done);
        const past = rides.filter((r) => rideStatus(r).done);
        const sections = [];
        if (ongoing.length) sections.push({ title: 'En cours', data: ongoing });
        if (past.length) sections.push({ title: 'Passées', data: past });
        return (
            <View style={styles.container}>
                <SectionList
                    showsVerticalScrollIndicator={false}
                    keyExtractor={(item, index) => (item.bookingId || '') + index}
                    sections={sections}
                    renderItem={this.newData}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <Text style={styles.sectionCount}>{section.data.length}</Text>
                        </View>
                    )}
                    stickySectionHeadersEnabled={false}
                />
            </View>
        );
    }
};

//style for this component
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.ITEM,
        borderRadius: 9,
        marginHorizontal: 10,
        marginVertical: 10,
    },
    textStyle: {
        fontSize: 18,
    },
    fareStyle: {
        fontFamily: "Montserrat-Bold",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,
    },
    itemStyle: {
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: 15,
        borderBottomWidth: 2,
        borderColor: colors.WHITE
    },
    leftViewStyle: {
        alignItems: 'center',
        marginRight: 10
    },
    leftLineStyle: {
        flex: 1,
        alignSelf: "center",
        borderWidth: 1,
        borderRadius: 1,
        borderColor: colors.SECONDARY,
        borderStyle: 'dashed',
        marginVertical: 1
    },
    dateStyle: {
        fontSize: 12,
        fontFamily: 'Montserrat-Light',
        color: colors.TEXT
    },
    cancelImageStyle: {
        width: 50,
        height: 50,
        marginRight: 20,
        marginTop: 10,
        alignSelf: 'flex-end'
    },
    bookHeader: {
        flexDirection: 'row',
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 15
    },
    holderText: {
        flex: 1,
        fontFamily: "Montserrat-SemiBold",
        fontSize: 10,
        color: colors.HOLDER_TEXT,
        marginBottom: 8
    },
    placeStyle: {
        flex: 1,
        fontFamily: "Montserrat-Light",
        fontSize: 14,
        color: colors.TEXT_SEMI_DARKER,
    },
    separator: {
        marginVertical: 8,
        flex: 1,
        height: 1,
        backgroundColor: colors.SEPARATOR_LIGHT
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontFamily: 'Montserrat-SemiBold',
        fontSize: 11,
        color: '#ffffff',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 16,
        paddingBottom: 6,
        backgroundColor: colors.ITEM,
    },
    sectionTitle: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 15,
        color: colors.TEXT,
        marginRight: 8,
    },
    sectionCount: {
        fontFamily: 'Montserrat-SemiBold',
        fontSize: 12,
        color: colors.TEXT,
        opacity: 0.5,
    },
    locationStatus: {
        width: 12,
        height: 12,
        borderRadius: 12 / 2,
        backgroundColor: "#00df8f"
    },
    carText: {
        fontFamily: "Montserrat-Light",
        fontSize: 12,
        color: colors.TEXT_SEMI_DARKER,
    }
});