import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  runTransaction, 
  collection, 
  serverTimestamp 
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Client SDK
const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // 1. getUserDashboardData(userId)
  app.get("/api/user/:userId/dashboard", async (req, res) => {
    try {
      const { userId } = req.params;
      const userDoc = await getDoc(doc(db, "users", userId));
      
      if (!userDoc.exists()) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      
      res.json({
        balance: userData?.swacchCoinBalance || 0,
        weeklyStats: userData?.weeklyStats || { dryWaste: 0, wetWaste: 0, co2Saved: 0 },
        impact: userData?.totalWasteDiverted || 0
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 2. generateHouseholdQR(userId)
  app.get("/api/user/:userId/qr", async (req, res) => {
    try {
      const { userId } = req.params;
      const userDoc = await getDoc(doc(db, "users", userId));
      
      if (!userDoc.exists()) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      
      const qrPayload = {
        householdId: userData?.householdId,
        userId: userId,
        city: userData?.city || "Neemuch",
        timestamp: new Date().toISOString()
      };

      res.json({ payload: JSON.stringify(qrPayload) });
    } catch (error) {
      console.error("Error generating QR payload:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 3. redeemOffer(userId, offerId)
  app.post("/api/redeem", async (req, res) => {
    try {
      const { userId, offerId, deliveryFee = 0 } = req.body;

      if (!userId || !offerId) {
        return res.status(400).json({ error: "Missing userId or offerId" });
      }

      const userRef = doc(db, "users", userId);
      const offerRef = doc(db, "offers", offerId);

      const result = await runTransaction(db, async (t) => {
        const userDoc = await t.get(userRef);
        const offerDoc = await t.get(offerRef);

        if (!userDoc.exists()) throw new Error("User not found");
        if (!offerDoc.exists()) throw new Error("Offer not found");

        const userData = userDoc.data();
        const offerData = offerDoc.data();

        const cost = (offerData?.coinCost || 0) + deliveryFee;
        const balance = userData?.swacchCoinBalance || 0;

        if (balance < cost) {
          throw new Error("Insufficient Swacch Coins");
        }

        // Deduct balance
        t.update(userRef, {
          swacchCoinBalance: balance - cost
        });

        // Create order record
        const orderRef = doc(collection(db, "orders"));
        t.set(orderRef, {
          userId,
          orderType: 'market',
          items: [{ type: offerData?.title, quantity: 1, cost: offerData?.coinCost || 0 }],
          totalCost: cost,
          status: 'pending',
          deliveryMethod: deliveryFee > 0 ? 'delivery' : 'pickup',
          createdAt: serverTimestamp()
        });

        // Create transaction record
        const transactionRef = doc(collection(db, "transactions"));
        t.set(transactionRef, {
          userId,
          businessId: offerData?.businessId || "unknown_business",
          type: "redemption",
          amount: -cost,
          description: `Redeemed: ${offerData?.title} at ${offerData?.businessName}${deliveryFee > 0 ? ` (incl. ${deliveryFee} coin delivery fee)` : ''}`,
          timestamp: serverTimestamp(),
          offerId,
          orderId: orderRef.id
        });

        return {
          success: true,
          receiptId: transactionRef.id,
          orderId: orderRef.id,
          newBalance: balance - cost,
          offerTitle: offerData?.title,
          businessName: offerData?.businessName
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error redeeming offer:", error);
      res.status(400).json({ error: error.message || "Redemption failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
