import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";
import config from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(config);
const db = config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)"
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

const offers = [
  {
    id: 'offer_jain_sweets',
    businessId: 'biz_jain_sweets',
    businessName: "Jain Sweets",
    title: "10% off at Jain Sweets",
    description: "Enjoy a 10% discount on all traditional sweets and namkeen. (जैन स्वीट्स पर 10% की छूट)",
    coinCost: 50,
    category: "Neemuch Local",
    imageUrl: "https://picsum.photos/seed/sweets/400/300"
  },
  {
    id: 'offer_sharma_groceries',
    businessId: 'biz_sharma_organic_groceries',
    businessName: "Sharma Organic Groceries",
    title: "₹50 Off on Organic Veggies",
    description: "Get ₹50 off on your next purchase of fresh organic vegetables.",
    coinCost: 100,
    category: "Groceries",
    imageUrl: "https://picsum.photos/seed/vegetables/400/300"
  },
  {
    id: 'offer_modern_tailors',
    businessId: 'biz_modern_tailors___suits',
    businessName: "Modern Tailors",
    title: "Free Alteration Service",
    description: "Redeem for one free basic clothing alteration (hemming, button repair, etc).",
    coinCost: 75,
    category: "Services",
    imageUrl: "https://picsum.photos/seed/tailor/400/300"
  },
  {
    id: 'offer_neemuch_cinema',
    businessId: 'biz_neemuch_cinema',
    businessName: "City Cinema",
    title: "Free Popcorn with Ticket",
    description: "Get a free medium popcorn when you buy a movie ticket.",
    coinCost: 150,
    category: "Events",
    imageUrl: "https://picsum.photos/seed/popcorn/400/300"
  },
  {
    id: 'offer_green_cafe',
    businessId: 'biz_green_cafe',
    businessName: "Green Leaf Cafe",
    title: "Buy 1 Get 1 Free Coffee",
    description: "Enjoy a free coffee with the purchase of any coffee beverage.",
    coinCost: 120,
    category: "Neemuch Local",
    imageUrl: "https://picsum.photos/seed/coffee/400/300"
  },
  {
    id: 'offer_fresh_mart',
    businessId: 'biz_fresh_mart',
    businessName: "Fresh Mart",
    title: "5% Off Total Bill",
    description: "Get a 5% discount on your entire grocery bill (up to ₹2000).",
    coinCost: 200,
    category: "Groceries",
    imageUrl: "https://picsum.photos/seed/grocery/400/300"
  }
];

async function seedOffers() {
  console.log("Seeding offers...");
  
  for (const offer of offers) {
    console.log(`Adding offer: ${offer.title}`);
    await setDoc(doc(db, "offers", offer.id), offer);
  }
  
  console.log("Offers seeded successfully.");
  process.exit(0);
}

seedOffers().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
