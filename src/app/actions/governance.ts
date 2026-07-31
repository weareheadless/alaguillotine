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
  WarRoomPost,
  WarRoomComment,
  WarRoomVoteStatus,
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

/** Get the identity key for the current user — prefers session, falls back to wallet signature */
async function resolveIdentity(
  walletAddress?: string,
  signature?: string,
  signedMessage?: string,
): Promise<{
  authorId: string | null;
  authorWallet: string | null;
  authorName: string;
  voterKey: string;
} | null> {
  const userId = await getSessionUserId();
  if (userId) {
    const user = getUserById(userId);
    if (user) {
      return {
        authorId: userId,
        authorWallet: user.wallet_address || null,
        authorName: user.display_name || user.username,
        voterKey: userId,
      };
    }
  }

  // No session — try wallet
  if (walletAddress && signature && signedMessage) {
    const expected = `I am posting to the War Room: ${signedMessage.slice(0, 50)}`;
    if (verifyMessageSignature(walletAddress, expected, signature)) {
      return {
        authorId: null,
        authorWallet: walletAddress,
        authorName: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
        voterKey: walletAddress,
      };
    }
  }

  return null;
}

/** Simple wallet-only identity (for voting — session user or wallet) */
async function resolveVoterKey(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (userId) return userId;
  return null; // Wallet-only voting requires passing wallet explicitly
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
         AND p.epoch_number = (
           SELECT epoch_number FROM epochs
           WHERE status = 'voting'
           ORDER BY created_at DESC LIMIT 1
         )
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

// ─── War Room: Posts ───────────────────────────────────────────────────────────

export async function createWarRoomPost(
  title: string,
  body: string,
  proposalId: string | null = null,
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const identity = await resolveIdentity();
  if (!identity) return { success: false, error: "Not authenticated. Login or connect wallet." };

  const trimmedTitle = title.trim().slice(0, 200);
  const trimmedBody = body.trim().slice(0, 5000);
  if (!trimmedTitle) return { success: false, error: "Title cannot be empty." };
  if (!trimmedBody) return { success: false, error: "Body cannot be empty." };

  const isFlagged = await checkModeration(trimmedTitle + " " + trimmedBody);
  if (isFlagged) return { success: false, error: "Post rejected by moderation." };

  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO war_room_posts (id, author_id, author_wallet, author_name, title, body, proposal_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, identity.authorId, identity.authorWallet, identity.authorName, trimmedTitle, trimmedBody, proposalId, now);

  return { success: true, postId: id };
}

export async function fetchWarRoomPosts(
  page: number = 1,
  pageSize: number = 20,
): Promise<{ posts: WarRoomPost[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  const total = (db.prepare(
    "SELECT COUNT(*) as cnt FROM war_room_posts WHERE is_removed = 0"
  ).get() as { cnt: number }).cnt;

  const posts = db.prepare(
    `SELECT * FROM war_room_posts
     WHERE is_removed = 0
     ORDER BY is_sticky DESC, created_at DESC
     LIMIT ? OFFSET ?`
  ).all(pageSize, offset) as WarRoomPost[];

  return { posts, total };
}

export async function fetchWarRoomPost(
  postId: string,
): Promise<{ post: WarRoomPost | null; comments: WarRoomComment[] }> {
  const db = getDb();

  const post = db.prepare(
    "SELECT * FROM war_room_posts WHERE id = ? AND is_removed = 0"
  ).get(postId) as WarRoomPost | undefined;

  const comments = db.prepare(
    `SELECT * FROM war_room_comments
     WHERE post_id = ? AND is_removed = 0
     ORDER BY created_at ASC`
  ).all(postId) as WarRoomComment[];

  return { post: post ?? null, comments };
}

// ─── War Room: Comments ─────────────────────────────────────────────────────────

export async function postWarRoomComment(
  postId: string,
  body: string,
  parentId: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  const identity = await resolveIdentity();
  if (!identity) return { success: false, error: "Not authenticated. Login or connect wallet." };

  const db = getDb();

  // Verify post exists and isn't locked
  const post = db.prepare(
    "SELECT id, is_locked FROM war_room_posts WHERE id = ? AND is_removed = 0"
  ).get(postId) as any;
  if (!post) return { success: false, error: "Post not found." };
  if (post.is_locked) return { success: false, error: "This post is locked." };

  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) return { success: false, error: "Comment cannot be empty." };

  const isFlagged = await checkModeration(trimmed);
  if (isFlagged) return { success: false, error: "Comment rejected by moderation." };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO war_room_comments (id, post_id, parent_id, author_id, author_wallet, author_name, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, postId, parentId, identity.authorId, identity.authorWallet, identity.authorName, trimmed, now);

  // Update comment count on post
  db.prepare(
    "UPDATE war_room_posts SET comment_count = comment_count + 1, updated_at = ? WHERE id = ?"
  ).run(now, postId);

  return { success: true };
}

// ─── War Room: Votes ────────────────────────────────────────────────────────────

export async function castWarRoomVote(
  targetType: "post" | "comment",
  targetId: string,
  vote: 1 | -1,
): Promise<{ success: boolean; error?: string }> {
  const identity = await resolveIdentity();
  if (!identity) return { success: false, error: "Not authenticated. Login or connect wallet." };

  const db = getDb();
  const table = targetType === "post" ? "war_room_posts" : "war_room_comments";
  const now = new Date().toISOString();

  // Verify target exists
  const target = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND is_removed = 0`).get(targetId) as any;
  if (!target) return { success: false, error: "Target not found." };

  // Check existing vote
  const existing = db.prepare(
    "SELECT vote FROM war_room_votes WHERE voter_key = ? AND target_type = ? AND target_id = ?"
  ).get(identity.voterKey, targetType, targetId) as { vote: number } | undefined;

  const voteId = `${identity.voterKey}_${targetType}_${targetId}`;

  if (existing) {
    if (existing.vote === vote) {
      // Same vote — remove it (toggle off)
      db.prepare(
        "DELETE FROM war_room_votes WHERE voter_key = ? AND target_type = ? AND target_id = ?"
      ).run(identity.voterKey, targetType, targetId);

      // Decrement the count
      if (vote === 1) {
        db.prepare(`UPDATE ${table} SET upvote_count = MAX(0, upvote_count - 1) WHERE id = ?`).run(targetId);
      } else {
        db.prepare(`UPDATE ${table} SET downvote_count = MAX(0, downvote_count - 1) WHERE id = ?`).run(targetId);
      }
    } else {
      // Switched vote direction
      db.prepare(
        "UPDATE war_room_votes SET vote = ?, created_at = ? WHERE voter_key = ? AND target_type = ? AND target_id = ?"
      ).run(vote, now, identity.voterKey, targetType, targetId);

      // Swap counts
      if (vote === 1) {
        db.prepare(`UPDATE ${table} SET upvote_count = upvote_count + 1, downvote_count = MAX(0, downvote_count - 1) WHERE id = ?`).run(targetId);
      } else {
        db.prepare(`UPDATE ${table} SET downvote_count = downvote_count + 1, upvote_count = MAX(0, upvote_count - 1) WHERE id = ?`).run(targetId);
      }
    }
  } else {
    // New vote
    db.prepare(
      "INSERT INTO war_room_votes (id, voter_key, target_type, target_id, vote, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(voteId, identity.voterKey, targetType, targetId, vote, now);

    if (vote === 1) {
      db.prepare(`UPDATE ${table} SET upvote_count = upvote_count + 1 WHERE id = ?`).run(targetId);
    } else {
      db.prepare(`UPDATE ${table} SET downvote_count = downvote_count + 1 WHERE id = ?`).run(targetId);
    }
  }

  return { success: true };
}

export async function fetchMyWarRoomVotes(): Promise<WarRoomVoteStatus> {
  const identity = await resolveIdentity();
  if (!identity) return { post_votes: {}, comment_votes: {} };

  const db = getDb();
  const rows = db.prepare(
    "SELECT target_type, target_id, vote FROM war_room_votes WHERE voter_key = ?"
  ).all(identity.voterKey) as Array<{ target_type: string; target_id: string; vote: number }>;

  const postVotes: Record<string, 1 | -1 | 0> = {};
  const commentVotes: Record<string, 1 | -1 | 0> = {};

  for (const r of rows) {
    if (r.target_type === "post") {
      postVotes[r.target_id] = r.vote as 1 | -1;
    } else {
      commentVotes[r.target_id] = r.vote as 1 | -1;
    }
  }

  return { post_votes: postVotes, comment_votes: commentVotes };
}

// ─── DEPRECATED: Old proposal comments (kept for backward compat) ──────────────

export async function postComment(
  proposalId: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  // Redirect to War Room — find or create the post for this proposal
  const db = getDb();
  const proposal = db.prepare(
    "SELECT * FROM oracle_proposals WHERE id = ?"
  ).get(proposalId) as OracleProposalRow | undefined;
  if (!proposal) return { success: false, error: "Proposal not found." };

  // Find existing war room post for this proposal
  let warPost = db.prepare(
    "SELECT id FROM war_room_posts WHERE proposal_id = ? AND is_removed = 0 LIMIT 1"
  ).get(proposalId) as { id: string } | undefined;

  if (!warPost) {
    // Auto-create a War Room post
    const identity = await resolveIdentity();
    if (!identity) return { success: false, error: "Not authenticated." };

    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO war_room_posts (id, author_id, author_wallet, author_name, title, body, proposal_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(postId, identity.authorId, identity.authorWallet, identity.authorName,
      `${proposal.emoji} ${proposal.title}`,
      proposal.manifesto,
      proposalId,
      now);
    warPost = { id: postId };
  }

  // Post comment in War Room
  return postWarRoomComment(warPost.id, text);
}

export async function fetchProposalComments(
  proposalId: string,
): Promise<ProposalComment[]> {
  const db = getDb();

  // Find War Room post for this proposal
  const warPost = db.prepare(
    "SELECT id FROM war_room_posts WHERE proposal_id = ? AND is_removed = 0 LIMIT 1"
  ).get(proposalId) as { id: string } | undefined;
  if (!warPost) return [];

  const comments = db.prepare(
    `SELECT id, post_id as proposal_id, author_wallet, author_name, body as text, created_at
     FROM war_room_comments
     WHERE post_id = ? AND is_removed = 0
     ORDER BY created_at ASC`
  ).all(warPost.id) as ProposalComment[];

  return comments;
}
