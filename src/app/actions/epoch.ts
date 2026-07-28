"use server";

import { Account } from "node-appwrite";
import { Client } from "node-appwrite";
import { Connection, PublicKey } from "@solana/web3.js";
import type {
  EpochDocument,
  EpochSummary,
  BoardMember,
  VoteAllocation,
  SubmitVoteResponse,
} from "../../lib/types";
import { getEpochThreshold, BOARD_SIZE, VOTING_PERIOD_MS } from "../../lib/types";
import { LocalDatabases, Query } from "../../lib/local-db";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getDb() {
  return new LocalDatabases();
}

function getJwtClient(jwt: string) {
  return new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
}

// ─── Epoch Management ──────────────────────────────────────────────────────────

/** Fetch the live on-chain CHOP balance of the treasury wallet */
export async function getTreasuryBalance(): Promise<number> {
  const receiverStr = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET;
  if (!receiverStr) return 0;

  try {
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpc);
    const mint = new PublicKey(process.env.NEXT_PUBLIC_CHOP_MINT || "DTPZyd2HnDmLQfCGkFJ7ajVbw77maUVT7QVLE7Ltpump");
    const treasury = new PublicKey(receiverStr);

    // Use getTokenAccountsByOwner — works for both regular SPL and Token 2022
    const accounts = await connection.getTokenAccountsByOwner(treasury, { mint });
    const decimals = parseInt(process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6", 10);
    let total = 0;

    for (const { account } of accounts.value) {
      const data = account.data;
      const amount = Number(data.readBigUInt64LE(64));
      total += amount / Math.pow(10, decimals);
    }

    return total;
  } catch {
    return 0;
  }
}

/** Get the current active or voting epoch */
export async function getCurrentEpoch(): Promise<EpochSummary | null> {
  const db = getDb();

  try {
    const res = db.listDocuments("", "epochs", [
      Query.or([
        Query.equal("status", "active"),
        Query.equal("status", "voting"),
      ]),
      Query.orderDesc("created_at"),
      Query.limit(1),
    ]);

    if (res.documents.length === 0) {
      return null;
    }

    const doc = res.documents[0] as unknown as EpochDocument;
    return docToSummary(doc);
  } catch {
    return null;
  }
}

/** Try to get or create the current epoch */
export async function ensureEpoch(): Promise<EpochSummary | null> {
  const db = getDb();

  // Check for active or voting epoch
  try {
    const existing = db.listDocuments("", "epochs", [
      Query.or([
        Query.equal("status", "active"),
        Query.equal("status", "voting"),
      ]),
      Query.orderDesc("created_at"),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      return docToSummary(existing.documents[0] as unknown as EpochDocument);
    }

    // No active epoch — create one
    // Count total messages to determine epoch number
    const msgCount = db.listDocuments("", "messages", [
      Query.equal("is_shadowbanned", false),
      Query.limit(1),
    ]);

    const totalMessages = msgCount.total;

    // Find last executed epoch to determine next epoch number
    const lastExecuted = db.listDocuments("", "epochs", [
      Query.equal("status", "executed"),
      Query.orderDesc("created_at"),
      Query.limit(1),
    ]);

    const nextEpochNum = lastExecuted.documents.length > 0
      ? (lastExecuted.documents[0] as unknown as EpochDocument).epoch_number + 1
      : 1;

    const threshold = getEpochThreshold(nextEpochNum);

    // Count messages since last epoch start
    const startMsgCount = lastExecuted.documents.length > 0
      ? (lastExecuted.documents[0] as unknown as EpochDocument).end_msg_count
      : 0;

    // Board members — fetch from the latest snapshot (or empty if none yet)
    // In production, the discovery script populates board members into the epoch doc
    const boardMembers: BoardMember[] = []; // Will be populated by discovery script

    const epochDoc = db.createDocument(
      "",
      "epochs",
      "unique()",
      {
        epoch_number: nextEpochNum,
        status: "active",
        start_msg_count: startMsgCount,
        end_msg_count: startMsgCount + threshold,
        board_members: JSON.stringify(boardMembers),
        treasury_amount: 0,
        unique_senders: 0,
        started_at: new Date().toISOString(),
        voting_started_at: null,
        executed_at: null,
        final_burn: 0,
        final_lottery: 0,
        final_dev: 0,
        final_board: 0,
        director_fees: "{}",
        hypothesis_winner: null,
        created_at: new Date().toISOString(),
      }
    );

    return docToSummary(epochDoc as unknown as EpochDocument);
  } catch (err) {
    console.error("[Epoch] ensureEpoch error:", err);
    return null;
  }
}

/** Check if epoch threshold is crossed — if so, transition to voting */
export async function checkEpochTransition(): Promise<boolean> {
  const db = getDb();

  try {
    const active = db.listDocuments("", "epochs", [
      Query.equal("status", "active"),
      Query.limit(1),
    ]);

    if (active.documents.length === 0) return false;

    const epoch = active.documents[0] as unknown as EpochDocument;

    // Count current messages
    const msgCount = db.listDocuments("", "messages", [
      Query.equal("is_shadowbanned", false),
      Query.limit(1),
    ]);

    if (msgCount.total >= epoch.end_msg_count) {
      // Transition to voting
      db.updateDocument("", "epochs", (epoch as any).id, {
        status: "voting",
        voting_started_at: new Date().toISOString(),
        unique_senders: await countUniqueSenders(epoch),
      });

      return true;
    }

    return false;
  } catch (err) {
    console.error("[Epoch] checkEpochTransition error:", err);
    return false;
  }
}

// ─── Voting ────────────────────────────────────────────────────────────────────

/** Cast a vote as a board member (requires wallet auth via JWT) */
export async function submitVote(
  jwt: string,
  wallet: string,
  burnRate: number,
  lotteryRate: number,
  devRate: number,
  boardRate: number,
): Promise<SubmitVoteResponse> {
  const sum = burnRate + lotteryRate + devRate + boardRate;
  if (Math.abs(sum - 100) > 0.01) {
    return { success: false, error: "Rates must sum to 100%." };
  }

  const jwtClient = getJwtClient(jwt);
  const account = new Account(jwtClient);
  let user;
  try {
    user = await account.get();
  } catch {
    return { success: false, error: "Session expired." };
  }

  const db = getDb();

  // Find current voting epoch
  const voting = db.listDocuments("", "epochs", [
    Query.equal("status", "voting"),
    Query.limit(1),
  ]);

  if (voting.documents.length === 0) {
    return { success: false, error: "No active voting epoch." };
  }

  const epoch = voting.documents[0] as unknown as EpochDocument;
  const members: BoardMember[] = typeof epoch.board_members === "string"
    ? JSON.parse(epoch.board_members)
    : epoch.board_members;

  // Verify this wallet is on the board
  const memberIdx = members.findIndex(
    (m) => m.wallet.toLowerCase() === wallet.toLowerCase(),
  );
  if (memberIdx === -1) {
    return { success: false, error: "Your wallet is not on the board." };
  }

  const vote: VoteAllocation = { burn_rate: burnRate, lottery_rate: lotteryRate, dev_rate: devRate, board_rate: boardRate };

  // Save the vote
  db.createDocument("", "votes", "unique()", {
    epoch_id: (epoch as any).id,
    epoch_number: epoch.epoch_number,
    voter_wallet: wallet,
    voter_user_id: user.$id,
    burn_rate: burnRate,
    lottery_rate: lotteryRate,
    dev_rate: devRate,
    board_rate: boardRate,
    created_at: new Date().toISOString(),
  });

  // Mark the board member as voted
  members[memberIdx].voted = true;
  members[memberIdx].vote = vote;
  db.updateDocument("", "epochs", (epoch as any).id, {
    board_members: JSON.stringify(members),
  });

  // Check if all board members voted → auto-tally
  const allVoted = members.every((m) => m.voted);
  if (allVoted) {
    await tallyEpoch((epoch as any).id);
  }

  // Check if voting period expired → auto-tally
  const votingStart = new Date(epoch.voting_started_at || epoch.started_at).getTime();
  if (Date.now() - votingStart > VOTING_PERIOD_MS) {
    await tallyEpoch((epoch as any).id);
  }

  return { success: true };
}

/** Tallies votes and executes the result */
async function tallyEpoch(epochId: string): Promise<void> {
  const db = getDb();

  const epochDoc = db.getDocument("", "epochs", epochId);
  const epoch = epochDoc as unknown as EpochDocument;

  if (epoch.status !== "voting") return;

  // Fetch all votes for this epoch
  const votesRes = db.listDocuments("", "votes", [
    Query.equal("epoch_id", epochId),
    Query.limit(50),
  ]);

  const votes = votesRes.documents as unknown as Array<{
    burn_rate: number;
    lottery_rate: number;
    dev_rate: number;
    board_rate: number;
  }>;

  if (votes.length === 0) {
    // No votes cast — default: 25/25/25/25
    await executeEpochAllocation(epochId, 25, 25, 25, 25);
    return;
  }

  // Average the votes
  const avg = {
    burn: votes.reduce((s, v) => s + v.burn_rate, 0) / votes.length,
    lottery: votes.reduce((s, v) => s + v.lottery_rate, 0) / votes.length,
    dev: votes.reduce((s, v) => s + v.dev_rate, 0) / votes.length,
    board: votes.reduce((s, v) => s + v.board_rate, 0) / votes.length,
  };

  // Normalize to sum 100
  const sum = avg.burn + avg.lottery + avg.dev + avg.board;
  const burn = Math.round(avg.burn / sum * 100);
  const lottery = Math.round(avg.lottery / sum * 100);
  const board = Math.round(avg.board / sum * 100);
  const dev = 100 - burn - lottery - board;

  await executeEpochAllocation(epochId, burn, lottery, dev, board);
}

/** Write execution results to DB (actual treasury transfers happen in a script) */
async function executeEpochAllocation(
  epochId: string,
  burnRate: number,
  lotteryRate: number,
  devRate: number,
  boardRate: number,
): Promise<void> {
  const db = getDb();

  // Determine which hypothesis is winning
  let hypothesisWinner: string;
  if (burnRate > 50) {
    hypothesisWinner = "H1"; // Plutocracy
  } else if (lotteryRate + devRate >= 30 && lotteryRate >= 10 && devRate >= 10) {
    hypothesisWinner = "H2"; // Class Traitor
  } else if (boardRate > 50) {
    hypothesisWinner = "H4"; // Kleptocracy
  } else {
    hypothesisWinner = "H3"; // Deadlock
  }

  db.updateDocument("", "epochs", epochId, {
    status: "executed",
    executed_at: new Date().toISOString(),
    final_burn: burnRate,
    final_lottery: lotteryRate,
    final_dev: devRate,
    final_board: boardRate,
    hypothesis_winner: hypothesisWinner,
  });
}

// ─── Queries ───────────────────────────────────────────────────────────────────

async function countUniqueSenders(epoch: EpochDocument): Promise<number> {
  const db = getDb();

  // Count unique author_ids in the epoch's message range
  const res = db.listDocuments("", "messages", [
    Query.equal("is_shadowbanned", false),
    Query.greaterThanEqual("created_at", epoch.started_at),
    Query.limit(5000),
  ]);

  const uniqueIds = new Set(
    res.documents.map((d: any) => d.author_id).filter(Boolean),
  );

  return uniqueIds.size;
}

function docToSummary(doc: EpochDocument): EpochSummary {
  const members: BoardMember[] = typeof doc.board_members === "string"
    ? JSON.parse(doc.board_members)
    : doc.board_members;

  return {
    epoch_number: doc.epoch_number,
    status: doc.status,
    started_at: doc.started_at,
    total_messages: doc.end_msg_count - doc.start_msg_count,
    treasury_amount: doc.treasury_amount,
    board_members: members,
  };
}

/** Fetch all executed epochs for the history page */
export async function fetchEpochHistory(): Promise<EpochDocument[]> {
  const db = getDb();

  try {
    const res = db.listDocuments("", "epochs", [
      Query.equal("status", "executed"),
      Query.orderDesc("created_at"),
      Query.limit(100),
    ]);
    return res.documents as unknown as EpochDocument[];
  } catch {
    return [];
  }
}

/** Fetch votes for a given epoch (public) */
export async function fetchEpochVotes(epochId: string): Promise<Array<{
  voter_wallet: string;
  burn_rate: number;
  lottery_rate: number;
  dev_rate: number;
  board_rate: number;
}>> {
  const db = getDb();

  try {
    const res = db.listDocuments("", "votes", [
      Query.equal("epoch_id", epochId),
      Query.limit(20),
    ]);
    return res.documents.map((d: any) => ({
      voter_wallet: d.voter_wallet,
      burn_rate: d.burn_rate,
      lottery_rate: d.lottery_rate,
      dev_rate: d.dev_rate,
      board_rate: d.board_rate,
    }));
  } catch {
    return [];
  }
}

/** Check if a given wallet is on the current board */
export async function isBoardMember(wallet: string): Promise<BoardMember | null> {
  const db = getDb();

  try {
    const res = db.listDocuments("", "votes", [
      Query.or([
        Query.equal("status", "active"),
        Query.equal("status", "voting"),
      ]),
      Query.limit(1),
    ]);

    if (res.documents.length === 0) return null;

    const epoch = res.documents[0] as unknown as EpochDocument;
    const members: BoardMember[] = typeof epoch.board_members === "string"
      ? JSON.parse(epoch.board_members)
      : epoch.board_members;

    return members.find((m) => m.wallet.toLowerCase() === wallet.toLowerCase()) || null;
  } catch {
    return null;
  }
}
