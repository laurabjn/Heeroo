// Configuration Expo dynamique : étend app.json et choisit l'environnement
// Firebase selon APP_ENV ("production" ou, par défaut, "development").
// Les profils EAS (eas.json) fixent APP_ENV ; en local, `npx expo start`
// tourne toujours sur le projet de développement.

const FIREBASE = {
  development: {
    apiKey: 'AIzaSyBiY6kn9SzdBguaoO2u8sCAP9b-vimbwn0',
    authDomain: 'heeroo-dev-49beb.firebaseapp.com',
    databaseURL: 'https://heeroo-dev-49beb-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'heeroo-dev-49beb',
    storageBucket: 'heeroo-dev-49beb.firebasestorage.app',
    messagingSenderId: '825776782989',
    appId: '1:825776782989:web:82c03984b7536ffb2c6cc4',
  },
  production: {
    apiKey: 'AIzaSyCdon7gKg8g-dNoYvuk4_gVy4y1zBKrKUw',
    authDomain: 'projet-test-d7cd9.firebaseapp.com',
    databaseURL: 'https://projet-test-d7cd9-default-rtdb.firebaseio.com',
    projectId: 'projet-test-d7cd9',
    storageBucket: 'projet-test-d7cd9.appspot.com',
    messagingSenderId: '355117543035',
    appId: '1:355117543035:web:b3ee9267f2e3f89bd8fcde',
  },
};

const FUNCTIONS_BASE_URL = {
  development: 'https://us-central1-heeroo-dev-49beb.cloudfunctions.net/',
  production: 'https://us-central1-projet-test-d7cd9.cloudfunctions.net/',
};

const GOOGLE_SERVICES = {
  development: './google-services.dev.json',
  production: './google-services.json',
};

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV === 'production' ? 'production' : 'development';
  const isProd = appEnv === 'production';

  return {
    ...config,
    name: isProd ? config.name : `${config.name} Dev`,
    android: {
      ...config.android,
      googleServicesFile: GOOGLE_SERVICES[appEnv],
    },
    extra: {
      ...config.extra,
      appEnv,
      firebase: FIREBASE[appEnv],
      functionsBaseUrl: FUNCTIONS_BASE_URL[appEnv],
    },
  };
};
