import type { Models } from "appwrite";

export interface MessageDocument extends Models.Document {
  text: string;
  author_id: string | null;
  author_name: string;
  amount_paid: number;
  is_shadowbanned: boolean;
  created_at: string;
}

export interface FeedMessage {
  $id: string;
  text: string;
  author_id: string | null;
  author_name: string;
  amount_paid: number;
  is_shadowbanned: boolean;
  created_at: string;
  parent_id: string | null;
}

export interface SubmitFreeResponse {
  success: boolean;
  error?: string;
}

export interface SubmitCommentResponse {
  success: boolean;
  error?: string;
}

export interface SubmitPaidResponse {
  success: boolean;
  error?: string;
  transactionSignature?: string;
}

export interface CounterData {
  total: number;
}

// ─── Nominations (Guillotine Leaderboard) ─────────────────────────────────────

export interface NominationDocument extends Models.Document {
  target_name: string;
  voter_id: string | null;
  voter_name: string;
  message_id: string;
  weight: number;
  amount_paid: number;
  created_at: string;
}

export interface NominationEntry {
  target_name: string;
  total_weight: number;
  total_votes: number;
  total_paid: number;
  last_nominated_at: string;
}

export interface SubmitNominationResponse {
  success: boolean;
  error?: string;
}

export const NOMINATION_WEIGHT_FREE = 1;
export const NOMINATION_WEIGHT_MULTIPLIER = 100; // 1 SOL = 100 weight for paid nominations
