import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

async function fix() {
  const userId = "kEnQ5Q0UGUV29fSlW4py2gaXkNq2"; // The UID from check-db
  await updateDoc(doc(db, "users", userId), {
    swacchCoinBalance: 2450,
    totalWasteDiverted: 142.5,
    "weeklyStats.dryWaste": 18.5,
    "weeklyStats.wetWaste": 12.2,
    "weeklyStats.co2Saved": 45.2
  });
  console.log("Fixed balance!");
  process.exit(0);
}

fix();
