import React from 'react';
import { EditUser } from '../components';
import { StyleSheet, View, StatusBar } from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';

export default class EditProfilePage extends React.Component {
    constructor(props) {
        super(props);
    }

    clickRegister = async (fname, lname, mobile, email, password, companyName, companyAddress) => {
        let regData = {
            firstName: fname,
            lastName: lname,
            mobile: mobile,
            email: email,
            companyName,
            companyAddress,
        }

        var curuser = firebase.auth().currentUser.uid;
        const userData = firebase.database().ref('users/' + curuser).update(regData).then(() => {
            this.props.navigation.goBack();
        })

    }

    render() {
        return (
            <View style={styles.containerView}>
                <EditUser
                    navigation={this.props.navigation}
                    complexity={'complex'}
                    onPressRegister={this.clickRegister}
                    onPress={() => { this.clickRegister() }}
                />
            </View>
        );
    }
}

//Screen Styling
const styles = StyleSheet.create({
    containerView: { flex: 1 },
    textContainer: { textAlign: "center" },
});
