import type { Timestamp } from "firebase/firestore";

export interface UserDoc {
  displayName: string;
  balance: number;
  createdAt: Timestamp;
}

export interface Market {
  id: string;
  question: string;
  creatorId: string;
  creatorName?: string;
  outcomes: string[];
  pool: Record<string, number>;
  status: "open" | "closed" | "resolved";
  resolvedOutcome: string | null;
  closesAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface Position {
  id: string;
  marketId: string;
  userId: string;
  outcome: string;
  amountWagered: number;
  priceAtPurchase: number;
  payoutClaimed: boolean;
  timestamp: Timestamp;
}
