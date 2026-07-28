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

export interface TraitorEntry {
  author_name: string;
  total_paid: number;
  total_messages: number;
  last_active_at: string;
}

export interface SubmitNominationResponse {
  success: boolean;
  error?: string;
}

export const NOMINATION_WEIGHT_FREE = 1;
export const NOMINATION_WEIGHT_MULTIPLIER = 100; // 1 CHOP = 100 weight for paid nominations

// ─── Epochs & Board (Economic Experiment) ────────────────────────────────────

export interface EpochDocument extends Models.Document {
  epoch_number: number;
  status: "active" | "voting" | "executed";
  start_msg_count: number;
  end_msg_count: number;
  board_members: BoardMember[]; // JSON array
  treasury_amount: number;
  unique_senders: number;
  started_at: string;
  voting_started_at: string | null;
  executed_at: string | null;
  // Results (populated after execution)
  final_burn: number;
  final_lottery: number;
  final_dev: number;
  final_board: number;
  director_fees: Record<string, number>; // wallet -> fee
  hypothesis_winner: string | null; // "H1" | "H2" | "H3" | "H4"
}

export interface BoardMember {
  wallet: string;
  balance: number; // CHOP balance at epoch start
  voted: boolean;
  vote: VoteAllocation | null;
}

export interface VoteAllocation {
  burn_rate: number;       // 0-100
  lottery_rate: number;    // 0-100
  dev_rate: number;        // 0-100
  board_rate: number;      // 0-100
}

export interface EpochSummary {
  epoch_number: number;
  status: "active" | "voting" | "executed";
  started_at: string;
  total_messages: number;
  treasury_amount: number;
  board_members: BoardMember[];
}

export interface SubmitVoteResponse {
  success: boolean;
  error?: string;
}

/** Dynamic epoch threshold — starts at 1,000, scales by 1.5× per epoch */
export function getEpochThreshold(epochNumber: number): number {
  return Math.floor(1000 * Math.pow(1.5, epochNumber - 1));
}

export const BOARD_SIZE = 7;
export const VOTING_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 hours to vote
