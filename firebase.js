import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCYt0eTx8qbeQ7yyb_vaMHNNvSnP-SStYk",
  authDomain: "barber-shop-1789f.firebaseapp.com",
  projectId: "barber-shop-1789f",
  storageBucket: "barber-shop-1789f.firebasestorage.app",
  messagingSenderId: "35729599748",
  appId: "1:35729599748:web:8656043a4eb98a323e7451",
  measurementId: "G-9C6WM65875"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth };