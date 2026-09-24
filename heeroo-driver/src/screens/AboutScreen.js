import React from 'react';
import { Header } from '@rneui/themed';
import { colors } from '../common/theme';
import {
    StyleSheet,
    View,
    Text,
    StatusBar,
    ScrollView,
    TouchableWithoutFeedback,
    Dimensions,
    Image,
    Linking,
    TouchableOpacity
} from 'react-native';
var { width } = Dimensions.get('window');
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';;
import languageJSON from '../common/language';
import { DrawerToggle } from '../components';


export default class AboutPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {}
        const about = firebase.database().ref('About_Us/');
        about.once('value', aboutData => {
            if (aboutData.val()) {
                let data = aboutData.val()
                this.setState(data);
            }
        })
    }
    render() {
        return (
            <View style={styles.mainView}>
                <Header
                    backgroundColor={"transparent"}
                    leftComponent={<DrawerToggle {...this.props} />}
                    centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.about_us}</Text>}
                    containerStyle={styles.headerStyle}
                />
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
                    <Text style={styles.aboutTitleStyle}>{this.state.heading ? this.state.heading : null}</Text>
                    <View style={styles.aboutcontentmainStyle}>
                        <Image
                            style={{ width: '100%', height: 250 }}
                            source={require('../../assets/images/about_us.jpg')}
                        />

                        <Text style={styles.aboutcontentStyle}>

                            {this.state.contents ? this.state.contents : null}
                        </Text>
                        <Text style={styles.aboutTitleStyle}>{languageJSON.contact_details}</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:' + this.state.email)} style={{ justifyContent: 'flex-start', alignItems: 'center', flexDirection: 'row' }}>
                            <Text style={styles.contacttype2}>{languageJSON.email + " : "}</Text>
                            <Text style={styles.contacttype1}> {this.state.email ? this.state.email : null}</Text>
                        </TouchableOpacity>
                        {this.state.phone ? (
                            <TouchableOpacity onPress={() => Linking.openURL('tel:' + String(this.state.phone).replace(/\s/g, ''))} style={{ justifyContent: 'flex-start', alignItems: 'center', flexDirection: 'row' }}>
                                <Text style={styles.contacttype2}>{languageJSON.phone + " : "}</Text>
                                <Text style={styles.contacttype1}> {this.state.phone}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </ScrollView>
            </View>

        );
    }

}
const styles = StyleSheet.create({
    mainView: {
        flex: 1,
        backgroundColor: colors.WHITE,
        //marginTop: StatusBar.currentHeight,

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
    container: {
        paddingHorizontal: 20,
        paddingBottom: 30
    },
    aboutTitleStyle: {
        color: colors.TEXT_DARK,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20,
        marginVertical: 15
    },
    aboutcontentmainStyle: {
        marginTop: 12,
        marginBottom: 60
    },
    aboutcontentStyle: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Light',
        fontSize: 15,
        letterSpacing: 1,
        marginVertical: 15,
    },
    contact: {
        marginTop: 6,
        marginLeft: 8,
        //flexDirection:'row',
        width: "100%",
        marginBottom: 30
    },
    contacttype1: {
        textAlign: 'left',
        color: colors.TEXT,
        fontFamily: 'Montserrat-Light',
        fontSize: 15,
    },
    contacttype2: {
        textAlign: 'left',
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 15,
    },
    row: {
        flexDirection: "row",
        marginBottom: 10
    }
})