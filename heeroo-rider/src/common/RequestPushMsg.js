import languageJSON from './language';
import { firebase_server_key, sendMessage_url } from './key';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import 'firebase/compat/functions';

export function RequestPushMsg(token, msg, bookingId, title) {

    const params = {
        msg: msg,
        title: title ? title : languageJSON.notification_title,
        token: token
    }

    fetch(sendMessage_url, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        method: 'post',
        body: JSON.stringify(params)
    }).then((response) => {
        response.json().then(data => {
            console.log("data :", data)

        })
    }).catch(error => {
        console.log("error", error)
        return false;
    });



}