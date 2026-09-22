import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

// Fournisseur de cartes selon la plateforme.
//
// Android : Google Maps (react-native-maps l'exige, la clé est dans app.json).
// iOS     : Apple Plans, le fournisseur natif. react-native-maps ne propose
//           plus Google Maps sur iOS depuis la version 1.21 ; le réclamer fait
//           échouer la compilation (podspec react-native-google-maps absent).
export const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
