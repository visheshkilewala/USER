import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

async function check() {
  const usersSnapshot = await getDocs(collection(db, "users"));
  console.log("Users in DB:");
  usersSnapshot.docs.forEach(d => {
    console.log(d.id, d.data().name, d.data().swacchCoinBalance);
  });
  process.exit(0);
}

check();
