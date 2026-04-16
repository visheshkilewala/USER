import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, 
  Wallet, 
  Store, 
  User as UserIcon, 
  QrCode, 
  TrendingUp, 
  ShoppingBag, 
  BookOpen, 
  Truck, 
  Plus, 
  Coins, 
  Gift, 
  Leaf, 
  Trophy, 
  Ticket, 
  Coffee,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  LogIn,
  LogOut,
  X,
  MessageCircle,
  Send,
  AlertTriangle,
  Camera,
  Tag,
  Check,
  MapPin,
  Zap,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import QRCode from 'react-qr-code';

// --- Firebase ---
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp, updateDoc, orderBy } from 'firebase/firestore';

// --- Types ---
import { User, Offer, Transaction } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Hooks ---

const useUserDashboard = (userId: string | undefined) => {
  const [data, setData] = useState<{ balance: number; weeklyStats: any; impact: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Use onSnapshot for real-time updates from Firestore directly
    const unsub = onSnapshot(doc(db, "users", userId), async (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setData({
          balance: userData.swacchCoinBalance || 0,
          weeklyStats: userData.weeklyStats || { dryWaste: 0, wetWaste: 0, co2Saved: 0 },
          impact: userData.totalWasteDiverted || 0
        });
        setLoading(false);
      } else {
        // Create default user profile if it doesn't exist
        try {
          await setDoc(doc(db, 'users', userId), {
            uid: userId,
            swacchCoinBalance: 0,
            totalWasteDiverted: 0,
            weeklyStats: {
              dryWaste: 0,
              wetWaste: 0,
              co2Saved: 0
            },
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error("Error creating default user profile:", e);
          setError("User profile not found and could not be created.");
          setLoading(false);
        }
      }
    }, (err) => {
      console.error("Firestore error:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { data, loading, error };
};

const useRedeemOffer = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = async (userId: string, offerId: string, deliveryFee: number = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, offerId, deliveryFee })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Redemption failed');
      }
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { redeem, loading, error };
};

const useTransactions = (userId: string | undefined) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "transactions"), where("userId", "==", userId));
    const unsub = onSnapshot(q, (snap) => {
      const txs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Sort client-side to avoid needing a composite index
      txs.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      setTransactions(txs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching transactions:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { transactions, loading };
};

const useOrders = (userId: string | undefined) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { orders, loading };
};

const useUserProfile = (userId: string | undefined) => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "users", userId), async (docSnap) => {
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...docSnap.data() } as User);
        setLoading(false);
      } else {
        try {
          await setDoc(doc(db, 'users', userId), {
            uid: userId,
            swacchCoinBalance: 0,
            totalWasteDiverted: 0,
            weeklyStats: {
              dryWaste: 0,
              wetWaste: 0,
              co2Saved: 0
            },
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error("Error creating default user profile:", e);
          setLoading(false);
        }
      }
    });
    return () => unsub();
  }, [userId]);

  return { profile, loading };
};

// --- Components ---

const OrdersScreen = ({ userId }: { userId: string }) => {
  const { orders: dbOrders, loading: ordersLoading } = useOrders(userId);
  const { transactions, loading: txLoading } = useTransactions(userId);

  if (ordersLoading || txLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
      </motion.div>
    );
  }

  // Find legacy market orders from transactions
  // A legacy market order is a transaction of type 'redemption' that doesn't have an orderId
  const legacyMarketOrders = transactions
    .filter(tx => tx.type === 'redemption' && !(tx as any).orderId)
    .map(tx => {
      // Parse description to get item name. Description format: "Redeemed: {offerTitle} at {businessName}..."
      const titleMatch = tx.description?.match(/Redeemed: (.*?) at/);
      const title = titleMatch ? titleMatch[1] : 'Market Offer';
      
      return {
        id: tx.id,
        orderType: 'market',
        items: [{ type: title, quantity: 1, cost: Math.abs(tx.amount) }],
        totalCost: Math.abs(tx.amount),
        status: 'delivered', // Legacy ones are considered delivered/completed
        deliveryMethod: tx.description?.includes('delivery fee') ? 'delivery' : 'pickup',
        createdAt: tx.timestamp
      };
    });

  const allOrders = [...dbOrders, ...legacyMarketOrders].sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  const activeOrders = allOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  const pastOrders = allOrders.filter(o => o.status === 'delivered' || o.status === 'cancelled');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-24"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 flex items-center justify-center border border-brand-gold/30">
          <Package className="text-brand-gold" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white font-headline tracking-tight">Your Orders</h1>
          <p className="text-brand-gold/60 text-sm font-body">Track and manage your smart bags</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white font-headline flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-neon-blue animate-pulse"></span>
          Active Orders
        </h2>
        
        {activeOrders.length === 0 ? (
          <div className="vedic-panel p-8 rounded-[32px] text-center border border-brand-gold/20">
            <Package className="mx-auto text-brand-gold/30 mb-3" size={48} />
            <p className="text-brand-gold/60 font-body">No active orders right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeOrders.map(order => (
              <div key={order.id} className="vedic-panel p-5 rounded-3xl border border-brand-gold/30 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 circuit-bg opacity-10"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex gap-2 mb-2">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-brand-neon-blue/20 text-brand-neon-blue text-[10px] font-bold uppercase tracking-wider">
                          {order.status || 'Pending'}
                        </span>
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-brand-gold/20 text-brand-gold text-[10px] font-bold uppercase tracking-wider">
                          {order.deliveryMethod === 'pickup' ? 'Pick-up' : 'Delivery'}
                        </span>
                      </div>
                      <p className="text-xs text-brand-gold/60 font-mono">Order #{order.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-brand-gold font-bold font-headline">{order.totalCost} 🪙</p>
                      <p className="text-[10px] text-brand-gold/40 font-body">
                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Just now'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-white/90 font-body">{item.quantity}x {item.type}</span>
                        {item.color && <span className="text-brand-gold/60 text-xs">({item.color})</span>}
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-brand-gold/20 flex gap-3">
                    {order.deliveryMethod === 'pickup' ? (
                      <button 
                        onClick={() => window.open('https://maps.google.com/?q=Swacchta+Mitra+Collection+Center', '_blank')}
                        className="flex-1 flex items-center justify-center gap-2 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold py-2.5 rounded-xl text-sm font-bold transition-colors border border-brand-gold/30"
                      >
                        <MapPin size={16} />
                        Get Directions
                      </button>
                    ) : (
                      <button 
                        onClick={() => alert('Tracking information will be available once the order is dispatched.')}
                        className="flex-1 flex items-center justify-center gap-2 bg-brand-neon-blue/10 hover:bg-brand-neon-blue/20 text-brand-neon-blue py-2.5 rounded-xl text-sm font-bold transition-colors border border-brand-neon-blue/30"
                      >
                        <Truck size={16} />
                        Track Delivery
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pastOrders.length > 0 && (
        <div className="space-y-4 pt-6">
          <h2 className="text-lg font-bold text-white/50 font-headline">Past Orders</h2>
          <div className="space-y-3 opacity-70">
            {pastOrders.map(order => (
              <div key={order.id} className="bg-brand-steel/50 p-4 rounded-2xl border border-brand-gold/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-brand-gold/40 font-mono">#{order.id.slice(-6).toUpperCase()}</span>
                  <div className="flex gap-2">
                    <span className="text-xs font-bold text-white/40 uppercase">{order.deliveryMethod === 'pickup' ? 'Pick-up' : 'Delivery'}</span>
                    <span className="text-xs font-bold text-white/40 uppercase">•</span>
                    <span className="text-xs font-bold text-white/40 uppercase">{order.status}</span>
                  </div>
                </div>
                <p className="text-sm text-white/60">{order.items?.length || 0} items • {order.totalCost} 🪙</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const BottomNav = ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'market', label: 'Market', icon: Store },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-3 pt-2 pb-6 nav-blur z-50 rounded-t-[32px] border-t border-brand-gold/30">
      <div className="absolute inset-0 mandala-bg opacity-20 rounded-t-[32px] pointer-events-none"></div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex flex-col items-center justify-center px-5 py-2 transition-all duration-300 active:scale-95 relative z-10",
            activeTab === tab.id 
              ? "text-brand-gold cyber-glow-blue" 
              : "text-stone-400 hover:text-brand-gold/60"
          )}
        >
          {activeTab === tab.id && (
            <motion.div 
              layoutId="nav-active"
              className="absolute inset-0 bg-brand-gold/10 rounded-2xl -z-10 border border-brand-gold/20"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <tab.icon size={20} className={activeTab === tab.id ? "fill-current" : ""} />
          <span className="font-body text-[10px] font-semibold tracking-wide mt-1.5 uppercase opacity-80">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

const HeroWalletCard = ({ balance, onClaimRewards }: { balance: number, onClaimRewards: () => void }) => {
  return (
    <section className="relative overflow-hidden vedic-panel rounded-[32px] p-8">
      <div className="absolute inset-0 circuit-bg opacity-30"></div>
      <div className="absolute -right-10 -top-10 w-48 h-48 bg-brand-neon-purple opacity-20 rounded-full blur-3xl"></div>
      <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-brand-neon-blue opacity-20 rounded-full blur-2xl"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-brand-gold/80 font-body text-xs font-bold tracking-[0.1em] uppercase">Swacch Coin Balance</span>
            <h2 className="text-5xl font-black text-white tracking-tighter mt-1 cyber-glow-blue font-headline">
              {balance.toLocaleString()}
              <span className="text-2xl ml-2 opacity-60 font-medium">🪙</span>
            </h2>
          </div>
          <div className="w-14 h-14 rounded-full bg-brand-gold/10 flex items-center justify-center backdrop-blur-md border border-brand-gold/30">
            <Wallet className="text-brand-gold" size={24} />
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-brand-gold/60 text-[11px] font-medium uppercase tracking-wider">
          <TrendingUp size={12} />
          <span>Equivalent to ₹{(balance / 10).toFixed(0)} rewards</span>
        </div>
        
        <div className="mt-8">
          <button 
            onClick={onClaimRewards}
            className="bg-gradient-to-r from-brand-gold to-yellow-400 text-brand-steel px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 hover:opacity-90 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,215,0,0.4)]"
          >
            <Store size={16} />
            Redeem Rewards
          </button>
        </div>
      </div>
    </section>
  );
};

const SegregationGuideModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  const categories = [
    { name: "Dry Waste (सूखा कचरा)", examples: "Paper, Cardboard, Clean Plastic", points: "10 pts/kg", color: "bg-brand-neon-blue/10 text-brand-neon-blue border-brand-neon-blue/30" },
    { name: "Wet Waste (गीला कचरा)", examples: "Food scraps, Vegetable peels", points: "5 pts/kg", color: "bg-brand-emerald/10 text-brand-emerald border-brand-emerald/30" },
    { name: "E-Waste (ई-कचरा)", examples: "Old phones, Batteries, Wires", points: "50 pts/kg", color: "bg-brand-neon-purple/10 text-brand-neon-purple border-brand-neon-purple/30" },
    { name: "Hazardous (हानिकारक)", examples: "Paint cans, Chemicals, Bulbs", points: "0 pts (Safe disposal)", color: "bg-brand-ruby/10 text-brand-ruby border-brand-ruby/30" },
    { name: "Sanitary (स्वच्छता)", examples: "Diapers, Bandages", points: "0 pts (Safe disposal)", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
    { name: "Glass & Metal (कांच और धातु)", examples: "Glass bottles, Metal cans", points: "20 pts/kg", color: "bg-stone-400/10 text-stone-300 border-stone-400/30" }
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="vedic-panel rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 mandala-bg opacity-10 pointer-events-none"></div>
        <div className="vedic-panel p-4 border-b border-brand-gold/20 flex justify-between items-center z-10 flex-shrink-0">
          <h2 className="text-xl font-bold vedic-gold-text font-headline">Segregation Guide</h2>
          <button onClick={onClose} className="p-2 bg-brand-gold/10 rounded-full hover:bg-brand-gold/20 transition-colors border border-brand-gold/30">
            <X size={20} className="text-brand-gold" />
          </button>
        </div>
        <div className="p-4 space-y-3 relative z-10 overflow-y-auto flex-1">
          {categories.map((cat, idx) => (
            <div key={idx} className={`p-4 rounded-xl border-y border-r border-l-4 border-l-current ${cat.color} backdrop-blur-sm relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-r from-current/5 to-transparent pointer-events-none"></div>
              <div className="flex justify-between items-start mb-1 relative z-10">
                <h3 className="font-bold font-headline">{cat.name}</h3>
                <span className="text-xs font-black bg-black/40 px-2 py-1 rounded-md border border-current/20">{cat.points}</span>
              </div>
              <p className="text-sm opacity-90 font-body relative z-10">Examples: {cat.examples}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

const ScheduleModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  const schedule = [
    { day: "Monday", type: "Wet & Dry Waste", time: "08:00 AM - 10:00 AM" },
    { day: "Tuesday", type: "Wet & Dry Waste", time: "08:00 AM - 10:00 AM" },
    { day: "Wednesday", type: "Wet & Dry Waste", time: "08:00 AM - 10:00 AM" },
    { day: "Thursday", type: "Wet & Dry Waste", time: "08:00 AM - 10:00 AM" },
    { day: "Friday", type: "Wet & Dry Waste", time: "08:00 AM - 10:00 AM" },
    { day: "Saturday", type: "Wet & Dry Waste", time: "08:00 AM - 10:00 AM" },
    { day: "Sunday", type: "Special Collection (E-Waste/Hazardous)", time: "09:00 AM - 12:00 PM" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="vedic-panel rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 circuit-bg opacity-10 pointer-events-none"></div>
        <div className="vedic-panel p-4 border-b border-brand-gold/20 flex justify-between items-center z-10 flex-shrink-0">
          <h2 className="text-xl font-bold vedic-gold-text font-headline">Weekly Schedule</h2>
          <button onClick={onClose} className="p-2 bg-brand-gold/10 rounded-full hover:bg-brand-gold/20 transition-colors border border-brand-gold/30">
            <X size={20} className="text-brand-gold" />
          </button>
        </div>
        <div className="p-4 space-y-3 relative z-10 overflow-y-auto flex-1">
          {schedule.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-brand-gold/20 bg-brand-steel/50 flex flex-col gap-1 backdrop-blur-sm">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-white font-headline">{item.day}</h3>
                <span className="text-xs font-bold text-brand-emerald bg-brand-emerald/10 border border-brand-emerald/30 px-2 py-1 rounded-md">{item.time}</span>
              </div>
              <p className="text-sm text-stone-400 font-body">{item.type}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

const HomeScreen = ({ userId, onNavigate }: { userId: string, onNavigate: (tab: string) => void }) => {
  const { data, loading } = useUserDashboard(userId);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isOrderBagsOpen, setIsOrderBagsOpen] = useState(false);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin"></div>
      <p className="vedic-gold-text font-headline italic text-lg cyber-glow-blue">Gathering your impact...</p>
    </div>
  );

  const dryWaste = data?.weeklyStats?.dryWaste || 0;
  const wetWaste = data?.weeklyStats?.wetWaste || 0;
  const totalWaste = dryWaste + wetWaste;
  const circumference = 251.2;
  const dryDash = totalWaste > 0 ? (dryWaste / totalWaste) * circumference : 0;
  const wetDash = totalWaste > 0 ? (wetWaste / totalWaste) * circumference : 0;
  const efficiency = totalWaste > 0 ? Math.round((dryWaste / totalWaste) * 100) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-24"
    >
      <HeroWalletCard balance={data?.balance || 0} onClaimRewards={() => onNavigate('market')} />

      {/* Weekly Impact */}
      <section className="vedic-panel rounded-[32px] p-8 relative overflow-hidden">
        <div className="absolute inset-0 mandala-bg opacity-10"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-2xl font-black vedic-gold-text tracking-tight font-headline">Weekly Impact</h3>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-1 font-body">Your segregation stats</p>
            </div>
            <span className="inline-block px-4 py-1.5 bg-brand-gold/20 text-brand-gold border border-brand-gold/30 rounded-full text-[10px] font-black uppercase tracking-widest">TOP 5% IN AREA</span>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="relative w-44 h-44">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_10px_rgba(0,242,255,0.3)]" viewBox="0 0 100 100">
                <circle className="text-brand-steel border border-brand-gold/20" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeWidth="10"></circle>
                {totalWaste > 0 && (
                  <>
                    <circle className="text-brand-emerald" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeDasharray={`${wetDash} ${circumference}`} strokeDashoffset="0" strokeWidth="10" strokeLinecap="round"></circle>
                    <circle className="text-brand-neon-blue" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeDasharray={`${dryDash} ${circumference}`} strokeDashoffset={`-${wetDash}`} strokeWidth="10" strokeLinecap="round"></circle>
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black text-white tracking-tighter cyber-glow-blue font-headline">{efficiency}%</span>
                <span className="text-[9px] uppercase font-black text-brand-gold/60 tracking-widest font-body">Efficiency</span>
              </div>
            </div>
            <div className="flex-1 w-full space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-brand-neon-blue shadow-[0_0_10px_rgba(0,242,255,0.6)]"></div>
                  <span className="text-sm font-bold text-stone-300 font-body">Dry Waste</span>
                </div>
                <span className="text-base font-black text-white font-headline">{data?.weeklyStats?.dryWaste || 0} kg</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-brand-emerald shadow-[0_0_10px_rgba(0,168,107,0.6)]"></div>
                  <span className="text-sm font-bold text-stone-300 font-body">Wet Waste</span>
                </div>
                <span className="text-base font-black text-white font-headline">{data?.weeklyStats?.wetWaste || 0} kg</span>
              </div>
              <div className="pt-6 border-t border-brand-gold/20">
                <div className="flex items-center gap-4 p-4 bg-brand-emerald/10 rounded-[24px] border border-brand-emerald/30">
                  <div className="w-10 h-10 rounded-full bg-brand-emerald/20 border border-brand-emerald/50 flex items-center justify-center text-brand-emerald shrink-0 shadow-[0_0_15px_rgba(0,168,107,0.4)]">
                    <Leaf size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-brand-emerald font-headline">{data?.weeklyStats?.co2Saved || 0}kg CO2 Saved</p>
                    <p className="text-[11px] font-medium text-brand-emerald/70 font-body">Equal to planting 2 trees this week!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-5">
        <button 
          onClick={() => setIsOrderBagsOpen(true)}
          className="flex flex-col items-start p-6 vedic-panel rounded-[32px] hover:border-brand-gold/60 transition-all group active:scale-95 relative overflow-hidden"
        >
          <div className="absolute inset-0 circuit-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="w-12 h-12 bg-brand-gold/10 border border-brand-gold/30 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(255,215,0,0.2)]">
            <ShoppingBag className="text-brand-gold" size={24} />
          </div>
          <p className="text-base font-black text-white tracking-tight leading-tight font-headline">Order Smart Bags</p>
          <p className="text-[10px] text-brand-gold/60 font-bold uppercase tracking-widest mt-1 font-body">स्मार्ट बैग ऑर्डर</p>
        </button>
        <button 
          onClick={() => setIsGuideOpen(true)}
          className="flex flex-col items-start p-6 vedic-panel rounded-[32px] hover:border-brand-gold/60 transition-all group active:scale-95 relative overflow-hidden"
        >
          <div className="absolute inset-0 mandala-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="w-12 h-12 bg-brand-neon-blue/10 border border-brand-neon-blue/30 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(0,242,255,0.2)]">
            <BookOpen className="text-brand-neon-blue" size={24} />
          </div>
          <p className="text-base font-black text-white tracking-tight leading-tight font-headline">Segregation Guide</p>
          <p className="text-[10px] text-brand-neon-blue/60 font-bold uppercase tracking-widest mt-1 font-body">कचरा अलग करने के नियम</p>
        </button>
      </div>

      {/* View Schedule */}
      <button 
        onClick={() => setIsScheduleOpen(true)}
        className="w-full vedic-panel rounded-[32px] p-6 relative overflow-hidden hover:border-brand-gold/60 transition-all text-left group active:scale-[0.98]"
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-neon-purple opacity-20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 circuit-bg opacity-10"></div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-brand-neon-purple/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-brand-neon-purple/30 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(160,0,255,0.3)]">
              <Truck className="text-brand-neon-purple" size={28} />
            </div>
            <div>
              <h4 className="text-lg font-black text-white tracking-tight font-headline">View your schedule</h4>
              <p className="text-xs font-bold text-brand-neon-purple/70 uppercase tracking-widest mt-0.5 font-body">Check collection timings</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
            <ChevronRight size={24} />
          </div>
        </div>
      </button>

      <SegregationGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <ScheduleModal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} />
      <OrderSmartBagsModal isOpen={isOrderBagsOpen} onClose={() => setIsOrderBagsOpen(false)} userId={userId} />
    </motion.div>
  );
};

const OrderSmartBagsModal = ({ isOpen, onClose, userId }: { isOpen: boolean; onClose: () => void; userId: string }) => {
  const [step, setStep] = useState<'cart' | 'otp' | 'success'>('cart');
  const [cart, setCart] = useState<{ id: string; type: string; color?: string; quantity: number; cost: number }[]>([]);
  const [showColorSelect, setShowColorSelect] = useState(false);
  const [selectedColor, setSelectedColor] = useState('Green (Wet Waste)');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');

  useEffect(() => {
    if (isOpen) {
      setStep('cart');
      setCart([]);
      setShowColorSelect(false);
      setSelectedColor('Green (Wet Waste)');
      setOtp('');
      setIsSubmitting(false);
      setDeliveryMethod('delivery');
    }
  }, [isOpen]);

  const handleAddToCart = (type: string, cost: number, color?: string) => {
    setCart([...cart, { id: Date.now().toString(), type, color, quantity: 1, cost }]);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const totalCost = cart.reduce((acc, item) => acc + item.cost * item.quantity, 0);

  const handleConfirmOrder = async () => {
    if (otp.length < 4) {
      alert("Please enter a valid 4-digit OTP.");
      return;
    }
    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      const currentBalance = userDoc.data()?.swacchCoinBalance || 0;

      if (currentBalance < totalCost) {
        alert("Insufficient Swacch Coins balance.");
        setIsSubmitting(false);
        return;
      }

      await updateDoc(userRef, {
        swacchCoinBalance: currentBalance - totalCost
      });

      await addDoc(collection(db, 'orders'), {
        userId,
        orderType: 'smart_bags',
        items: cart.map(item => ({ type: item.type, color: item.color || null, quantity: item.quantity, cost: item.cost })),
        totalCost,
        status: 'pending',
        deliveryMethod,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        userId,
        type: 'order',
        amount: -totalCost,
        description: `Ordered Smart Bags`,
        timestamp: serverTimestamp()
      });

      setStep('success');
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-0 z-50 flex flex-col bg-brand-steel sm:p-4"
        >
          <div className="absolute inset-0 mandala-bg opacity-10 pointer-events-none"></div>
          <div className="flex items-center justify-between p-3 vedic-panel border-b border-brand-gold/30 shadow-sm relative z-10">
            <h2 className="font-bold vedic-gold-text text-base font-headline">Order Smart Bags</h2>
            <button onClick={onClose} className="p-1.5 text-brand-gold hover:bg-brand-gold/10 rounded-full border border-transparent hover:border-brand-gold/30 transition-all">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 relative z-10">
            {step === 'cart' && (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="vedic-panel p-4 rounded-2xl shadow-sm border border-brand-gold/20 space-y-3 relative overflow-hidden">
                  <div className="absolute inset-0 circuit-bg opacity-10"></div>
                  <h3 className="font-bold text-white text-sm font-headline relative z-10">Select Bag Type</h3>
                  
                  <div className="space-y-3 relative z-10">
                    {/* Option 1 */}
                    <div className="bg-brand-steel/50 border border-brand-gold/30 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-white">T2T Smart Bags</p>
                        <p className="text-xs text-brand-gold/60">Set of 30</p>
                        <p className="text-xs font-bold text-brand-gold mt-1">50 🪙</p>
                      </div>
                      <button 
                        onClick={() => handleAddToCart('T2T Smart Bags Set of 30', 50)}
                        className="bg-brand-gold/10 text-brand-gold border border-brand-gold/50 text-xs font-bold py-1.5 px-3 rounded-lg hover:bg-brand-gold/20 transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    {/* Option 2 */}
                    <div className="bg-brand-steel/50 border border-brand-gold/30 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-white">T2T Smart Bags</p>
                        <p className="text-xs text-brand-gold/60">Set of 360</p>
                        <p className="text-xs font-bold text-brand-gold mt-1">500 🪙</p>
                      </div>
                      <button 
                        onClick={() => handleAddToCart('T2T Smart Bags Set of 360', 500)}
                        className="bg-brand-gold/10 text-brand-gold border border-brand-gold/50 text-xs font-bold py-1.5 px-3 rounded-lg hover:bg-brand-gold/20 transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    {/* Option 3 */}
                    <div className="bg-brand-steel/50 border border-brand-gold/30 rounded-xl p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-white">Individual Smart Bags</p>
                          <p className="text-xs text-brand-gold/60">Set of 100</p>
                          <p className="text-xs font-bold text-brand-gold mt-1">150 🪙</p>
                        </div>
                        <button 
                          onClick={() => setShowColorSelect(!showColorSelect)}
                          className="bg-brand-gold/10 text-brand-gold border border-brand-gold/50 text-xs font-bold py-1.5 px-3 rounded-lg hover:bg-brand-gold/20 transition-colors"
                        >
                          {showColorSelect ? 'Cancel' : 'Select'}
                        </button>
                      </div>
                      
                      {showColorSelect && (
                        <div className="mt-3 pt-3 border-t border-brand-gold/20 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-brand-gold/80 mb-1 font-body">Select Color</label>
                            <select 
                              value={selectedColor} 
                              onChange={(e) => setSelectedColor(e.target.value)}
                              className="w-full bg-brand-steel/80 border border-brand-gold/30 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand-gold/50 font-body"
                            >
                              <option value="Green (Wet Waste)" className="bg-brand-steel text-white">Green (Wet Waste)</option>
                              <option value="Blue (Dry Waste)" className="bg-brand-steel text-white">Blue (Dry Waste)</option>
                              <option value="Red (Reject/Sanitary)" className="bg-brand-steel text-white">Red (Reject/Sanitary)</option>
                              <option value="Black (Hazardous)" className="bg-brand-steel text-white">Black (Hazardous)</option>
                              <option value="Yellow (E-Waste)" className="bg-brand-steel text-white">Yellow (E-Waste)</option>
                            </select>
                          </div>
                          <button 
                            onClick={() => {
                              handleAddToCart('Individual Smart Bags Set of 100', 150, selectedColor);
                              setShowColorSelect(false);
                            }}
                            className="w-full bg-brand-gold text-brand-steel text-xs font-bold py-2 rounded-lg hover:bg-white transition-colors"
                          >
                            Add to Cart
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {cart.length > 0 && (
                  <div className="vedic-panel p-4 rounded-2xl shadow-sm border border-brand-gold/20 space-y-3 relative overflow-hidden">
                    <div className="absolute inset-0 circuit-bg opacity-10"></div>
                    <div className="flex justify-between items-center relative z-10">
                      <h3 className="font-bold text-white text-sm font-headline">Your Order</h3>
                      <span className="text-brand-gold font-bold text-sm">{totalCost} 🪙 Total</span>
                    </div>
                    <div className="space-y-2 relative z-10">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-brand-steel/50 p-2.5 rounded-xl border border-brand-gold/20 backdrop-blur-sm">
                          <div>
                            <p className="font-bold text-white text-sm font-headline">{item.type}</p>
                            {item.color && <p className="text-xs text-brand-gold/60 font-body">Color: {item.color}</p>}
                            <p className="text-xs text-brand-gold/60 font-body">Qty: {item.quantity} <span className="text-brand-gold ml-2">{item.cost} 🪙</span></p>
                          </div>
                          <button 
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-brand-ruby p-1.5 hover:bg-brand-ruby/10 rounded-full transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 relative z-10 mt-3 border-t border-brand-gold/20 pt-3">
                      <h4 className="text-xs font-bold text-brand-gold/80 uppercase tracking-wider">Delivery Method</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeliveryMethod('delivery')}
                          className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all border", deliveryMethod === 'delivery' ? "bg-brand-gold text-brand-steel border-brand-gold" : "bg-brand-steel/50 text-brand-gold/60 border-brand-gold/30")}
                        >
                          Delivery
                        </button>
                        <button
                          onClick={() => setDeliveryMethod('pickup')}
                          className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all border", deliveryMethod === 'pickup' ? "bg-brand-gold text-brand-steel border-brand-gold" : "bg-brand-steel/50 text-brand-gold/60 border-brand-gold/30")}
                        >
                          Pickup
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 relative z-10 mt-4">
                      <button 
                        onClick={onClose}
                        className="flex-1 bg-brand-steel/50 border border-brand-gold/30 text-brand-gold text-sm font-bold py-2.5 rounded-xl hover:bg-brand-gold/10 transition-colors font-headline"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => setStep('otp')}
                        className="flex-1 bg-gradient-to-r from-brand-gold to-yellow-400 text-brand-steel text-sm font-black py-2.5 rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.4)] hover:opacity-90 transition-opacity font-headline"
                      >
                        Checkout
                      </button>
                    </div>
                  </div>
                )}
                
                {cart.length === 0 && (
                  <button 
                    onClick={onClose}
                    className="w-full bg-brand-steel/50 border border-brand-gold/30 text-brand-gold text-sm font-bold py-2.5 rounded-xl hover:bg-brand-gold/10 transition-colors font-headline"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

            {step === 'otp' && (
              <div className="max-w-md mx-auto vedic-panel p-5 rounded-2xl shadow-sm border border-brand-gold/20 text-center space-y-4 relative overflow-hidden">
                <div className="absolute inset-0 mandala-bg opacity-10"></div>
                <div className="w-12 h-12 bg-brand-gold/10 border border-brand-gold/30 rounded-full flex items-center justify-center mx-auto text-brand-gold shadow-[0_0_15px_rgba(255,215,0,0.2)] relative z-10">
                  <ShoppingBag size={24} />
                </div>
                <div className="relative z-10">
                  <h3 className="font-bold text-lg text-white mb-1 font-headline">Confirm Order</h3>
                  <p className="text-brand-gold/60 text-xs font-body">An OTP has been sent to your registered mobile number. Please enter it below to confirm your order of <span className="text-brand-gold font-bold">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span> items for <span className="text-brand-gold font-bold">{totalCost} 🪙</span>.</p>
                </div>
                <div className="relative z-10">
                  <input 
                    type="text" 
                    maxLength={4}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 4-digit OTP"
                    className="w-full text-center text-xl tracking-[0.3em] bg-brand-steel/50 border border-brand-gold/30 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-brand-gold/50 font-mono text-white placeholder:text-brand-gold/30"
                  />
                </div>
                <div className="flex gap-2 relative z-10">
                  <button 
                    onClick={() => setStep('cart')}
                    className="flex-1 bg-brand-steel/50 border border-brand-gold/30 text-brand-gold text-sm font-bold py-2.5 rounded-xl hover:bg-brand-gold/10 transition-colors font-headline"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleConfirmOrder}
                    disabled={otp.length < 4 || isSubmitting}
                    className="flex-1 bg-gradient-to-r from-brand-gold to-yellow-400 text-brand-steel text-sm font-black py-2.5 rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.4)] hover:opacity-90 transition-opacity disabled:opacity-50 font-headline"
                  >
                    {isSubmitting ? "Confirming..." : "Confirm"}
                  </button>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="max-w-md mx-auto vedic-panel p-5 rounded-2xl shadow-sm border border-brand-gold/20 text-center space-y-4 py-8 relative overflow-hidden">
                <div className="absolute inset-0 circuit-bg opacity-10"></div>
                <div className="w-16 h-16 bg-brand-emerald/10 border border-brand-emerald/30 rounded-full flex items-center justify-center mx-auto text-brand-emerald shadow-[0_0_20px_rgba(0,168,107,0.3)] relative z-10">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                </div>
                <div className="relative z-10">
                  <h3 className="font-bold text-xl text-white mb-1 font-headline">Order Confirmed!</h3>
                  <p className="text-brand-gold/60 text-sm font-body">
                    Your request for smart bags has been successfully submitted. 
                    {deliveryMethod === 'pickup' 
                      ? " You can pick them up from our collection center." 
                      : " They will be delivered to your registered address soon."}
                  </p>
                </div>
                <button 
                  onClick={onClose}
                  className="w-full bg-brand-gold/10 border border-brand-gold/50 text-brand-gold text-sm font-bold py-2.5 rounded-xl hover:bg-brand-gold/20 transition-colors font-headline relative z-10"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const QRCodeModal = ({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) => {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="vedic-panel rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative border border-brand-gold/30"
          >
            <div className="absolute inset-0 mandala-bg opacity-10 pointer-events-none"></div>
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 bg-brand-gold/10 border border-brand-gold/30 rounded-full flex items-center justify-center text-brand-gold hover:bg-brand-gold/20 transition-colors z-50 cursor-pointer"
            >
              <X size={18} />
            </button>
            
            <div className="p-8 text-center relative z-10">
              <h3 className="text-2xl font-black vedic-gold-text mb-2 font-headline">Your QR Code</h3>
              <p className="text-sm text-stone-400 mb-8 font-body">Show this to the Swacchta Mitra to earn coins, or to a partner business to redeem them.</p>
              
              <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(255,215,0,0.3)] border border-brand-gold/50 inline-block mx-auto">
                <QRCode value={userId} size={200} fgColor="#2C323F" />
              </div>
              
              <p className="text-xs text-brand-gold/80 mt-6 font-mono bg-brand-steel/50 border border-brand-gold/20 py-2 px-4 rounded-lg inline-block shadow-inner">ID: {userId}</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const TransactionDetailsModal = ({ isOpen, onClose, transaction }: { isOpen: boolean, onClose: () => void, transaction: any }) => {
  return createPortal(
    <AnimatePresence>
      {isOpen && transaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="vedic-panel w-full max-w-sm overflow-hidden relative"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 bg-brand-steel/50 border border-brand-gold/30 rounded-full flex items-center justify-center text-brand-gold hover:bg-brand-gold/20 transition-colors z-50 cursor-pointer"
            >
              <X size={18} />
            </button>
            
            <div className="p-6 relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shrink-0 border",
                  transaction.amount > 0 ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-ruby-900/30 text-ruby-400 border-ruby-500/30 shadow-[0_0_15px_rgba(224,17,95,0.2)]"
                )}>
                  {transaction.amount > 0 ? <TrendingUp size={28} /> : <ShoppingBag size={28} />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-brand-gold font-headline tracking-wider">{transaction.amount > 0 ? 'Coins Earned' : 'Coins Spent'}</h3>
                  <p className="text-sm text-brand-gold/60 font-mono">
                    {transaction.timestamp?.toDate ? transaction.timestamp.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : new Date(transaction.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>

              <div className="bg-brand-steel/40 border border-brand-gold/10 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-brand-gold/70 font-medium tracking-wider uppercase">Amount</span>
                  <span className={cn(
                    "text-xl font-black font-headline",
                    transaction.amount > 0 ? "text-emerald-400" : "text-brand-gold"
                  )}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount} 🪙
                  </span>
                </div>
                
                <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent w-full"></div>
                
                <div>
                  <span className="text-sm text-brand-gold/70 font-medium block mb-1 tracking-wider uppercase">Description</span>
                  <span className="text-base text-white font-bold">{transaction.description}</span>
                </div>

                {transaction.businessId && (
                  <>
                    <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent w-full"></div>
                    <div>
                      <span className="text-sm text-brand-gold/70 font-medium block mb-1 tracking-wider uppercase">Business ID</span>
                      <span className="text-sm text-brand-gold font-mono bg-brand-steel/80 border border-brand-gold/20 px-2 py-1 rounded">{transaction.businessId}</span>
                    </div>
                  </>
                )}
                
                {transaction.wasteWeight && (
                  <>
                    <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent w-full"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-brand-gold/70 font-medium tracking-wider uppercase">Waste Weight</span>
                      <span className="text-base text-white font-bold">{transaction.wasteWeight} kg</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const TransactionList = ({ transactions, loading }: { transactions: any[], loading: boolean }) => {
  const [selectedTx, setSelectedTx] = useState<any>(null);

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="w-8 h-8 border-4 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 vedic-panel border border-brand-gold/20 shadow-sm">
        <div className="w-16 h-16 bg-brand-steel/50 border border-brand-gold/30 rounded-full flex items-center justify-center mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full cyber-glow-blue opacity-20"></div>
          <Coins className="text-brand-gold relative z-10" size={32} />
        </div>
        <p className="text-brand-gold font-bold mb-1 font-headline tracking-wider">No transactions yet</p>
        <p className="text-white/60 text-sm max-w-[200px] mx-auto">Segregate waste to earn your first Swacch Coins!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {transactions.map(tx => {
          const dateObj = (tx.timestamp && typeof tx.timestamp === 'object' && 'toDate' in tx.timestamp) 
            ? (tx.timestamp as any).toDate() 
            : (tx.timestamp ? new Date(tx.timestamp) : new Date());
          const dateStr = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
          const isEarned = tx.amount > 0;

          return (
            <div 
              key={tx.id} 
              onClick={() => setSelectedTx(tx)}
              className="vedic-panel p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] group hover:border-brand-gold/50 transition-all"
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300",
                  isEarned ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-ruby-900/30 text-ruby-400 border-ruby-500/30 group-hover:shadow-[0_0_15px_rgba(224,17,95,0.3)]"
                )}>
                  {isEarned ? <TrendingUp size={24} /> : <ShoppingBag size={24} />}
                </div>
                <div>
                  <p className="font-bold text-white text-sm line-clamp-1">{tx.description}</p>
                  <p className="text-xs text-brand-gold/60 mt-0.5 font-mono">{dateStr}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4 relative z-10">
                <span className={cn(
                  "font-black text-lg font-headline tracking-wider",
                  isEarned ? "text-emerald-400" : "text-brand-gold"
                )}>
                  {isEarned ? '+' : ''}{tx.amount}
                </span>
                <p className="text-[10px] text-brand-gold/50 font-bold uppercase tracking-widest">Coins</p>
              </div>
            </div>
          );
        })}
      </div>
      <TransactionDetailsModal 
        isOpen={!!selectedTx} 
        onClose={() => setSelectedTx(null)} 
        transaction={selectedTx} 
      />
    </>
  );
};

const WalletScreen = ({ userId }: { userId: string }) => {
  const { data: userData } = useUserDashboard(userId);
  const { transactions, loading } = useTransactions(userId);
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-24"
    >
      <div className="vedic-panel rounded-[32px] p-8 text-white shadow-[0_0_30px_rgba(255,215,0,0.15)] border border-brand-gold/30 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-brand-gold opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-brand-gold opacity-5 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <p className="text-brand-gold/80 text-xs font-black tracking-[0.1em] uppercase mb-1 flex items-center gap-2 font-mono">
            <Wallet size={14} /> Available Balance
          </p>
          <h2 className="text-6xl font-black tracking-tighter mt-2 font-headline text-brand-gold drop-shadow-md">
            {userData?.balance || 0}
            <span className="text-2xl ml-2 opacity-60 font-medium font-sans">🪙</span>
          </h2>
          <div className="mt-8 flex gap-4">
            <button 
              onClick={() => setIsQRCodeOpen(true)}
              className="bg-brand-gold text-brand-steel px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest backdrop-blur-md transition-all flex items-center gap-3 hover:bg-white hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] active:scale-95"
            >
              <QrCode size={18} /> Show QR Code
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-6 px-2">
          <div>
            <h3 className="text-2xl font-black text-brand-gold font-headline tracking-wider">Recent Activity</h3>
            <p className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest mt-1 font-mono">Your coin history</p>
          </div>
        </div>
        <TransactionList transactions={transactions} loading={loading} />
      </div>

      <QRCodeModal 
        isOpen={isQRCodeOpen} 
        onClose={() => setIsQRCodeOpen(false)} 
        userId={userId} 
      />
    </motion.div>
  );
};

const RedeemOfferModal = ({ 
  isOpen, 
  onClose, 
  offer, 
  onConfirm, 
  isRedeeming, 
  result 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  offer: Offer | null; 
  onConfirm: (deliveryFee?: number) => void; 
  isRedeeming: boolean;
  result: any | null;
}) => {
  const [view, setView] = useState<'main' | 'qr' | 'delivery'>('main');

  useEffect(() => {
    if (!isOpen) {
      setView('main');
    }
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && offer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="vedic-panel w-full max-w-sm overflow-hidden relative"
          >
            {!result && (
              <button 
                onClick={onClose}
                disabled={isRedeeming}
                className="absolute top-4 right-4 w-8 h-8 bg-brand-steel/50 border border-brand-gold/30 rounded-full flex items-center justify-center text-brand-gold hover:bg-brand-gold/20 transition-colors z-50 cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            )}
            
            <div className="p-6 relative z-10">
              {!result ? (
                view === 'qr' ? (
                  <div className="text-center py-4">
                    <h3 className="text-2xl font-black text-brand-gold font-headline tracking-wider mb-2">Scan at Store</h3>
                    <p className="text-white/80 text-sm mb-6">Show this QR code to the cashier or scan the store's QR.</p>
                    
                    <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-[0_0_30px_rgba(255,215,0,0.2)]">
                      <QRCode value={`redeem:${offer.id}`} size={160} />
                    </div>
                    
                    <div className="space-y-3">
                      <button 
                        onClick={() => onConfirm()}
                        disabled={isRedeeming}
                        className="w-full bg-brand-gold text-brand-steel py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isRedeeming ? (
                          <span className="animate-pulse">Processing...</span>
                        ) : (
                          <><Camera size={18} /> Simulate Scan QR</>
                        )}
                      </button>
                      <button 
                        onClick={() => setView('main')}
                        disabled={isRedeeming}
                        className="w-full bg-transparent border border-white/10 text-white/70 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : view === 'delivery' ? (
                  <div className="text-center py-4">
                    <h3 className="text-2xl font-black text-brand-gold font-headline tracking-wider mb-2">Delivery Options</h3>
                    <p className="text-white/80 text-sm mb-6">Choose how you want to receive your reward.</p>
                    
                    <div className="space-y-4">
                      <button 
                        onClick={() => onConfirm(50)}
                        disabled={isRedeeming}
                        className="w-full bg-brand-steel/50 border border-brand-gold/30 p-4 rounded-xl hover:bg-brand-gold/10 transition-colors text-left flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold">
                            <Zap size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-white group-hover:text-brand-gold transition-colors">Instant Delivery</p>
                            <p className="text-xs text-white/50">Within 30 minutes</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-brand-gold">+50 🪙</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => onConfirm(10)}
                        disabled={isRedeeming}
                        className="w-full bg-brand-steel/50 border border-brand-gold/30 p-4 rounded-xl hover:bg-brand-gold/10 transition-colors text-left flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold">
                            <Truck size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-white group-hover:text-brand-gold transition-colors">Regular Delivery</p>
                            <p className="text-xs text-white/50">Within 24 hours</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-brand-gold">+10 🪙</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => setView('main')}
                        disabled={isRedeeming}
                        className="w-full bg-transparent border border-white/10 text-white/70 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-50 mt-4"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 border bg-brand-gold/10 text-brand-gold border-brand-gold/30 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                        <Gift size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-brand-gold font-headline tracking-wider">Redeem Offer</h3>
                        <p className="text-sm text-brand-gold/60 font-mono">Confirm your selection</p>
                      </div>
                    </div>

                    <div className="bg-brand-steel/40 border border-brand-gold/10 rounded-2xl p-5 space-y-4 backdrop-blur-sm mb-6">
                      <div>
                        <h4 className="font-bold text-white text-lg leading-tight mb-1">{offer.title}</h4>
                        <p className="text-brand-gold/60 text-xs font-mono">{offer.businessName}</p>
                      </div>
                      
                      <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent w-full"></div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-brand-gold/70 font-medium tracking-wider uppercase">Cost</span>
                        <span className="text-xl font-black font-headline text-brand-gold">
                          {offer.coinCost} 🪙
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={() => setView('qr')}
                        disabled={isRedeeming}
                        className="w-full bg-brand-gold text-brand-steel py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <MapPin size={18} /> Redeem On Site
                      </button>
                      
                      <button 
                        onClick={() => onConfirm()}
                        disabled={isRedeeming}
                        className="w-full bg-brand-steel/50 border border-brand-gold/30 text-brand-gold py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-brand-gold/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isRedeeming ? (
                          <span className="animate-pulse">Processing...</span>
                        ) : (
                          <><ShoppingBag size={18} /> I'll Pick It Up Myself</>
                        )}
                      </button>

                      <button 
                        onClick={() => setView('delivery')}
                        disabled={isRedeeming}
                        className="w-full bg-transparent border border-white/10 text-white/70 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Truck size={18} /> Check Delivery Options
                      </button>
                    </div>
                  </>
                )
              ) : (
                <div className="text-center py-4">
                  <div className="w-20 h-20 bg-emerald-900/30 border-2 border-emerald-500/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <Check className="text-emerald-400" size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-brand-gold font-headline tracking-wider mb-2">Success!</h3>
                  <p className="text-white/80 text-sm mb-6">You have successfully redeemed this offer.</p>
                  
                  <div className="bg-brand-steel/60 border border-brand-gold/20 rounded-xl p-4 mb-6 text-left">
                    <p className="text-[10px] text-brand-gold/50 font-bold uppercase tracking-widest mb-1">Receipt ID</p>
                    <p className="font-mono text-white text-sm break-all">{result.receiptId}</p>
                    
                    <div className="h-px bg-brand-gold/10 w-full my-3"></div>
                    
                    <p className="text-[10px] text-brand-gold/50 font-bold uppercase tracking-widest mb-1">Remaining Balance</p>
                    <p className="font-mono text-brand-gold font-bold">{result.newBalance} 🪙</p>
                  </div>
                  
                  <p className="text-xs text-brand-gold/60 font-mono mb-6">Show this receipt at the store to claim your reward.</p>
                  
                  <button 
                    onClick={onClose}
                    className="w-full bg-brand-steel/50 border border-brand-gold/30 text-brand-gold py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-brand-gold/10 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const MarketScreen = ({ userId }: { userId: string }) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Offers');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { redeem, loading: redeeming } = useRedeemOffer();
  
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [redemptionResult, setRedemptionResult] = useState<any | null>(null);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "offers"));
        const fetchedOffers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Offer[];
        if (fetchedOffers.length > 0) {
          setOffers(fetchedOffers);
        } else {
          // Fallback if empty
          setOffers([
            {
              id: '1',
              businessId: 'biz_jain_sweets',
              businessName: "Jain Sweets",
              title: "10% off at Jain Sweets",
              description: "जैन स्वीट्स पर 10% की छूट",
              coinCost: 50,
              category: "Neemuch Local",
              imageUrl: "https://picsum.photos/seed/sweets/400/300"
            }
          ]);
        }
      } catch (err) {
        console.error("Error fetching offers:", err);
      }
    };
    fetchOffers();
  }, []);

  const handleConfirmRedeem = async (deliveryFee: number = 0) => {
    if (!selectedOffer) return;
    try {
      const result = await redeem(userId, selectedOffer.id, deliveryFee);
      setRedemptionResult(result);
    } catch (err: any) {
      alert(err.message);
      setSelectedOffer(null);
    }
  };

  const closeRedeemModal = () => {
    if (!redeeming) {
      setSelectedOffer(null);
      setRedemptionResult(null);
    }
  };

  const filteredOffers = offers.filter(offer => {
    const matchesCategory = selectedCategory === 'All Offers' || offer.category === selectedCategory;
    const matchesSearch = offer.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          offer.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          offer.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All Offers', 'Groceries', 'Services', 'Events', 'Neemuch Local'];

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8 pb-24"
      >
        <div className="flex flex-col">
          <h2 className="text-4xl font-black text-brand-gold font-headline tracking-wider">Marketplace</h2>
          <p className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest mt-1">Redeem your coins for rewards</p>
        </div>

        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gold/50 group-focus-within:text-brand-gold transition-colors" size={20} />
          <input 
            className="w-full bg-brand-steel/50 border border-brand-gold/30 rounded-[24px] py-4 pl-14 pr-6 focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold text-white placeholder:text-brand-gold/30 outline-none transition-all backdrop-blur-sm" 
            placeholder="Search local stores or services..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5">
          {categories.map((cat) => (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "whitespace-nowrap px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border",
                selectedCategory === cat 
                  ? "bg-brand-gold text-brand-steel border-brand-gold shadow-[0_0_15px_rgba(255,215,0,0.3)]" 
                  : "bg-brand-steel/50 text-brand-gold/60 border-brand-gold/20 hover:bg-brand-steel hover:text-brand-gold hover:border-brand-gold/50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8">
          {filteredOffers.length === 0 ? (
            <div className="text-center py-16 vedic-panel border border-brand-gold/20">
              <Store className="mx-auto text-brand-gold/30 mb-4" size={48} />
              <p className="text-brand-gold font-black text-lg font-headline tracking-wider">No offers found</p>
              <p className="text-brand-gold/50 text-xs font-bold uppercase tracking-widest mt-1">Try a different search</p>
            </div>
          ) : (
            filteredOffers.map((offer) => (
              <div key={offer.id} className="vedic-panel overflow-hidden border border-brand-gold/20 flex flex-col group hover:border-brand-gold/50 transition-all duration-500">
                <div className="relative h-52 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-steel to-transparent z-10 opacity-60"></div>
                  <img 
                    src={offer.imageUrl} 
                    alt={offer.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 bg-brand-steel/80 text-brand-gold px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-brand-gold/30 z-20 shadow-[0_0_10px_rgba(255,215,0,0.2)]">
                    {offer.category}
                  </div>
                </div>
                <div className="p-8 flex-1 flex flex-col relative z-20 -mt-8">
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-2xl font-black text-brand-gold font-headline tracking-wider leading-tight drop-shadow-md">{offer.title}</h3>
                    </div>
                    <p className="text-brand-gold/60 text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Tag size={12} />
                      {offer.businessName}
                    </p>
                    <p className="text-white/80 text-sm font-medium leading-relaxed">{offer.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-brand-gold/10">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-brand-gold font-headline tracking-wider drop-shadow-md">{offer.coinCost}</span>
                      <span className="text-[10px] font-bold text-brand-gold/50 uppercase tracking-widest">Coins</span>
                    </div>
                    <button 
                      onClick={() => setSelectedOffer(offer)}
                      className="bg-brand-gold text-brand-steel px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all active:scale-95"
                    >
                      Redeem Now
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      <RedeemOfferModal 
        isOpen={!!selectedOffer}
        onClose={closeRedeemModal}
        offer={selectedOffer}
        onConfirm={handleConfirmRedeem}
        isRedeeming={redeeming}
        result={redemptionResult}
      />
    </>
  );
};

const ProfileScreen = ({ user }: { user: FirebaseUser }) => {
  const { profile, loading } = useUserProfile(user.uid);
  const { transactions, loading: txLoading } = useTransactions(user.uid);
  const [avatarUrl, setAvatarUrl] = useState(user.photoURL || "https://picsum.photos/seed/avatar/100/100");
  const [isUploading, setIsUploading] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isMyRewardsOpen, setIsMyRewardsOpen] = useState(false);
  const [isTxHistoryOpen, setIsTxHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 1MB to avoid Firestore/Auth limits if base64 is too large)
    if (file.size > 1024 * 1024) {
      alert("Image is too large. Please select an image under 1MB.");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setAvatarUrl(base64String);
        
        // Update Firebase Auth profile
        await updateProfile(user, { photoURL: base64String });
        
        // Optionally update the user document in Firestore
        await setDoc(doc(db, "users", user.uid), { photoURL: base64String }, { merge: true });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to update profile picture.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-brand-gold font-headline">Loading...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      {/* Profile Header */}
      <div className="vedic-panel p-8 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute inset-0 mandala-bg opacity-10"></div>
        <div className="relative mb-6 z-10">
          <div className="w-32 h-32 rounded-full bg-brand-steel/50 p-1 border-4 border-brand-gold shadow-[0_0_20px_rgba(255,215,0,0.3)] overflow-hidden relative">
            <div className="absolute inset-0 cyber-glow-blue opacity-20"></div>
            <img 
              src={avatarUrl} 
              alt="Avatar" 
              className={cn("w-full h-full object-cover transition-opacity relative z-10", isUploading ? "opacity-50" : "opacity-100")} 
              referrerPolicy="no-referrer" 
            />
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-1 right-1 bg-brand-steel text-brand-gold p-2.5 rounded-full border-2 border-brand-gold shadow-[0_0_10px_rgba(255,215,0,0.5)] hover:scale-110 transition-transform disabled:opacity-50 active:scale-90 z-20"
          >
            <Camera size={16} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
        <h2 className="text-3xl font-black text-brand-gold font-headline tracking-wider relative z-10 drop-shadow-md">{profile?.name || user.displayName}</h2>
        <p className="text-sm font-bold text-white/60 uppercase tracking-widest mt-1 relative z-10 font-mono">{user.email}</p>
        <div className="mt-6 inline-flex items-center gap-2 px-6 py-2 bg-brand-steel/80 border border-brand-gold/30 text-brand-gold rounded-full text-xs font-black uppercase tracking-widest relative z-10 shadow-inner">
          <QrCode size={16} />
          {profile?.householdId || 'No ID'}
        </div>
      </div>

      {/* Household Info */}
      <div className="vedic-panel p-8 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-[50px] rounded-full"></div>
        <h3 className="text-xl font-black text-brand-gold font-headline tracking-wider relative z-10">Household Details</h3>
        <div className="flex items-start gap-5 relative z-10">
          <div className="w-12 h-12 bg-brand-steel/50 border border-brand-gold/20 rounded-2xl flex items-center justify-center text-brand-gold shadow-inner">
            <Home size={22} />
          </div>
          <div>
            <p className="text-base font-black text-white tracking-tight leading-tight">{profile?.address || 'Address not set'}</p>
            <p className="text-[11px] font-bold text-brand-gold/60 uppercase tracking-widest mt-1">{profile?.city || 'City not set'}</p>
          </div>
        </div>
      </div>

      {/* Impact Summary */}
      <div className="vedic-panel p-8 relative overflow-hidden border-brand-gold/40">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-gold opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 circuit-bg opacity-10"></div>
        <h3 className="text-xl font-black text-brand-gold font-headline tracking-wider mb-6 relative z-10">Lifetime Impact</h3>
        <div className="flex items-center justify-between p-6 bg-brand-steel/60 rounded-[24px] backdrop-blur-md border border-brand-gold/20 relative z-10 shadow-inner">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-brand-steel border border-brand-gold/50 rounded-2xl flex items-center justify-center text-brand-gold shadow-[0_0_15px_rgba(255,215,0,0.2)] relative overflow-hidden">
              <div className="absolute inset-0 cyber-glow-purple opacity-30"></div>
              <Trophy size={28} className="relative z-10" />
            </div>
            <div>
              <p className="text-[10px] text-brand-gold/70 font-black uppercase tracking-widest">Total Waste Diverted</p>
              <p className="text-3xl font-black text-white font-headline tracking-wider mt-1 drop-shadow-md">{profile?.totalWasteDiverted || 0} <span className="text-lg font-medium opacity-60 font-sans">kg</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="vedic-panel p-8">
        <button 
          onClick={() => setIsTxHistoryOpen(!isTxHistoryOpen)}
          className="w-full flex items-center justify-between group"
        >
          <h3 className="text-xl font-black text-brand-gold font-headline tracking-wider">Transaction History</h3>
          <div className="w-10 h-10 rounded-full bg-brand-steel/50 border border-brand-gold/20 flex items-center justify-center text-brand-gold group-hover:bg-brand-steel group-hover:border-brand-gold/50 group-hover:shadow-[0_0_10px_rgba(255,215,0,0.2)] transition-all">
            {isTxHistoryOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </button>
        
        <AnimatePresence>
          {isTxHistoryOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 24 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <TransactionList transactions={transactions} loading={txLoading} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings / Actions */}
      <div className="vedic-panel overflow-hidden divide-y divide-brand-gold/10 p-0">
        <button 
          onClick={() => setIsEditProfileOpen(true)}
          className="w-full flex items-center justify-between p-6 hover:bg-brand-steel/40 transition-all group"
        >
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-brand-steel/50 border border-brand-gold/20 rounded-2xl flex items-center justify-center text-brand-gold group-hover:border-brand-gold/50 group-hover:shadow-[0_0_10px_rgba(255,215,0,0.2)] transition-all">
              <UserIcon size={22} />
            </div>
            <div className="text-left">
              <p className="text-base font-black text-white tracking-tight">Edit Profile</p>
              <p className="text-[10px] font-bold text-brand-gold/60 uppercase tracking-widest">Update your details</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-brand-gold/50 group-hover:text-brand-gold transition-all" />
        </button>
        <button 
          onClick={() => setIsMyRewardsOpen(true)}
          className="w-full flex items-center justify-between p-6 hover:bg-brand-steel/40 transition-all group"
        >
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-brand-steel/50 border border-brand-gold/20 rounded-2xl flex items-center justify-center text-brand-gold group-hover:border-brand-gold/50 group-hover:shadow-[0_0_10px_rgba(255,215,0,0.2)] transition-all">
              <Gift size={22} />
            </div>
            <div className="text-left">
              <p className="text-base font-black text-white tracking-tight">My Rewards</p>
              <p className="text-[10px] font-bold text-brand-gold/60 uppercase tracking-widest">View redeemed codes</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-brand-gold/50 group-hover:text-brand-gold transition-all" />
        </button>
        <button onClick={() => signOut(auth)} className="w-full flex items-center justify-between p-6 hover:bg-ruby-900/20 transition-all group">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-ruby-900/30 border border-ruby-500/30 rounded-2xl flex items-center justify-center text-ruby-400 group-hover:border-ruby-500/60 group-hover:shadow-[0_0_10px_rgba(224,17,95,0.3)] transition-all">
              <LogOut size={22} />
            </div>
            <div className="text-left">
              <p className="text-base font-black text-ruby-400 tracking-tight">Log Out</p>
              <p className="text-[10px] font-bold text-ruby-400/60 uppercase tracking-widest">Sign out of account</p>
            </div>
          </div>
        </button>
      </div>

      <EditProfileModal 
        isOpen={isEditProfileOpen} 
        onClose={() => setIsEditProfileOpen(false)} 
        user={user} 
        profile={profile} 
      />
      <MyRewardsModal 
        isOpen={isMyRewardsOpen} 
        onClose={() => setIsMyRewardsOpen(false)} 
        transactions={transactions} 
      />
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          name: user.displayName || "New User",
          address: "New Address",
          city: "Neemuch",
          householdId: `NM-NEW-${Math.floor(Math.random() * 1000)}`,
          swacchCoinBalance: 0,
          totalWasteDiverted: 0,
          weeklyStats: {
            dryWaste: 0,
            wetWaste: 0,
            co2Saved: 0
          }
        });
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (!authReady) return <div className="p-10 text-center">Initializing...</div>;

  if (!user) {
    return (
      <div className="bg-brand-steel min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/palace/1920/1080?blur=10')] opacity-20 bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-brand-steel/80 via-brand-steel to-brand-steel/90"></div>
        <div className="absolute inset-0 mandala-bg opacity-10"></div>
        
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-gold/20 rounded-full blur-[80px] animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] animate-pulse delay-1000"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="w-32 h-32 vedic-panel flex items-center justify-center mb-10 border-2 border-brand-gold/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] rotate-3 hover:rotate-0 transition-transform duration-500 relative overflow-hidden">
            <div className="absolute inset-0 cyber-glow-blue opacity-20"></div>
            <Leaf className="text-brand-gold relative z-10 drop-shadow-md" size={64} />
          </div>
          <h1 className="text-5xl font-black text-brand-gold mb-4 font-headline tracking-wider drop-shadow-lg">Swacchta Mitra</h1>
          <p className="text-brand-gold/60 font-bold text-xs uppercase tracking-[0.2em] mb-12 max-w-[280px] leading-relaxed font-mono">
            Join the movement. Segregate waste, earn Swacch Coins, and support Neemuch.
          </p>
          <button 
            onClick={handleLogin}
            className="bg-brand-gold text-brand-steel px-10 py-5 rounded-full font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(255,215,0,0.4)] flex items-center gap-4 active:scale-95 transition-all hover:bg-white hover:shadow-[0_0_30px_rgba(255,215,0,0.6)]"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
          <p className="mt-12 text-[10px] font-bold text-brand-gold/40 uppercase tracking-widest font-mono">Powered by Neemuch Municipality</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-brand-steel min-h-screen font-body text-white relative">
      {/* Global Background */}
      <div className="fixed inset-0 bg-[url('https://picsum.photos/seed/palace/1920/1080?blur=10')] opacity-10 bg-cover bg-center mix-blend-overlay pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-b from-brand-steel/90 via-brand-steel to-brand-steel/95 pointer-events-none"></div>
      
      {/* Header */}
      <header className="fixed top-0 w-full z-50 nav-blur flex flex-col px-4 sm:px-6 py-4 border-b border-brand-gold/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] gap-4">
        {/* Top: App Name */}
        <div className="flex justify-center w-full">
          <span className="text-2xl sm:text-3xl font-black text-brand-gold font-headline whitespace-nowrap tracking-wider drop-shadow-md">
            Swacchta Mitra
          </span>
        </div>

        {/* Bottom: User Info & Logout */}
        <div className="flex items-center justify-between w-full">
          {/* Left: User Info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-steel/50 flex items-center justify-center overflow-hidden border-2 border-brand-gold shadow-[0_0_10px_rgba(255,215,0,0.3)] flex-shrink-0 relative">
              <div className="absolute inset-0 cyber-glow-purple opacity-30"></div>
              <img 
                src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} 
                alt="Avatar" 
                className="w-full h-full object-cover relative z-10"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="block">
              <p className="text-[11px] font-black tracking-[0.1em] text-brand-gold/60 uppercase truncate font-mono">Welcome back,</p>
              <p className="text-base font-black text-brand-gold truncate max-w-[150px] sm:max-w-[200px] font-headline tracking-wider">{user.displayName?.split(' ')[0]}</p>
            </div>
          </div>

          {/* Right: Logout */}
          <button 
            onClick={handleLogout} 
            className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-steel/50 text-brand-gold/60 hover:text-ruby-400 hover:bg-ruby-900/30 hover:border-ruby-500/50 transition-all shadow-inner border border-brand-gold/20 active:scale-90"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-40 px-5 max-w-2xl mx-auto relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <HomeScreen userId={user.uid} onNavigate={setActiveTab} />}
          {activeTab === 'market' && <MarketScreen userId={user.uid} />}
          {activeTab === 'wallet' && <WalletScreen userId={user.uid} />}
          {activeTab === 'orders' && <OrdersScreen userId={user.uid} />}
          {activeTab === 'profile' && <ProfileScreen user={user} />}
        </AnimatePresence>
      </main>

      {/* FAB */}
      <button 
        onClick={() => setIsSupportOpen(true)}
        className="fixed bottom-28 right-6 w-16 h-16 bg-brand-gold text-brand-steel rounded-full shadow-[0_0_20px_rgba(255,215,0,0.5)] flex items-center justify-center z-40 active:scale-90 transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,215,0,0.7)] group border-2 border-brand-steel"
      >
        <MessageCircle size={32} className="group-hover:rotate-12 transition-transform" />
      </button>

      {/* Bottom Nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
}

const faqs = [
  { q: "How do I earn Swacch Coins?", a: "You earn coins by handing over segregated dry and wet waste to the Swacchta Mitra during the daily pickup." },
  { q: "How do I redeem coins?", a: "Go to the Market tab, browse local offers, and click Redeem. Show the receipt to the shopkeeper!" },
  { q: "What is dry vs wet waste?", a: "Dry waste includes paper, plastic, glass, and metal. Wet waste includes food scraps, peels, and biodegradable items." },
  { q: "My waste wasn't picked up today.", a: "Sorry about that! Please use the 'Report Issue' button below to let us know, and we'll send someone." }
];

const SupportModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [messages, setMessages] = useState<{id: string, sender: 'bot'|'user', text: string}[]>([
    { id: '1', sender: 'bot', text: 'Hi there! 👋 How can I help you today? Choose a question below or report an issue.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (text: string = inputValue) => {
    if (!text.trim()) return;
    
    const newUserMsg = { id: Date.now().toString(), sender: 'user' as const, text };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');

    // Simulate bot response
    setTimeout(() => {
      if (isReporting) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', text: `Thanks for reporting: "${text}". We've created Ticket #${Math.floor(1000 + Math.random() * 9000)}. Our team will look into it shortly.` }]);
        setIsReporting(false);
      } else {
        // Check if it matches FAQ
        const faq = faqs.find(f => f.q === text);
        if (faq) {
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', text: faq.a }]);
        } else {
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', text: "I'm a simple bot. Please choose from the FAQs or click 'Report Issue'." }]);
        }
      }
    }, 600);
  };

  const startReport = () => {
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', text: "Please describe the issue you're facing (e.g., missed pickup, app error)." }]);
    setIsReporting(true);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-0 z-50 flex flex-col bg-brand-steel sm:p-4 backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 vedic-panel border-b border-brand-gold/30 rounded-none sm:rounded-t-3xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-steel/50 border border-brand-gold/50 rounded-full flex items-center justify-center text-brand-gold shadow-[0_0_10px_rgba(255,215,0,0.2)] relative overflow-hidden">
                <div className="absolute inset-0 cyber-glow-blue opacity-30"></div>
                <MessageCircle size={20} className="relative z-10" />
              </div>
              <div>
                <h2 className="font-black text-brand-gold font-headline tracking-wider drop-shadow-md">Swacch Support</h2>
                <p className="text-xs text-brand-gold/60 font-mono">Always here to help</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-brand-gold/50 hover:text-brand-gold hover:bg-brand-steel/50 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-brand-steel/90">
            <div className="absolute inset-0 mandala-bg opacity-5 pointer-events-none"></div>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} relative z-10`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-brand-gold text-brand-steel rounded-tr-sm shadow-[0_0_15px_rgba(255,215,0,0.2)] font-medium' : 'bg-brand-steel/80 text-white rounded-tl-sm shadow-inner border border-brand-gold/20 backdrop-blur-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions / FAQs */}
          {!isReporting && (
            <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-brand-steel/95 border-t border-brand-gold/10 relative z-10">
              <button onClick={startReport} className="flex-shrink-0 flex items-center gap-1 px-4 py-2 bg-ruby-900/30 text-ruby-400 border border-ruby-500/30 rounded-full text-sm font-bold shadow-sm hover:bg-ruby-900/50 hover:border-ruby-500/50 transition-all">
                <AlertTriangle size={14} /> Report Issue
              </button>
              {faqs.map((faq, i) => (
                <button key={i} onClick={() => handleSend(faq.q)} className="flex-shrink-0 px-4 py-2 bg-brand-steel/50 border border-brand-gold/20 text-brand-gold/80 rounded-full text-sm font-medium shadow-sm hover:bg-brand-steel hover:text-brand-gold hover:border-brand-gold/50 transition-all">
                  {faq.q}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 vedic-panel border-t border-brand-gold/30 rounded-none sm:rounded-b-3xl z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isReporting ? "Describe your issue..." : "Type a message..."}
                className="flex-1 bg-brand-steel/50 border border-brand-gold/20 rounded-full px-4 py-3 focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold text-white placeholder:text-brand-gold/30 outline-none transition-all"
              />
              <button 
                onClick={() => handleSend()}
                disabled={!inputValue.trim()}
                className="w-12 h-12 bg-brand-gold text-brand-steel rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-brand-steel/50 disabled:text-brand-gold/30 disabled:border disabled:border-brand-gold/20 transition-all hover:shadow-[0_0_15px_rgba(255,215,0,0.4)]"
              >
                <Send size={20} className="ml-1" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const EditProfileModal = ({ isOpen, onClose, user, profile }: { isOpen: boolean; onClose: () => void; user: FirebaseUser; profile: User | null }) => {
  const [name, setName] = useState(profile?.name || user.displayName || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [city, setCity] = useState(profile?.city || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(profile?.name || user.displayName || '');
      setAddress(profile?.address || '');
      setCity(profile?.city || '');
    }
  }, [isOpen, profile, user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, "users", user.uid), { name, address, city }, { merge: true });
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-0 z-50 flex flex-col bg-brand-steel sm:p-4 backdrop-blur-md"
        >
          <div className="flex items-center justify-between p-4 vedic-panel border-b border-brand-gold/30 rounded-none sm:rounded-t-3xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-10">
            <h2 className="font-black text-brand-gold font-headline tracking-wider drop-shadow-md text-lg">Edit Profile</h2>
            <button onClick={onClose} className="p-2 text-brand-gold/50 hover:text-brand-gold hover:bg-brand-steel/50 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 relative bg-brand-steel/90">
            <div className="absolute inset-0 mandala-bg opacity-5 pointer-events-none"></div>
            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-sm font-mono text-brand-gold/80 mb-1 uppercase tracking-wider">Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full bg-brand-steel/50 border border-brand-gold/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold text-white placeholder:text-brand-gold/30 outline-none transition-all shadow-inner"
                  placeholder="Your Name"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-brand-gold/80 mb-1 uppercase tracking-wider">Address</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  className="w-full bg-brand-steel/50 border border-brand-gold/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold text-white placeholder:text-brand-gold/30 outline-none transition-all shadow-inner"
                  placeholder="House No, Street, Landmark"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-brand-gold/80 mb-1 uppercase tracking-wider">City</label>
                <input 
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)} 
                  className="w-full bg-brand-steel/50 border border-brand-gold/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold text-white placeholder:text-brand-gold/30 outline-none transition-all shadow-inner"
                  placeholder="Your City"
                />
              </div>
            </div>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-brand-gold text-brand-steel font-black font-headline tracking-wider py-4 rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.3)] hover:shadow-[0_0_25px_rgba(255,215,0,0.5)] transition-all disabled:opacity-50 relative z-10"
            >
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const MyRewardsModal = ({ isOpen, onClose, transactions }: { isOpen: boolean; onClose: () => void; transactions: Transaction[] }) => {
  const redemptions = transactions.filter(tx => tx.type === 'redemption');

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-0 z-50 flex flex-col bg-brand-steel sm:p-4 backdrop-blur-md"
        >
          <div className="flex items-center justify-between p-4 vedic-panel border-b border-brand-gold/30 rounded-none sm:rounded-t-3xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-10">
            <h2 className="font-black text-brand-gold font-headline tracking-wider drop-shadow-md text-lg">My Rewards</h2>
            <button onClick={onClose} className="p-2 text-brand-gold/50 hover:text-brand-gold hover:bg-brand-steel/50 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-brand-steel/90">
            <div className="absolute inset-0 mandala-bg opacity-5 pointer-events-none"></div>
            {redemptions.length === 0 ? (
              <div className="text-center py-12 vedic-panel rounded-2xl border border-brand-gold/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] mt-4 relative z-10">
                <div className="w-16 h-16 bg-brand-steel/50 border border-brand-gold/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_10px_rgba(255,215,0,0.1)]">
                  <Gift className="text-brand-gold/50" size={32} />
                </div>
                <p className="text-brand-gold font-bold mb-1 font-headline tracking-wider">No rewards yet</p>
                <p className="text-brand-gold/60 text-sm max-w-[200px] mx-auto font-mono">Redeem your Swacch Coins in the Market to see your rewards here.</p>
              </div>
            ) : (
              <div className="space-y-3 relative z-10">
                {redemptions.map(tx => {
                  let dateObj: Date;
                  const ts = tx.timestamp as any;
                  if (ts && typeof ts === 'object' && 'toDate' in ts) {
                    dateObj = ts.toDate();
                  } else if (ts) {
                    dateObj = new Date(ts);
                  } else {
                    dateObj = new Date();
                  }
                  const dateStr = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div key={tx.id} className="vedic-panel p-4 rounded-2xl border border-brand-gold/20 shadow-[0_0_10px_rgba(0,0,0,0.3)] flex items-center gap-4 hover:border-brand-gold/40 transition-colors">
                      <div className="w-12 h-12 bg-brand-steel/50 border border-brand-gold/30 rounded-xl flex items-center justify-center text-brand-gold flex-shrink-0 shadow-[0_0_10px_rgba(255,215,0,0.1)]">
                        <Ticket size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate font-headline tracking-wide">{tx.description}</p>
                        <p className="text-xs text-brand-gold/60 font-mono">{dateStr}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-ruby-400 font-mono cyber-glow-purple">-{Math.abs(tx.amount)}</p>
                        <p className="text-[10px] text-brand-gold/50 font-medium uppercase tracking-wider font-mono">Coins</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
