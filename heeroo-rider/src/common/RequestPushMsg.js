import languageJSON from './language';
import { sendMessage_url } from './key';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';

export async function RequestPushMsg(token, msg, bookingId, title) {
    if (!token) return false;
    const params = {
        msg: msg,
        title: title ? title : languageJSON.notification_title,
        token: token,
        bookingId: bookingId || null,
    };
    try {
        const idToken = await firebase.auth().currentUser.getIdToken();
        const response = await fetch(sendMessage_url, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + idToken,
            },
            method: 'post',
            body: JSON.stringify(params),
        });
        const data = await response.json();
        if (!data.success) console.log('[push] non envoyé :', data);
        return data.success === true;
    } catch (error) {
        console.log('[push] erreur', error);
        return false;
    }
}
