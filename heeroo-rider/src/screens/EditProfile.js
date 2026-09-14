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

    //register button click after all validation
    async clickRegister(fname, lname, mobile, email) {
        // set data set for update user 
        let regData = {
            firstName: fname,
            lastName: lname,
            mobile: mobile,
            email: email,
        }

        let curuser = firebase.auth().currentUser.uid;
        firebase.database().ref('users/' + curuser).update(regData).then(() => {
            this.props.navigation.pop();
        })

    }

    render() {
        return (
            <View style={styles.containerView}>
                <EditUser complexity={'complex'} onPressRegister={(fname, lname, mobile, email, password) => this.clickRegister(fname, lname, mobile, email, password)} onPress={() => { this.clickRegister() }} navigation={this.props.navigation}></EditUser>
            </View>
        );
    }
}
const styles = StyleSheet.create({
    containerView: {
        flex: 1,
        //marginTop: StatusBar.currentHeight 
    },
    textContainer: { textAlign: "center" },
});