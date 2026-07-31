export interface MessageDocument {
  $id: string;
  id: string;
  text: string;
  author_id: string | null;
  author_name: string;
  amount_paid: number;
  is_shadowbanned: boolean;
  created_at: string;
  parent_id?: string | null;
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
  /** Solana tx signature of the burn, for blockchain transparency */
  burnTx?: string;
}

export interface SubmitCommentResponse {
  success: boolean;
  error?: string;
  /** Solana tx signature of the burn, for blockchain transparency */
  burnTx?: string;
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

export interface NominationDocument {
  $id: string;
  id: string;
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

export interface BenefactorEntry {
  author_name: string;
  total_paid: number;
  message_count: number;
  last_paid_at: string;
}

export interface SubmitNominationResponse {
  success: boolean;
  error?: string;
}

export const NOMINATION_WEIGHT_FREE = 1;
export const NOMINATION_WEIGHT_MULTIPLIER = 100; // 1 CHOP = 100 weight for paid nominations

// ─── Epochs & Board (Economic Experiment) ────────────────────────────────────

export interface EpochDocument {
  $id: string;
  id: string;
  epoch_number: number;
  status: "active" | "voting" | "executed";
  start_msg_count: number;
  end_msg_count: number;
  treasury_amount: number;
  unique_senders: number;
  started_at: string;
  created_at: string;
}

export interface EpochSummary {
  epoch_number: number;
  status: "active" | "voting" | "executed";
  started_at: string;
  total_messages: number;
  treasury_amount: number;
}

/** Dynamic epoch threshold — starts at 1,000, scales by 1.5× per epoch */
export function getEpochThreshold(epochNumber: number): number {
  return Math.floor(1000 * Math.pow(1.5, epochNumber - 1));
}

// ─── Oracle & Governance (Phase 21) ──────────────────────────────────────────

export type {
  OraclePlan,
  OracleOutput,
  OracleInput,
  OracleProposalRow,
  ProposalWithTally,
  EpochTally,
  ProposalComment,
  WarRoomPost,
  WarRoomComment,
  WarRoomVoteStatus,
} from "./oracle-types";
