import React from 'react';
import { Notifications } from '../components';
import languageJSON from '../common/language';
import {
    StyleSheet,
    View,
    Text,
    StatusBar,
    TouchableWithoutFeedback
} from 'react-native';
import { Header } from 'react-native-elements';
import { colors } from '../common/theme';
import { BackBtn, NotificationBtn } from '../components';


export default class NotificationPage extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <View style={styles.mainView}>
                <Header
                    backgroundColor={colors.TRANSPARENT}
                    leftComponent={<BackBtn {...this.props} />}
                    centerComponent={<Text style={styles.headerTitleStyle}>{languageJSON.notification}</Text>}
                    containerStyle={styles.headerStyle}
                />
                <Notifications></Notifications>
            </View>
        );
    }
}

//Screen Styling
const styles = StyleSheet.create({
    headerStyle: {
        borderBottomWidth: 0,
        paddingHorizontal: 20,
        marginBottom: 15
    },
    headerTitleStyle: {
        color: colors.TEXT,
        fontFamily: 'Montserrat-Bold',
        fontSize: 20
    },
    containerView: {
        flex: 1
    },
    textContainer: {
        textAlign: "center"
    },
    mainView: {
        flex: 1,
        backgroundColor: colors.WHITE,
        //marginTop: StatusBar.currentHeight
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 200
    },
});
