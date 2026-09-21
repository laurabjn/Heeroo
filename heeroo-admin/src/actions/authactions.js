import { authRef, singleUserRef, FIREBASE_AUTH_PERSIST } from "../config/firebase";
import { ensure_admin_claim_url } from "../config/keys";
import {
  FETCH_USER,
  FETCH_USER_SUCCESS,
  FETCH_USER_FAILED,
  USER_SIGN_IN,
  USER_SIGN_IN_FAILED,
  USER_SIGN_OUT,
  CLEAR_LOGIN_ERROR
} from "./types";

export const fetchUser = () => dispatch => {
  dispatch({
    type: FETCH_USER,
    payload: null
  });
  authRef.onAuthStateChanged(user => {
    if (user) {
      // Le badge administrateur (custom claim) est posé côté serveur : on
      // force un jeton frais pour que le stockage le voie dès la connexion,
      // et on signale clairement s'il manque encore.
      // 1. le serveur pose le badge si le compte est admin en base et ne l'a pas encore ;
      // 2. jeton rafraîchi pour le voir immédiatement.
      user.getIdToken().then((idToken) => fetch(ensure_admin_claim_url, {
        method: 'post',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
        body: '{}',
      }).then((r) => r.json()).catch(() => ({}))).catch(() => ({}))
      .then(() => user.getIdTokenResult(true)).then((result) => {
        window.__heerooAdminClaim = result.claims.admin === true;
        if (!window.__heerooAdminClaim) {
          console.warn('[Heeroo] jeton sans badge administrateur pour', user.uid, '— déconnexion/reconnexion nécessaire après attribution du rôle');
          const banner = document.createElement('div');
          banner.id = 'heeroo-claim-banner';
          banner.textContent = "Rôle administrateur pas encore actif sur cette session : déconnectez-vous puis reconnectez-vous. Si le message persiste, contactez Laura.";
          banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#b00020;color:#fff;padding:10px 16px;font:14px sans-serif;text-align:center';
          if (!document.getElementById('heeroo-claim-banner')) document.body.appendChild(banner);
        }
      }).catch(() => {});

      singleUserRef(user.uid).once("value", snapshot => {

        if (snapshot.val() && snapshot.val().isAdmin) {

          dispatch({
            type: FETCH_USER_SUCCESS,
            payload: user
          });
        } else {
          authRef
            .signOut()
            .then(() => {
              dispatch({
                type: USER_SIGN_IN_FAILED,
                payload: "This login is a valid user but not Admin"
              });
            })
            .catch(error => {
              dispatch({
                type: USER_SIGN_IN_FAILED,
                payload: error
              });
            });
        }
      });

    } else {

      dispatch({
        type: FETCH_USER_FAILED,
        payload: null
      });
    }
  });
};

export const signIn = (username, password) => dispatch => {
  authRef.setPersistence(FIREBASE_AUTH_PERSIST)
    .then(function () {
      authRef
        .signInWithEmailAndPassword(username, password)
        .then(user => {
          dispatch({
            type: USER_SIGN_IN,
            payload: null
          });
        })
        .catch(error => {
          dispatch({
            type: USER_SIGN_IN_FAILED,
            payload: error
          });
        });
    })
    .catch(function (error) {
      dispatch({
        type: USER_SIGN_IN_FAILED,
        payload: "Firebase Auth Error"
      });
    });
};

export const signOut = () => dispatch => {
  authRef
    .signOut()
    .then(() => {
      dispatch({
        type: USER_SIGN_OUT,
        payload: null
      });
    })
    .catch(error => {
      //console.log(error);
    });
};

export const clearLoginError = () => dispatch => {
  dispatch({
    type: CLEAR_LOGIN_ERROR,
    payload: null
  });
};