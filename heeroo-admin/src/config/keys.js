// Environnement Firebase du back-office : production par défaut (c'est ce que
// le client utilise), développement avec REACT_APP_ENV=development, par exemple
//   REACT_APP_ENV=development npm start
// Les valeurs sont celles de heeroo-rider/app.config.js.
const ENV = process.env.REACT_APP_ENV === 'development' ? 'development' : 'production';

const FIREBASE = {
  development: {
    apiKey: "AIzaSyBiY6kn9SzdBguaoO2u8sCAP9b-vimbwn0",
    authDomain: "heeroo-dev-49beb.firebaseapp.com",
    databaseURL: "https://heeroo-dev-49beb-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "heeroo-dev-49beb",
    storageBucket: "heeroo-dev-49beb.firebasestorage.app",
    messagingSenderId: "825776782989",
    appId: "1:825776782989:web:82c03984b7536ffb2c6cc4",
  },
  production: {
    apiKey: "AIzaSyCdon7gKg8g-dNoYvuk4_gVy4y1zBKrKUw",
    authDomain: "projet-test-d7cd9.firebaseapp.com",
    databaseURL: "https://projet-test-d7cd9-default-rtdb.firebaseio.com",
    projectId: "projet-test-d7cd9",
    storageBucket: "projet-test-d7cd9.appspot.com",
    messagingSenderId: "355117543035",
    appId: "1:355117543035:web:b3ee9267f2e3f89bd8fcde",
  },
};

const FUNCTIONS_BASE_URL = {
  development: "https://us-central1-heeroo-dev-49beb.cloudfunctions.net/",
  production: "https://us-central1-projet-test-d7cd9.cloudfunctions.net/",
};

export const APP_ENV = ENV;
export const FirebaseConfig = FIREBASE[ENV];

export const google_map_key = 'AIzaSyD_i3DFnhk1Cs36eFGz2eMcwto-50JIiBw';
export const exchange_access_key = '5df860682e9ae9abe41e0c898de8724b';
export const baseUrl = FUNCTIONS_BASE_URL[ENV];
export const delete_auth_user_url = baseUrl + "delete_auth_user";
export const push_notifications_url = baseUrl + "push_notifications";
export const admin_wallet_adjust_url = baseUrl + "adminWalletAdjust";
export const ensure_admin_claim_url = baseUrl + "ensureAdminClaim";
