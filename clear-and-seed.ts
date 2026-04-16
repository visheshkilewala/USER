import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

async function clearCollection(collectionName: string) {
  const snapshot = await getDocs(collection(db, collectionName));
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, collectionName, document.id));
  }
  console.log(`Cleared collection: ${collectionName}`);
}

async function seed() {
  try {
    console.log(`Attempting to clear and seed database: ${firebaseConfig.firestoreDatabaseId}`);
    
    // Get existing users to preserve their UIDs if any exist
    const usersSnapshot = await getDocs(collection(db, "users"));
    const existingUids = usersSnapshot.docs.map(d => d.id);
    
    await clearCollection("users");
    await clearCollection("transactions");
    await clearCollection("offers");

    // 1. Seed User
    // If there's an existing logged-in user, use their UID so they see the data.
    // Otherwise, use a dummy UID.
    const userId = existingUids.length > 0 ? existingUids[0] : "test-user-123";
    
    await setDoc(doc(db, "users", userId), {
      uid: userId,
      name: "Aarav Sharma",
      address: "Sector 42, Green Park",
      city: "Neemuch",
      householdId: "NM-42-101",
      swacchCoinBalance: 2450,
      totalWasteDiverted: 142.5,
      weeklyStats: {
        dryWaste: 18.5,
        wetWaste: 12.2,
        co2Saved: 45.2
      },
      createdAt: new Date().toISOString()
    });
    console.log(`User seeded successfully with UID: ${userId}`);

    // Seed some transactions for this user
    const transactions = [
      {
        userId,
        amount: 500,
        description: "Weekly Dry Waste Bonus",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        type: "earned"
      },
      {
        userId,
        amount: 250,
        description: "Compost Contribution",
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        type: "earned"
      },
      {
        userId,
        amount: -100,
        description: "Redeemed: Jain Sweets Discount",
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        type: "spent"
      }
    ];

    for (const tx of transactions) {
      await addDoc(collection(db, "transactions"), tx);
    }
    console.log("Transactions seeded successfully!");

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

    console.log("Database cleared and seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
