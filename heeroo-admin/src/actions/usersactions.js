import { userRef, singleUserRef, authRef } from "../config/firebase";
import { delete_auth_user_url, admin_wallet_adjust_url } from "../config/keys";
import { 
    FETCH_ALL_USERS,
    FETCH_ALL_USERS_SUCCESS,
    FETCH_ALL_USERS_FAILED,
    EDIT_USER,
    EDIT_USER_SUCCESS,
    EDIT_USER_FAILED,
    DELETE_USER,
    DELETE_USER_SUCCESS,
    DELETE_USER_FAILED,
} from "./types";

export const fetchUsers = () => dispatch => {
    dispatch({
      type: FETCH_ALL_USERS,
      payload: null
    });
    userRef.on("value", snapshot => {
      if (snapshot.val()) {
        const data = snapshot.val();
        const arr = Object.keys(data).map(i => {
          data[i].id = i
          return data[i]
        });
        dispatch({
          type: FETCH_ALL_USERS_SUCCESS,
          payload: arr
        });
      } else {
        dispatch({
          type: FETCH_ALL_USERS_FAILED,
          payload: "No users available."
        });
      }
    });
  };

  export const editUser = (id,user) => dispatch =>{
    dispatch({
      type: EDIT_USER,
      payload: user
    });
    let editedUser = user;
    if(user.refferalBonus) editedUser.refferalBonus = parseFloat(editedUser.refferalBonus);
    delete editedUser.id;
    singleUserRef(id).set(editedUser).then(()=>{
      dispatch({
        type: EDIT_USER_SUCCESS,
        payload: null
      });  
    }).catch((error)=>{
      dispatch({
        type: EDIT_USER_FAILED,
        payload: error
      });        
    });
  }

  export const deleteUser = (id) => dispatch =>{
    dispatch({
      type: DELETE_USER,
      payload: id
    });

    singleUserRef(id).remove().then(async ()=>{
      await deleteAuthUser(id);
      dispatch({
        type: DELETE_USER_SUCCESS,
        payload: null
      });  
    }).catch((error)=>{
      dispatch({
        type: DELETE_USER_FAILED,
        payload: error
      });        
    });

  }

  const deleteAuthUser = async (id) => {
    const params = {
      id
    }
    const idToken = await authRef.currentUser.getIdToken();
    return fetch(delete_auth_user_url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + idToken
      },
      method: 'post',
      body: JSON.stringify(params)
    }).then(response => response.json())
      .catch(error => {
        console.log("error",error)
      });
  }

// Recharge ou correction manuelle du crédit d'un chauffeur (espèces à l'agence,
// geste commercial). Passe par le serveur : le solde n'est jamais modifié
// directement depuis le back-office. Résout avec { success, balance } ou { error }.
export const adjustDriverWallet = async (uid, amount, note) => {
  const idToken = await authRef.currentUser.getIdToken();
  const response = await fetch(admin_wallet_adjust_url, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    method: 'post',
    body: JSON.stringify({ uid, amount, note }),
  });
  return response.json();
};
