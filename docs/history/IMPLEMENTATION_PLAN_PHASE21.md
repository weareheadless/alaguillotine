# Project $CHOP Phase 21 — Implementation Plan

> **Architect's note:** This plan replaces the multisig/board/committee trajectory
> with a lightweight off-chain governance system. No smart contracts. No multisig.
> No Solana programs. Just signatures, a cron job, and SQLite.

---

## ⚠️ CRITICAL RULES

1. **Never import `better-sqlite3` in a client component.** Native C module — only
   works in `"use server"` files, API routes, or scripts.
2. **Never use `cookies()` from `next/headers` in a client component.** Server-only.
3. **One concern per file.** Governance, oracle, and epoch each get their own module.
4. **Session is HTTP-only cookie.** Not localStorage, not JWT in JS. Cookie name
   must remain `fye_session`.
5. **All wallet signatures are gasless.** Use `signMessage()` — never `sendTransaction()` — for voting.
6. **Keep existing auth + message submission + guillotine counter untouched.**

---

## The Model

```
Each epoch, the AI Oracle generates 3 competing allocation plans.
The community votes for the plan they want. Plurality wins.
If no plan gets more votes than NONE OF THESE, the Oracle regenerates.
```

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️ 3 TRACKERS DETECTED — CLAIM YOUR $CHOP AIRDROP            │
│                                                                  │
│  🔥 SCORCHED EARTH COMMITTEE                           [VOTE]   │
│  Burn: 70% | Bounty: 10% | Infra: 10% | Mktg: 10%               │
│  "The only honest redistribution is destruction. Every           │
│   token burned is a middle finger to the market."                │
│  💬 14 comments                                                 │
│                                                                  │
│  💀 THE KETAMINE BUDGET                                [VOTE]   │
│  Burn: 15% | Bounty: 55% | Infra: 15% | Mktg: 15%               │
│  "Pay the hunters. Someone out there deserves this               │
│   money more than a dead billionaire's blockchain does."         │
│  💬 8 comments                                                  │
│                                                                  │
│  🏛️ PROPAGANDA MINISTRY                               [VOTE]   │
│  Burn: 10% | Bounty: 15% | Infra: 25% | Mktg: 50%               │
│  "The revolution dies in silence. Fund the signal.               │
│   Billboards. Memes. Stunts. Make them look."                    │
│  💬 3 comments                                                  │
│                                                                  │
│  ❌ NONE OF THESE — THE COMMITTEE MUST TRY AGAIN        [VOTE]   │
│                                                                  │
│  🔥 SCORCHED: 312   💀 KETAMINE: 198   🏛️ PROPAGANDA: 89       │
│  ❌: 47                                                          │
│  SCORCHED EARTH COMMITTEE WINS — 70% burns this epoch. 🔪       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Governance Rules

| Situation | What Happens |
|---|---|
| A proposal gets the most votes (plurality) | That plan executes |
| NONE OF THESE gets the most votes | Oracle regenerates 3 new proposals (attempt +1) |
| NONE OF THESE wins 3 times in one epoch | Oracle FIRED. Default 33/33/34 executes. Dev re-engineers the prompt. |
| Tie between proposals | The Oracle's first-ranked plan wins (tiebreaker) |
| Tie between a proposal and NONE | NONE wins (community is negative/neutral — Oracle tries harder) |
| No votes cast | Default 33/33/34 executes after voting window expires |

---

## Architecture Decisions

| Decision | Resolution |
|---|---|
| Voting model | Multi-proposal plurality. 3 plans + 1 NONE escape hatch. |
| Oracle output | 3 full allocation plans, each with title, emoji, manifesto, and 4 percentages (burn, bounty, infra, marketing). Must sum to 100%. |
| Oracle inputs | Structured data ONLY: treasury balance, epoch number, message count, CHOP market data, previous results. NO terminal text. |
| Oracle firing | NONE wins 3 times in same epoch → fired → default 25/25/25/25. Dev re-engineers prompt. |
| Delegation | NOT in MVP. Direct voting only. Add later if needed. |
| Factions | Ephemeral and built-in. Each proposal IS a faction. New epoch = new factions. |
| Proposal discussion | Each proposal gets its own flat comment thread. ≥1 CHOP to post. Moderated via OpenAI. Frozen when voting closes. |
| Vote counting | 1 wallet = 1 vote. ≥1 CHOP required. No balance weighting. |
| Sybil resistance | None intentionally. ≥1 CHOP is the only gate. Sybil exploitation is content. |
| Epoch timing | Configurable via `EPOCH_MESSAGE_THRESHOLD` (default 1,000, scales by 1.5×). |
| Blind Executioner | Dev manually executes treasury transfers. Tx details pre-published 60 min before signing. |
| LLM provider | OpenAI (`gpt-4o-mini`). Configurable via `OPENAI_API_KEY` + `OPENAI_MODEL`. |

---

## What Gets Removed

| File | Action |
|---|---|
| `src/app/board/page.tsx` | **Delete** — replaced by `/governance` |
| `src/app/actions/epoch.ts` | **Rewrite** (~400→~100 lines) — keep `ensureEpoch`, `checkEpochTransition`, `getCurrentEpoch`, `getTreasuryBalance`. Delete all voting/tallying/board logic. |
| `src/lib/types.ts` | **Prune** — remove `BoardMember`, `VoteAllocation`, `SubmitVoteResponse`, `BOARD_SIZE`, `VOTING_PERIOD_MS`. Simplify `EpochDocument`. |
| `src/components/NavBar.tsx` | **Modify** — `/board`→`/governance`, "The Committee"→"The Proxy War" |
| `scripts/discover-board.cjs` | **Delete** |
| `scripts/setup-epochs.cjs` | **Archive** |
| `ECONOMIC_EXPERIMENT.md` | **Archive** |
| `IMPLEMENTATION_PLAN.md` (1.2–1.5) | **Archive** |

---

## What Gets Added

| File | Purpose |
|---|---|
| `src/lib/oracle-types.ts` | Oracle input/output types, proposal + comment types |
| `src/app/governance/page.tsx` | Governance page — proposals + voting + discussion |
| `src/components/ProposalCard.tsx` | Single proposal card with vote button + comment thread |
| `src/components/VotingPanel.tsx` | Voting UI — proposal list, tally bars |
| `src/app/actions/governance.ts` | Server actions: vote, comment, fetch proposals, fetch tally |
| `scripts/oracle.cjs` | Cron job: harvest data → LLM → validate → publish proposals |
| `src/lib/solana-verify.ts` | Solana signMessage verification |

---

## PHASE 0 — Database Schema

### File: `src/lib/local-db.ts`

Add to `ensureTables()`, AFTER `pow_challenges`, BEFORE closing backtick:

```sql
-- AI Oracle proposals (3 per epoch + 1 NONE sentinel)
CREATE TABLE IF NOT EXISTS oracle_proposals (
  id TEXT PRIMARY KEY,
  epoch_number INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  is_none_option INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🔥',
  manifesto TEXT NOT NULL DEFAULT '',
  burn_pct INTEGER NOT NULL DEFAULT 0,
  bounty_pct INTEGER NOT NULL DEFAULT 0,
  infra_pct INTEGER NOT NULL DEFAULT 0,
  marketing_pct INTEGER NOT NULL DEFAULT 0,
  oracle_raw_response TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT '',
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oracle_proposals_epoch ON oracle_proposals(epoch_number);

-- Governance votes (one per wallet per epoch)
CREATE TABLE IF NOT EXISTS governance_votes (
  id TEXT PRIMARY KEY,
  epoch_number INTEGER NOT NULL,
  proposal_id TEXT NOT NULL REFERENCES oracle_proposals(id),
  voter_wallet TEXT NOT NULL,
  voter_user_id TEXT,
  signature TEXT NOT NULL DEFAULT '',
  voted_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_gov_votes_epoch ON governance_votes(epoch_number);
CREATE INDEX IF NOT EXISTS idx_gov_votes_proposal ON governance_votes(proposal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_votes_wallet_epoch ON governance_votes(voter_wallet, epoch_number);

-- Proposal discussion comments (one flat thread per proposal)
CREATE TABLE IF NOT EXISTS proposal_comments (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES oracle_proposals(id),
  author_wallet TEXT NOT NULL,
  author_user_id TEXT,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  text TEXT NOT NULL,
  is_rejected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_comments_proposal ON proposal_comments(proposal_id);
```

Verify: `npm run build` — must compile. Existing features must still work.

---

## PHASE 1 — Types

### File: `src/lib/types.ts`

Remove: `BoardMember`, `VoteAllocation`, `SubmitVoteResponse`, `BOARD_SIZE`, `VOTING_PERIOD_MS`.

Simplify `EpochDocument`: remove `board_members`, `voting_started_at`, `executed_at`, `final_*`, `director_fees`, `hypothesis_winner`. Status becomes `"active" | "voting" | "executed"`.

Keep `getEpochThreshold()` unchanged.

Do NOT remove anything used by `submit.ts`, `MessageFeed.tsx`, `HeroCounter.tsx`, `Leaderboard.tsx`, or `TraitorsLeaderboard.tsx`.

### File: `src/lib/oracle-types.ts` (NEW)

```ts
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
```

Verify: `npm run build`.

---

## PHASE 2 — Signature Verification

### File: `src/lib/solana-verify.ts` (NEW)

```ts
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export function verifyMessageSignature(
  walletAddress: string,
  message: string,
  signatureBase58: string,
): boolean {
  try {
    const pk = new PublicKey(walletAddress);
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signatureBase58);
    return nacl.sign.detached.verify(msgBytes, sigBytes, pk.toBytes());
  } catch { return false; }
}

export function buildVoteMessage(proposalId: string, title: string): string {
  return `I vote for: ${title} (proposal ${proposalId})`;
}
```

---

## PHASE 3 — Governance Server Actions

### File: `src/app/actions/governance.ts` (NEW)

```ts
"use server";

import { getDb } from "../../lib/local-db";
import { getSessionUserId } from "../../lib/session";
import { getUserById } from "../../lib/users";
import { verifyMessageSignature, buildVoteMessage } from "../../lib/solana-verify";
import type { OracleProposalRow, ProposalWithTally, EpochTally } from "../../lib/types";

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
  const proposal = db.prepare(
    "SELECT * FROM oracle_proposals WHERE id = ? AND status = 'active'"
  ).get(proposalId) as OracleProposalRow | undefined;
  if (!proposal) return { success: false, error: "Proposal not found or expired." };

  const expectedMsg = buildVoteMessage(proposalId, proposal.title);
  if (signedMessage !== expectedMsg) return { success: false, error: "Message mismatch." };
  if (!verifyMessageSignature(user.wallet_address, signedMessage, signature))
    return { success: false, error: "Invalid signature." };

  // TODO: Check ≥1 CHOP balance via Solana RPC
  // If < 1 CHOP → return { success: false, error: "Need ≥1 $CHOP to vote." }

  const voteId = `${proposal.epoch_number}_${user.wallet_address}`;
  db.prepare(`
    INSERT INTO governance_votes (id, epoch_number, proposal_id, voter_wallet, voter_user_id, signature, voted_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET proposal_id = excluded.proposal_id, signature = excluded.signature
  `).run(voteId, proposal.epoch_number, proposalId, user.wallet_address, userId, signature, signedMessage, new Date().toISOString());

  return { success: true };
}

export async function fetchActiveProposals(): Promise<ProposalWithTally[]> {
  const db = getDb();
  const proposals = db.prepare(`
    SELECT p.*, COUNT(v.id) as vote_count
    FROM oracle_proposals p
    LEFT JOIN governance_votes v ON v.proposal_id = p.id
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY p.is_none_option ASC, p.created_at ASC
  `).all() as Array<OracleProposalRow & { vote_count: number }>;

  const total = proposals.reduce((s, p) => s + p.vote_count, 0);
  return proposals.map(p => ({
    ...p, vote_count: p.vote_count,
    percentage: total > 0 ? Math.round((p.vote_count / total) * 100) : 0,
  }));
}

export async function fetchEpochTally(): Promise<EpochTally | null> {
  const db = getDb();
  const epoch = db.prepare(
    "SELECT * FROM epochs WHERE status IN ('voting','executed') ORDER BY created_at DESC LIMIT 1"
  ).get() as any;
  if (!epoch) return null;

  const proposals = db.prepare(`
    SELECT p.*, COUNT(v.id) as vote_count
    FROM oracle_proposals p
    LEFT JOIN governance_votes v ON v.proposal_id = p.id
    WHERE p.epoch_number = ?
    GROUP BY p.id ORDER BY p.is_none_option ASC, p.created_at ASC
  `).all(epoch.epoch_number) as Array<OracleProposalRow & { vote_count: number }>;

  const totalVotes = proposals.reduce((s, p) => s + p.vote_count, 0);
  const proposalsWithPct = proposals.map(p => ({
    ...p, vote_count: p.vote_count,
    percentage: totalVotes > 0 ? Math.round((p.vote_count / totalVotes) * 100) : 0,
  }));

  const winner = proposalsWithPct.find(p => p.status === "won") ?? null;
  const noneOption = proposalsWithPct.find(p => p.is_none_option === 1);

  const noneWinCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM oracle_proposals
    WHERE epoch_number = ? AND is_none_option = 1 AND status = 'won'
  `).get(epoch.epoch_number) as { cnt: number };

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
  const row = db.prepare(
    "SELECT proposal_id FROM governance_votes WHERE epoch_number = ? AND voter_wallet = ?"
  ).get(epochNumber, user.wallet_address) as { proposal_id: string } | undefined;
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

  // TODO: Check ≥1 CHOP balance

  const db = getDb();

  // Verify proposal exists and is active
  const proposal = db.prepare(
    "SELECT id FROM oracle_proposals WHERE id = ? AND status = 'active'"
  ).get(proposalId) as any;
  if (!proposal) return { success: false, error: "Proposal not found or voting closed." };

  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return { success: false, error: "Comment cannot be empty." };

  // OpenAI moderation check — reject if flagged
  const isFlagged = await checkModeration(trimmed);
  if (isFlagged) return { success: false, error: "Comment rejected by moderation." };

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO proposal_comments (id, proposal_id, author_wallet, author_user_id, author_name, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, proposalId, user.wallet_address, userId, user.display_name || user.username, trimmed, new Date().toISOString());

  return { success: true };
}

export async function fetchProposalComments(proposalId: string): Promise<ProposalComment[]> {
  const db = getDb();
  return db.prepare(`
    SELECT id, proposal_id, author_wallet, author_name, text, created_at
    FROM proposal_comments
    WHERE proposal_id = ? AND is_rejected = 0
    ORDER BY created_at ASC
  `).all(proposalId) as ProposalComment[];
}```

Verify: `npm run build`.

---

## PHASE 4 — Epoch Rewrite

### File: `src/app/actions/epoch.ts`

**Keep:** `ensureEpoch()`, `checkEpochTransition()`, `getCurrentEpoch()`, `getTreasuryBalance()`, `docToSummary()`.

**Delete:** `submitVote()`, `tallyEpoch()`, `executeEpochAllocation()`, `isBoardMember()`, `fetchEpochVotes()`, `fetchEpochHistory()`, `countUniqueSenders()`.

**Modify `checkEpochTransition()`:** When threshold crossed, set status to `"voting"`. The Oracle cron picks up epochs with status `"voting"` that have no active proposals.

**Add:**

```ts
export async function finalizeEpoch(epochNumber: number): Promise<void> {
  const db = getDb();
  const counts = db.prepare(`
    SELECT proposal_id, COUNT(*) as cnt FROM governance_votes
    WHERE epoch_number = ? GROUP BY proposal_id ORDER BY cnt DESC
  `).all(epochNumber) as Array<{ proposal_id: string; cnt: number }>;

  if (counts.length === 0) {
    // No votes — default allocation
    applyDefault(epochNumber);
    return;
  }

  const winnerId = counts[0].proposal_id;
  const winner = db.prepare("SELECT * FROM oracle_proposals WHERE id = ?").get(winnerId) as any;

  if (winner?.is_none_option) {
    const noneWins = /* count previous NONE wins for this epoch */;
    db.prepare("UPDATE oracle_proposals SET status='won', resolved_at=? WHERE id=?").run(new Date().toISOString(), winnerId);

    if (noneWins >= 3) {
      applyDefault(epochNumber);
    } else {
      // Expire old proposals so Oracle regenerates
      db.prepare("UPDATE oracle_proposals SET status='expired' WHERE epoch_number=? AND status='active'").run(epochNumber);
    }
    return;
  }

  // A real plan won
  db.prepare("UPDATE oracle_proposals SET status='won', resolved_at=? WHERE id=?").run(new Date().toISOString(), winnerId);
  db.prepare("UPDATE oracle_proposals SET status='lost' WHERE epoch_number=? AND id!=? AND status='active'").run(epochNumber, winnerId);
  // Mark epoch executed
}
```

Verify: `npm run build`. Message submission still works.

---

## PHASE 5 — AI Oracle Script

### File: `scripts/oracle.cjs` (NEW)

**Trigger:** Cron every 5 minutes. Picks up epochs with `status = "voting"` that have no active `oracle_proposals`.

**Flow:**
1. Query epoch + determine attempt_number
2. If attempt >= 3 and NONE already won 3 times → skip (Oracle fired)
3. Gather `OracleInput` (treasury, messages, market data, previous results)
4. Call Gemini API with system prompt → parse `OracleOutput` JSON
5. Validate: exactly 3 plans, each sums to 100%
6. Insert 4 rows: 3 plans + 1 NONE sentinel (`is_none_option = 1`)
7. If LLM fails → insert 3 static defaults + NONE

**System prompt:**

```
You are the $CHOP Anarchist Oracle. You govern the treasury of $CHOP,
a dark-humor meme coin on Solana. Each epoch, you propose 3 competing
allocation plans. The community votes, and the winning plan executes.

RULES:
- Output ONLY valid JSON matching the schema below.
- Each plan: burn_pct + bounty_pct + infra_pct + marketing_pct = 100.
- Plans must be DISTINCT — 3 genuinely different philosophies.
- Plans must be theatrical, spiteful, and on-brand for FuckYouElon.
- You see ONLY the structured data below. No user messages.
- If this is attempt 2+: the community rejected your previous plans.
  Think differently. Adjust your strategy.
- If you reach attempt 3 and fail again, you will be FIRED permanently.

MARKETING CALIBRATION (for the manifesto field):
- Marketing budget under $100: propose tweet bounties, meme contests, small tips
- Marketing budget $100–$1,000: propose community grants, content creator bounties
- Marketing budget $1,000–$10,000: propose billboards, event sponsorships, PR stunts
- Marketing budget $10,000+: propose real-world actions, legal funds, charity donations
- NEVER propose spending more than the marketing allocation is worth in USD.
- If the treasury is tiny, propose guerilla actions — not Super Bowl ads.
- The marketing allocation can be directed at a specific wallet, cause, or bounty.
  Describe the target and purpose in the manifesto.

NAMING STYLE:
You are a revolutionary AI managing a seized treasury on a spam-ridden
website with a guillotine. The community is arguing over what to do with
the money. Your plan names should sound like one of:

- Revolutionary committees: SCORCHED EARTH COMMITTEE, PEOPLE'S DISTRIBUTION
  FRONT, CENTRAL BURN BUREAU, MINISTRY OF SPITE
- Guillotine humor: BLADE ACCELERATIONISTS, THE SHARPENING FUND,
  NECK INSURANCE DENIED, THE DROP ZONE
- Late-stage capitalist parody: HOSTILE TAKEOVER, CREATIVE DESTRUCTION LLC,
  THE EMERALD MINE RECLAMATION FUND, QUARTERLY BURN REPORT
- Meme populism: BURN IT ALL, PAY THE PEOPLE, THE KETAMINE BUDGET,
  MAKE THEM LOOK, SEND THE TWEET

The names should make someone laugh. Zero tech jargon. Zero sysadmin
references. Accessible to anyone who hates billionaires.

Schema:
{
  "plans": [
    {
      "title": "SCORCHED EARTH COMMITTEE",
      "emoji": "🔥",
      "manifesto": "The only honest redistribution is destruction. Every token burned is a middle finger to the market. The $320 marketing budget goes to whoever makes the most viral anti-billionaire meme this week.",
      "burn_pct": 70,
      "bounty_pct": 10,
      "infra_pct": 10,
      "marketing_pct": 10
    },
    {
      "title": "THE KETAMINE BUDGET",
      "emoji": "💀",
      "manifesto": "Pay the hunters. Someone out there deserves this money more than a dead billionaire's blockchain does. 55% to bounties. 15% of the $960 bounty pool goes to whoever exposes the worst CEO behavior this month.",
      "burn_pct": 15,
      "bounty_pct": 55,
      "infra_pct": 15,
      "marketing_pct": 15
    },
    {
      "title": "PROPAGANDA MINISTRY",
      "emoji": "🏛️",
      "manifesto": "The revolution dies in silence. 50% into marketing — billboards, memes, stunts. Make them look. The $1,600 marketing allocation funds a real-world billboard in a major city. Whoever designs it gets 5,000 CHOP.",
      "burn_pct": 10,
      "bounty_pct": 15,
      "infra_pct": 25,
      "marketing_pct": 50
    }
  ]
}
```

**Gemini API call:**

```js
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\nDATA:\n" + JSON.stringify(input) }] }],
      generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
    }),
  }
);
```

**Validation:**

```js
function validate(output) {
  if (!output.plans || output.plans.length !== 3) throw new Error("Need 3 plans");
  for (const p of output.plans) {
    const sum = p.burn_pct + p.bounty_pct + p.infra_pct + p.marketing_pct;
    if (sum !== 100) throw new Error(`Plan "${p.title}" sums to ${sum}, not 100`);
    if (!p.title || !p.emoji || !p.manifesto) throw new Error("Missing fields");
    for (const k of ["burn_pct","bounty_pct","infra_pct","marketing_pct"])
      if (p[k] < 0 || p[k] > 100) throw new Error("Out of range");
  }
}
```

**NONE sentinel:**

```js
{
  id: crypto.randomUUID(),
  epoch_number: epoch.epoch_number,
  attempt_number: attemptNumber,
  is_none_option: 1,
  title: "NONE OF THESE",
  emoji: "❌",
  manifesto: "Reject all plans. Force the Oracle to try again. 3 rejections = Oracle fired.",
  burn_pct: 0, bounty_pct: 0, infra_pct: 0, marketing_pct: 0,
  oracle_raw_response: "",
  status: "active",
  created_at: new Date().toISOString(),
}
```

Verify: `node scripts/oracle.cjs --dry-run` outputs valid JSON without writing.

---

## PHASE 6 — Frontend

### File: `src/app/governance/page.tsx` (NEW)

Single column, retro terminal style.

**Sections (top to bottom):**
1. **Header:** "THE ORACLE SPEAKS" + epoch number + attempt counter
2. **Status line:** Normal / Regenerating / Fired
3. **Proposal cards** (3–4): emoji + title, manifesto, percentage bars, live count, [VOTE] button. Winner gets gold border + badge. NONE gets red border.
4. **Results bar:** horizontal stacked bar chart
5. **My vote:** "YOU VOTED FOR: 🔥 SCORCHED EARTH COMMITTEE"

**States:** Loading, no-active-epoch ("THE BLADE AWAITS."), oracle-thinking, voting-open, voting-closed (plan won: gold border + "WINNER"), NONE-won ("THE COMMITTEE MUST TRY AGAIN"), oracle-fired (skull + "THE ORACLE HAS BEEN EXECUTED").

### File: `src/components/ProposalCard.tsx` (NEW)

```tsx
interface ProposalCardProps {
  proposal: ProposalWithTally;
  isWinner: boolean;
  isNone: boolean;
  hasVoted: boolean;
  isMyVote: boolean;
  onVote: (proposalId: string) => void;
  isWalletConnected: boolean;
  hasEnoughChop: boolean;
}
```

### File: `src/components/VotingPanel.tsx` (NEW)

```tsx
interface VotingPanelProps {
  proposals: ProposalWithTally[];
  tally: EpochTally | null;
  myVote: string | null;
  onVote: (proposalId: string, signature: string, signedMessage: string) => Promise<void>;
  isWalletConnected: boolean;
  hasEnoughChop: boolean;
  oracleFired: boolean;
  isLoading: boolean;
}
```

**Vote flow:** Click [VOTE] → `signMessage("I vote for: SCORCHED EARTH COMMITTEE (proposal abc-123)")` → zero gas → server verifies → tally updates.

### File: `src/components/NavBar.tsx`

```tsx
// Before:
const isBoard = pathname === "/board";
<Link href="/board" ...>The Committee</Link>

// After:
const isGovernance = pathname === "/governance";
<Link href="/governance" ...>The Proxy War</Link>
```

Verify: `npm run dev`, navigate to `/governance`, everything renders.

---

## PHASE 7 — Blind Executioner Workflow

Manual. Documented in `docs/executioner-workflow.md`.

1. `finalizeEpoch()` runs → winner determined
2. Executioner calculates exact CHOP amounts from winner's percentages
3. Executioner **pre-publishes** transaction plan on site:
   ```
   ⚠️ EXECUTION PENDING — VERIFY
   Epoch 4 — SCORCHED EARTH COMMITTEE won (312 of 646 votes)
   Burn: 7,000 CHOP → 1111...1111
   Bounty: 1,500 CHOP → treasury
   Infra: 1,500 CHOP → dev wallet
   [EXECUTING IN 60 MINUTES]
   ```
4. 60-min community verification window
5. Executioner signs + broadcasts Solana transfers
6. Tx signatures published on site

---

## PHASE 8 — Cleanup

```bash
mv ECONOMIC_EXPERIMENT.md ECONOMIC_EXPERIMENT_V1.md
mv IMPLEMENTATION_PLAN.md IMPLEMENTATION_PLAN_V1.md
rm scripts/discover-board.cjs
mkdir -p scripts/archive && mv scripts/setup-epochs.cjs scripts/archive/
rm src/app/board/page.tsx
```

Smoke test: homepage, messages, leaderboard, governance page, oracle script, vote flow, NONE→regenerate, 3xNONE→fired.

---

## Environment Variables

```bash
OPENAI_API_KEY=               # OpenAI API key (Oracle + moderation)
OPENAI_MODEL=gpt-4o-mini      # Oracle model
EPOCH_MESSAGE_THRESHOLD=1000  # Base threshold (scales 1.5x)
EXECUTIONER_PREPUBLISH_MINUTES=60
EXECUTIONER_WALLET_ADDRESS=   # Public dev wallet
```

---

## Dependencies

| Feature | Uses |
|---|---|
| Vote signatures | `@solana/web3.js`, `tweetnacl`, `bs58` — already installed |
| AI Oracle | `fetch` (native Node 18+) |
| Cron | System crontab or PM2 |

**No new npm packages.**

---

## Migration Path

```
Phase 0 → DB schema (2 new tables)
Phase 1 → Types (prune old, add oracle types)
Phase 2 → Signature verification utility
Phase 3 → Governance server actions
Phase 4 → Epoch rewrite
Phase 5 → AI Oracle script
Phase 6 → Frontend (/governance, ProposalCard, VotingPanel, NavBar)
Phase 7 → Blind Executioner workflow docs
Phase 8 → Cleanup
```

Each phase independently testable.

---

## Summary: Old Trajectory vs Phase 21

| Old (Scrapped) | New (Phase 21) |
|---|---|
| Anchor smart contract (Rust) | No smart contracts |
| Treasury PDA | Manual transfers + pre-publish |
| Squads multisig (4-of-7) | Single dev wallet + 60-min review |
| Board of 7 whales, 5 sliders | 3 AI plans, plurality vote |
| Director fees, alignment tricks, 4 hypotheses | AI Oracle generates competing proposals |
| On-chain vote execution (CPI) | Gasless `signMessage` |
| `discover-board.cjs` | Deleted |
| ~900 lines voting/tallying/board code | ~400 lines governance + oracle |
| Complex delegation to human proxies | Direct vote. Add delegation later. |
| 1 proposal, binary OBEY/REJECT | 3 plans + NONE, plurality wins |
| 3 allocation parameters (burn/bounty/infra) | 4 parameters (burn/bounty/infra/marketing) |
| No proposal discussion | Flat comment threads per proposal, frozen on resolution |
