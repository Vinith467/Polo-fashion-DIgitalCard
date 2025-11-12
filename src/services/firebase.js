// Firebase Configuration and Initialization
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCJWXsmRLxi7a66IfR3xR57CvI2otZ1sdY",
    authDomain: "polo-fashions.firebaseapp.com",
    projectId: "polo-fashions",
    storageBucket: "polo-fashions.firebasestorage.app",
    messagingSenderId: "952281661533",
    appId: "1:952281661533:web:c685b9a2c3e350bc5f0db4",
    measurementId: "G-0Y2FPT4G7G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };