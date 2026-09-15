import { notifyRef, notifyEditRef, authRef } from "../config/firebase";
import {
  FETCH_NOTIFICATIONS,
  FETCH_NOTIFICATIONS_SUCCESS,
  FETCH_NOTIFICATIONS_FAILED,
  EDIT_NOTIFICATIONS,
  SEND_NOTIFICATION,
  SEND_NOTIFICATION_SUCCESS,
  SEND_NOTIFICATION_FAILED,
} from "./types";

import { store } from "../reducers/store";
import 'firebase/database';
import languageJson from "../config/language";
import { push_notifications_url } from "../config/keys";
export const fetchNotifications = () => dispatch => {
  dispatch({
    type: FETCH_NOTIFICATIONS,
    payload: null
  });
  notifyRef.on("value", snapshot => {
    if (snapshot.val()) {
      const data = snapshot.val();

      const arr = Object.keys(data).map(i => {
        data[i].id = i
        return data[i]
      });

      dispatch({
        type: FETCH_NOTIFICATIONS_SUCCESS,
        payload: arr
      });
    } else {
      dispatch({
        type: FETCH_NOTIFICATIONS_FAILED,
        payload: "No data available."
      });
    }
  });
};

export const editNotifications = (notifications, method) => dispatch => {

  dispatch({
    type: EDIT_NOTIFICATIONS,
    payload: { method, notifications }
  });
  if (method === 'Add') {
    notifyRef.push(notifications);
  } else if (method === 'Delete') {
    notifyEditRef(notifications.id).remove();
  } else {
    notifyEditRef(notifications.id).set(notifications);
  }
}


export const chunkArray = (myArray, chunk_size) => {
  var index = 0;
  var arrayLength = myArray.length;
  var tempArray = [];

  for (index = 0; index < arrayLength; index += chunk_size) {
    tempArray.push(myArray.slice(index, index + chunk_size));
  }
  return tempArray;
};

export const sendNotification = (notification) => dispatch => {
  console.log(notification)
  dispatch({
    type: SEND_NOTIFICATION,
    payload: notification
  });

  let users = store.getState().usersdata.users;
  let arr = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].country === notification.country) {

      let usr = users[i];
      let obj = {
        "to": null,
        "title": notification.title,
        "body": notification.body,
        "priority": "high",
        "sound": "default",
        "channelId": "messages",
        "_displayInForeground": true
      };
      if (notification.usertype === 'All' && notification.devicetype === 'All') {
        if (usr.pushToken) {
          obj.to = usr.pushToken;
          arr.push(obj);
        }
      } else if (notification.usertype === 'All' && notification.devicetype !== 'All') {
        if (usr.pushToken && usr.userPlatform === notification.devicetype) {
          obj.to = usr.pushToken;
          arr.push(obj);
        }
      } else if (notification.usertype !== 'All' && notification.devicetype === 'All') {
        if (usr.pushToken && usr.usertype === notification.usertype) {
          obj.to = usr.pushToken;
          arr.push(obj);
        }
      } else {
        if (usr.pushToken && usr.usertype === notification.usertype && usr.userPlatform === notification.devicetype) {
          obj.to = usr.pushToken;
          arr.push(obj);
        }
      }
    }
  }

  if (arr.length > 0) {
    const params = {
      list: arr
    }
    authRef.currentUser.getIdToken().then((idToken) => fetch(push_notifications_url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + idToken
      },
      method: 'post',
      body: JSON.stringify(params)
    }))
      .then((responseJson) => {
        dispatch({
          type: SEND_NOTIFICATION_SUCCESS,
          payload: responseJson
        });
      })
      .catch((error) => {
        console.log("error", error)
        dispatch({
          type: SEND_NOTIFICATION_FAILED,
          payload: error,
        });
      });
    alert(arr.length + languageJson.notification_sent);
  } else {
    dispatch({
      type: SEND_NOTIFICATION_FAILED,
      payload: languageJson.no_user_match,
    });
    alert(languageJson.no_user_matching);
  }
}
