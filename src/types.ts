export interface User {
  id: string;
  name: string;
  address: string;
  city: string;
  householdId: string;
  swacchCoinBalance: number;
  totalWasteDiverted: number;
  weeklyStats: {
    dryWaste: number;
    wetWaste: number;
    co2Saved: number;
  };
}

export interface Offer {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  coinCost: number;
  category: "Groceries" | "Services" | "Events" | "Neemuch Local";
  imageUrl: string;
}

export interface Transaction {
  id: string;
  userId: string;
  businessId?: string;
  type: "pickup" | "redemption";
  amount: number;
  description: string;
  timestamp: string;
  wasteWeight?: number;
  offerId?: string;
}
