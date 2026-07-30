"use server";

import { getDb } from "../../lib/local-db";
import { getSessionUserId } from "../../lib/session";
import { getUserById } from "../../lib/users";
import { verifyMessageSignature, buildVoteMessage } from "../../lib/solana-verify";
import type {
  OracleProposalRow,
  ProposalWithTally,
  EpochTally,
  ProposalComment,
} from "../../lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Simple moderation check — rejects obvious hate speech. Replace with OpenAI if desired. */
async function checkModeration(text: string): Promise<boolean> {
  const blocked = [
    /n+[i1]g+[e3]+r+/i,
    /f+[a@]+g+[o0]+t+/i,
    /k+y+l+e+/i,
    /r+[e3]+t+[a@]+r+d+/i,
    /t+r+[a@]+n+n+y+/i,
  ];
  return blocked.some((r) => r.test(text));
}

// ─── Voting ─────────────────────────────────────────────────────────────────────

export async function castVote(
  proposalId: string,
  signature: string,
  signedMessage: string,
): Promise<{ success: boolean; error?: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const user = getUserById(userId);
  if (!user?.wallet_address) return { success: false, error: "Link a wallet first." };

  const db = getDb();
  const proposal = db
    .prepare("SELECT * FROM oracle_proposals WHERE id = ? AND status = 'active'")
    .get(proposalId) as OracleProposalRow | undefined;
  if (!proposal) return { success: false, error: "Proposal not found or expired." };

  const expectedMsg = buildVoteMessage(proposalId, proposal.title);
  if (signedMessage !== expectedMsg) return { success: false, error: "Message mismatch." };
  if (!verifyMessageSignature(user.wallet_address, signedMessage, signature))
    return { success: false, error: "Invalid signature." };

  // Check for existing vote (change vote allowed)
  const voteId = `${proposal.epoch_number}_${user.wallet_address}`;
  db.prepare(
    `INSERT INTO governance_votes (id, epoch_number, proposal_id, voter_wallet, voter_user_id, signature, voted_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(voter_wallet, epoch_number) DO UPDATE SET
       proposal_id = excluded.proposal_id,
       signature = excluded.signature,
       voted_message = excluded.voted_message`
  ).run(
    voteId,
    proposal.epoch_number,
    proposalId,
    user.wallet_address,
    userId,
    signature,
    signedMessage,
    new Date().toISOString(),
  );

  return { success: true };
}

// ─── Proposals ──────────────────────────────────────────────────────────────────

export async function fetchActiveProposals(): Promise<ProposalWithTally[]> {
  const db = getDb();
  const proposals = db
    .prepare(
      `SELECT p.*, COUNT(v.id) as vote_count
       FROM oracle_proposals p
       LEFT JOIN governance_votes v ON v.proposal_id = p.id
       WHERE p.status = 'active'
       GROUP BY p.id
       ORDER BY p.is_none_option ASC, p.created_at ASC`
    )
    .all() as Array<OracleProposalRow & { vote_count: number }>;

  const total = proposals.reduce((s, p) => s + p.vote_count, 0);
  return proposals.map((p) => ({
    ...p,
    vote_count: p.vote_count,
    percentage: total > 0 ? Math.round((p.vote_count / total) * 100) : 0,
  }));
}

export async function fetchEpochTally(): Promise<EpochTally | null> {
  const db = getDb();
  const epoch = db
    .prepare(
      "SELECT * FROM epochs WHERE status IN ('voting','executed') ORDER BY created_at DESC LIMIT 1"
    )
    .get() as any;
  if (!epoch) return null;

  const proposals = db
    .prepare(
      `SELECT p.*, COUNT(v.id) as vote_count
       FROM oracle_proposals p
       LEFT JOIN governance_votes v ON v.proposal_id = p.id
       WHERE p.epoch_number = ?
       GROUP BY p.id ORDER BY p.is_none_option ASC, p.created_at ASC`
    )
    .all(epoch.epoch_number) as Array<OracleProposalRow & { vote_count: number }>;

  const totalVotes = proposals.reduce((s, p) => s + p.vote_count, 0);
  const proposalsWithPct = proposals.map((p) => ({
    ...p,
    vote_count: p.vote_count,
    percentage: totalVotes > 0 ? Math.round((p.vote_count / totalVotes) * 100) : 0,
  }));

  const winner = proposalsWithPct.find((p) => p.status === "won") ?? null;
  const noneOption = proposalsWithPct.find((p) => p.is_none_option === 1);

  const noneWinCount = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM oracle_proposals
       WHERE epoch_number = ? AND is_none_option = 1 AND status = 'won'`
    )
    .get(epoch.epoch_number) as { cnt: number };

  return {
    epoch_number: epoch.epoch_number,
    proposals: proposalsWithPct,
    total_votes: totalVotes,
    winner,
    is_none_winner: noneOption?.status === "won",
    attempt_number: proposals[0]?.attempt_number ?? 1,
    oracle_fired: noneWinCount.cnt >= 3,
  };
}

export async function fetchMyVote(epochNumber: number): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user?.wallet_address) return null;

  const db = getDb();
  const row = db
    .prepare(
      "SELECT proposal_id FROM governance_votes WHERE epoch_number = ? AND voter_wallet = ?"
    )
    .get(epochNumber, user.wallet_address) as { proposal_id: string } | undefined;
  return row?.proposal_id ?? null;
}

// ─── Proposal Comments ─────────────────────────────────────────────────────────

export async function postComment(
  proposalId: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const user = getUserById(userId);
  if (!user?.wallet_address) return { success: false, error: "Link a wallet first." };

  const db = getDb();

  // Verify proposal exists and is active
  const proposal = db
    .prepare("SELECT id FROM oracle_proposals WHERE id = ? AND status = 'active'")
    .get(proposalId) as any;
  if (!proposal) return { success: false, error: "Proposal not found or voting closed." };

  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return { success: false, error: "Comment cannot be empty." };

  // Moderation check
  const isFlagged = await checkModeration(trimmed);
  if (isFlagged) return { success: false, error: "Comment rejected by moderation." };

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO proposal_comments (id, proposal_id, author_wallet, author_user_id, author_name, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    proposalId,
    user.wallet_address,
    userId,
    user.display_name || user.username,
    trimmed,
    new Date().toISOString(),
  );

  return { success: true };
}

export async function fetchProposalComments(
  proposalId: string,
): Promise<ProposalComment[]> {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, proposal_id, author_wallet, author_name, text, created_at
       FROM proposal_comments
       WHERE proposal_id = ? AND is_rejected = 0
       ORDER BY created_at ASC`
    )
    .all(proposalId) as ProposalComment[];
}
