import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, addDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

async function seed() {
  const userId = "test-user-123";
  
  try {
    console.log(`Attempting to seed database: ${firebaseConfig.firestoreDatabaseId}`);
    
    // 1. Seed User
    await setDoc(doc(db, "users", userId), {
      name: "Sharma Family",
      address: "Sector 42, Neemuch",
      city: "Neemuch",
      householdId: "NM-42-101",
      swacchCoinBalance: 1250,
      totalWasteDiverted: 12.4,
      weeklyStats: {
        dryWaste: 18.5,
        wetWaste: 12.2,
        co2Saved: 12
      }
    });
    console.log("User seeded successfully!");

    // 2. Seed Offers
    const offers = [
      {
        businessName: "Jain Sweets",
        title: "10% off at Jain Sweets",
        description: "जैन स्वीट्स पर 10% की छूट",
        coinCost: 50,
        category: "Neemuch Local",
        imageUrl: "https://picsum.photos/seed/sweets/400/300"
      },
      {
        businessName: "Sharma Organic Groceries",
        title: "₹50 Cash Voucher",
        description: "₹50 नकद वाउचर",
        coinCost: 120,
        category: "Groceries",
        imageUrl: "https://picsum.photos/seed/groceries/400/300"
      },
      {
        businessName: "Modern Tailors & Suits",
        title: "Free Alteration Service",
        description: "मुफ्त अल्टरेशन सेवा",
        coinCost: 80,
        category: "Services",
        imageUrl: "https://picsum.photos/seed/tailor/400/300"
      }
    ];

    for (const offer of offers) {
      await addDoc(collection(db, "offers"), offer);
    }
    console.log("Offers seeded successfully!");

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
