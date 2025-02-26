import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyDrkvaHkM6T8TgbpW-_41yvloTJf97r-ok",
  authDomain: "react-app-lernen.firebaseapp.com",
  projectId: "react-app-lernen",
  storageBucket: "react-app-lernen.firebasestorage.app",
  messagingSenderId: "256889249109",
  appId: "1:256889249109:web:6a9a126e692445cd7723dc",
  measurementId: "G-P8LERT9YDN"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);

// Initialize Analytics only on web platform
export const analytics = Platform.select({
  web: async () => {
    if (await isSupported()) {
      return getAnalytics(app);
    }
    return null;
  },
  default: () => null,
})();