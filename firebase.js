
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAuwNr97gtevWNUVRX536HRsR2nY7CeBT4",
  authDomain: "tracker-88101.firebaseapp.com",
  databaseURL: "https://tracker-88101-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tracker-88101",
  storageBucket: "tracker-88101.firebasestorage.app",
  messagingSenderId: "957560814421",
  appId: "1:957560814421:web:593fddb1d9bf9b3f96cddc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, onValue, remove };
