export interface OraclePlan {
  title: string;
  emoji: string;
  manifesto: string;
  burn_pct: number;
  bounty_pct: number;
  infra_pct: number;
  marketing_pct: number;
}

export interface OracleOutput {
  plans: OraclePlan[];   // Exactly 3
}

export interface OracleInput {
  epoch_number: number;
  attempt_number: number;
  times_fired_total: number;

  // Treasury
  treasury_balance_chop: number;
  treasury_balance_usd: number;

  // Activity
  total_messages: number;
  messages_this_epoch: number;

  // Market
  chop_price_usd: number | null;
  chop_market_cap_usd: number | null;
  chop_volume_24h_usd: number | null;

  // History
  previous_epoch_winner: string | null;
  previous_epoch_allocations: {
    burn_chop: number;
    bounty_chop: number;
    infra_chop: number;
    marketing_chop: number;
  } | null;
  prev_epoch_voter_count: number;
}

export interface OracleProposalRow {
  id: string;
  epoch_number: number;
  attempt_number: number;
  is_none_option: number;
  title: string;
  emoji: string;
  manifesto: string;
  burn_pct: number;
  bounty_pct: number;
  infra_pct: number;
  marketing_pct: number;
  oracle_raw_response: string;
  status: "active" | "won" | "lost" | "expired";
  created_at: string;
  resolved_at: string | null;
}

export interface ProposalWithTally extends OracleProposalRow {
  vote_count: number;
  percentage: number;
}

export interface EpochTally {
  epoch_number: number;
  proposals: ProposalWithTally[];
  total_votes: number;
  winner: OracleProposalRow | null;
  is_none_winner: boolean;
  attempt_number: number;
  oracle_fired: boolean;
}

/** A comment on a proposal */
export interface ProposalComment {
  id: string;
  proposal_id: string;
  author_wallet: string;
  author_name: string;
  text: string;
  created_at: string;
}

// ─── War Room (Reddit-style community board) ────────────────────────────────────

export interface WarRoomPost {
  id: string;
  author_id: string | null;
  author_wallet: string | null;
  author_name: string;
  title: string;
  body: string;
  proposal_id: string | null;
  is_sticky: number;
  is_locked: number;
  is_removed: number;
  upvote_count: number;
  downvote_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface WarRoomComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_wallet: string | null;
  author_name: string;
  body: string;
  is_removed: number;
  upvote_count: number;
  downvote_count: number;
  created_at: string;
}

export interface WarRoomVoteStatus {
  post_votes: Record<string, 1 | -1 | 0>;    // post_id → vote direction (0 = no vote)
  comment_votes: Record<string, 1 | -1 | 0>;  // comment_id → vote direction
}
