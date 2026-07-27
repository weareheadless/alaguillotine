# $CHOP Protocol — Implementation Plan

> **Status:** Funding Secured.  
> **Target:** Convert the satirical whitepaper into actionable dev tasks.  
> **Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + Appwrite + Solana Web3

---

## Current State Audit

| Whitepaper Feature | Status | Notes |
|---|---|---|
| Guillotine Board (message feed) | ✅ Done | `MessageFeed.tsx` — two-column (High Rollers + Recent) |
| Guillotine Counter / Blade Animation | ✅ Done | `HeroCounter.tsx` — CSS blade, progress bar, debug panel |
| Free message posting (auth) | ✅ Done | `submit.ts` — Appwrite auth via JWT |
| Paid message posting (Solana) | ✅ Done | `submit.ts` — Solana payment flow |
| Shadowban (OpenAI moderation) | ✅ Done | `submit.ts` — flags hate/harassment/violence |
| Single target (Elon Musk) | ✅ Done | Hardcoded in UI |
| Whitepaper page | ✅ Partial | Section 1 rendered; 8 more sections to go |
| $CHOP ERC-20 token | ❌ Not started | No smart contract |
| Token burn for messages (Utility #1) | ❌ Not started | Messages currently free/paid, not burn-based |
| Decapitation Queue / Voting (Utility #2) | ❌ Not started | No multi-target, no voting |
| Candidate Nomination (Utility #3) | ❌ Not started | No nomination flow |
| Automatic target cycling | ❌ Not started | Blade drops reset to same target |
| Dynamic thresholds (net-worth oracle) | ❌ Not started | Static `EXECUTION_THRESHOLD = 500,690` |
| Heads in a Jar NFTs | ❌ Not started | |
| DAO governance (vaporware) | ❌ Not started | |

---

## Phase 1: Core Setup & Single-Target Guillotine (Week 1–2)

**Goal:** Ship the minimum viable guillotine — single target, token burns for messages. No voting yet.

### 1.1 — $CHOP Token: Pump.fun Fair Launch

**No smart contract to write.** $CHOP launched on pump.fun as an SPL token.

- [x] Fixed supply: **1,000,000,000** $CHOP
- [x] 100% circulating — no team allocation, no pre-mine, no vesting
- [x] Deployer bought in on the bonding curve like everyone else
- [ ] Obtain the token mint address from pump.fun for use in the Guillotine program
- [ ] Set up a proper Solana wallet (keypair) for the deployer/admin

> **No bag.** The deployer has exactly as much $CHOP as they bought on the market. No 50.069% "Guillotine Fund." No "Submarine R&D Fund." This is the most honest tokenomics in crypto and it took four whitepaper drafts to realize it.

### 1.2 — Smart Contract: GuillotineV1 (Solana Program)

**New file:** `contracts/guillotine/src/lib.rs` (Anchor framework)

- [ ] Initialize with:
  - `current_target_id`: `"elon_musk"` (hardcoded)
  - `current_threshold`: `1_000_000 * 10^9` (1M tokens in lamports)
  - `current_counter`: `0`
  - `DEAD_ADDRESS`: a known burn address
- [ ] Function `burn_for_message(amount: u64, message: String)`:
  - Transfer `amount` $CHOP from user to dead address
  - Increment `current_counter` by `amount`
  - Emit `MessageBurned` event
  - If `current_counter >= current_threshold`, call `drop_blade()`
- [ ] Internal `drop_blade()`:
  - Emit `TargetExecuted` event
  - Reset `current_counter = 0`
  - Phase 1: reset target to "elon_musk" (no queue yet)
- [ ] Events (logged to transaction):
  - `MessageBurned { sender, amount, message, timestamp }`
  - `TargetExecuted { target_id, total_burned, timestamp }`

### 1.3 — Frontend: Token Balance & Burn UI

**Modify:** `src/components/SubmitForm.tsx`

- [ ] Add a new tab/mode: **"Burn $CHOP to Post"**
  - Show user's $CHOP balance (from wallet)
  - Amount input: how many $CHOP to burn
  - Message input: text (same as existing)
  - Submit: call `burn_for_message` on the program
  - Requires prior approval (token `approve` → program address)
- [ ] Keep existing free (auth) and paid (SOL) modes as fallback/demo

**Modify:** `src/components/MessageFeed.tsx`

- [ ] Add `amount_burned` column to each message card
- [ ] Sort by `amount_burned` descending (top burners at top)
- [ ] Show burn amount with 🔥 icon: "🔥 1,337 $CHOP"

**Modify:** `src/lib/types.ts`

- [ ] Add fields: `amount_burned?: number`, `tx_signature?: string`

### 1.4 — Frontend: Live Counter from On-Chain Data

**Modify:** `src/components/HeroCounter.tsx`

- [ ] Replace Appwrite `total` count with on-chain `current_counter` read
- [ ] Poll every 10 seconds (same interval, different source)
- [ ] Keep Appwrite count as fallback for non-token messages

### 1.5 — Whitepaper Page Completion

**Modify:** `src/app/whitepaper/page.tsx`

- [ ] Render Sections 2–10 from the whitepaper
- [ ] Add sticky table of contents sidebar
- [ ] Add "Download PDF" button (generate from markdown)

---

## Phase 1.5: The Treasury Burn Engine — Paid Messages Fund Free Burns

**Goal:** When users pay $CHOP to post a message, their tokens don't go straight to the dead address. They route to a Treasury PDA. The Treasury burns a fixed amount for the payer's own message, then saves the remainder to burn for free (auth-based) users. Every paid post is both a flex AND a donation to the revolution.

**The Pitch:** *"You pay to scream. Your tokens fund the guillotine. Free users' messages burn YOUR $CHOP. You're not just posting — you're a patron of the arts. The art is guillotining billionaires."*

### 1.5.1 — Smart Contract: Treasury-Backed Burn

**Modify GuillotineV1 `burn_for_message`:**

Instead of transferring directly to `0x0...dEaD`, route tokens through a Treasury PDA:

- [ ] **New state on Guillotine program:**
  ```rust
  treasury: u64,                  // total $CHOP held in Treasury PDA
  burn_per_message: u64,         // how much to burn per message (e.g., 10 tokens)
  total_treasury_burned: u64,    // lifetime tracking
  ```

- [ ] **Modified `burn_for_message(amount: u64, message: String)`:**
  - Transfer `amount` $CHOP from user to Treasury PDA (NOT dead address)
  - If `amount >= burn_per_message`:
    - Transfer `burn_per_message` from Treasury to dead address (actual burn)
    - `treasury += amount - burn_per_message` (remainder stays in Treasury)
    - Increment `current_counter` by `burn_per_message`
  - If `amount < burn_per_message`:
    - Burn entire `amount` (too small to fund Treasury, just burn it all)
    - Increment `current_counter` by `amount`
  - Emit `MessageBurned` as before
  - Check threshold → `drop_blade()` if met

- [ ] **`burn_from_treasury_for_free_message(message_hash: String)`** (called by backend)
  - Require `treasury >= burn_per_message`
  - Transfer `burn_per_message` from Treasury to dead address
  - Decrement `treasury` by `burn_per_message`
  - Increment `current_counter` by `burn_per_message`
  - Increment `total_treasury_burned`
  - Emit `TreasuryMessageBurned { message_hash, amount: burn_per_message }`
  - Check threshold → `drop_blade()` if met

- [ ] **Admin functions:**
  - `set_burn_per_message(new_amount: u64)`

- [ ] **New events:**
  - `TreasuryMessageBurned { message_hash, amount }`
  - `TreasuryFunded { payer, amount_added, new_balance }` (emitted in burn_for_message when tokens remain)

### 1.5.2 — Backend: Treasury Burn Relay

**Modify:** `src/app/actions/submit.ts`

- [ ] After a free message passes moderation and is inserted into Appwrite:
  - Check on-chain `treasury` balance
  - If `treasury >= burn_per_message`, call `burn_from_treasury_for_free_message`
  - If treasury is empty:
    - Message still posts — the burn just doesn't happen
    - Log: "Treasury depleted — message posted without burn. Next paid message will refuel."

### 1.5.3 — Frontend: Treasury Status

**Modify:** `src/components/HeroCounter.tsx`

- [ ] Show treasury status near the guillotine:
  - **Funded:** "🔥 Treasury: X,XXX $CHOP — funding {N} more free messages"
  - **Low:** "🪫 Treasury running low: only {N} free messages remaining"
  - **Empty:** "💀 Treasury empty. Free messages post but don't burn. Pay to refuel."
  - **Never funded:** "🐳 No paid messages yet. Be the first — your burn funds everyone."

**Modify:** `src/components/SubmitForm.tsx`

- [ ] On the free message form:
  - Funded: "Your message burns {N} $CHOP from the Treasury (funded by paid users)"
  - Empty: "Free messages don't burn right now. Pay to post and refuel the Treasury."

### 1.5.4 — Frontend: Top Funders Leaderboard

**New component:** `src/components/TreasuryLeaderboard.tsx`

- [ ] "🏆 Founding Execution Sponsors"
- [ ] Ranked by total $CHOP contributed to Treasury (via paid messages)
- [ ] Top funder gets 👑 + "Chief Execution Sponsor" title
- [ ] Empty state: "No one has paid to post yet. History awaits your wallet."

### 1.5.5 — The Economics

| Actor | What They Do | What They Get |
|---|---|---|
| Paid user | Burns 1,000 $CHOP to post | Message high on leaderboard + 10 $CHOP burned for their post + 990 $CHOP funds Treasury |
| Free user | Posts via auth (free) | Message on board + Treasury burns 10 $CHOP on their behalf |
| Token holder | Holds, doesn't post | Every paid message = more Treasury = more burns = supply ↓ = price ↑ |
| Nobody pays | Treasury stays at 0 | Site still works. Free messages just don't burn. The blade waits. |

---

## Phase 2: Voting, Nominations & Perpetual Queue (Week 3–4)

**Goal:** Multi-target support. The guillotine cycles through targets automatically.

### 2.1 — Smart Contract: GuillotineV2

**Upgrade or redeploy** the program with new state:

- [ ] **New state:**
  ```rust
  struct Candidate {
      id: String,          // e.g., "jeff_bezos"
      name: String,        // e.g., "Jeff Bezos"
      vote_tally: u64,
      is_active: bool,
  }
  candidates: Vec<Candidate>
  current_target_id: String
  threshold_map: HashMap<String, u64>
  nomination_cost: u64   // e.g., 1,000 * 10^9
  ```

- [ ] **`nominate_candidate(name: String, amount: u64)`**
  - Require `amount >= nomination_cost`
  - Generate `candidate_id = keccak256(name)`
  - Require candidate not already active
  - Burn `amount` tokens → dead address
  - Add candidate with `vote_tally = amount`
  - Emit `CandidateNominated` + `VoteCast`

- [ ] **`burn_for_spite(amount: u64, message: String, vote_target_id: Option<String>)`**
  - Burn `amount` tokens
  - Increment `current_counter`
  - If `vote_target_id` is Some and valid, increment that candidate's `vote_tally`
  - Emit `MessageBurned` with vote target
  - Emit `VoteCast` if voting
  - Check threshold → `drop_blade()` if met

- [ ] **`drop_blade()` (revised)**
  - Emit `TargetExecuted`
  - Find candidate with highest `vote_tally` among active
  - Set as new `current_target`
  - Mark executed candidate inactive
  - If no candidates, revert to default (Elon)
  - Reset counter
  - Set threshold from `threshold_map` or default
  - Emit `NewTarget`

### 2.2 — Frontend: Decapitation Queue

**New component:** `src/components/DecapitationQueue.tsx`

- [ ] List all active candidates ranked by `vote_tally` descending
- [ ] Each row: rank, name, vote count (🔥 X,XXX $CHOP), "Vote" button
- [ ] Highlight #1 candidate with 👑 icon
- [ ] Empty state: "The queue is empty. Nominate a new head for the block."
- [ ] Animate position changes on new votes

**Modify:** `src/components/SubmitForm.tsx`

- [ ] Add "Vote for Next Target" dropdown/selector
  - Lists all active candidates
  - Default: "No vote (just post)"
  - Burning tokens while voting: tokens count toward both message ranking AND candidate vote tally
- [ ] Add "Nominate New Target" section
  - Name input + fixed burn amount (nomination cost)
  - Burns tokens AND adds candidate to queue
  - Nomination burn counts as first vote

### 2.3 — Frontend: Target Cycling Animation

**Modify:** `src/components/HeroCounter.tsx`

- [ ] On `TargetExecuted` event:
  - Drop blade animation (already exists)
  - Show "severed head" animation
  - After 2s delay: blade rises, new target name fades in
  - Counter resets to 0 with new threshold
- [ ] Show current target name prominently above the guillotine
- [ ] Archive section: "Headless Hall of Fame" — list of executed targets

**Modify:** `src/lib/execution-context.tsx`

- [ ] Add `currentTarget: string`, `currentThreshold: number`
- [ ] Add `setCurrentTarget`, `setCurrentThreshold`
- [ ] Track execution history: `executedTargets: string[]`

### 2.4 — Frontend: Message Board Per-Target

**Modify:** `src/components/MessageFeed.tsx`

- [ ] Filter messages by `target_id` — each target gets its own board
- [ ] Previous targets' messages viewable in archive
- [ ] Tab or dropdown: "Current: Elon Musk ▼" → shows all past targets

**New/Modify DB schema (Appwrite):**

- [ ] Add `target_id` field to messages collection
- [ ] Add `amount_burned` field (nullable, for token-burn messages)
- [ ] Add `vote_target_id` field (nullable)

---

## Phase 3: Dynamic Thresholds — "Net-Worth Oracle" (Week 5)

**Goal:** Different thresholds per target, manually set by admin. Pretense of real-world data.

### 3.1 — Smart Contract: Admin Threshold Control

- [ ] Add `set_threshold(target_id: String, new_threshold: u64)` — admin only
- [ ] Add `set_nomination_cost(new_cost: u64)` — admin only
- [ ] Add `get_threshold(target_id: String) -> u64` — returns custom or default

### 3.2 — Frontend: Target Profile Card

**New component:** `src/components/TargetProfile.tsx`

- [ ] Display for current target:
  - Name, photo (meme image)
  - "Estimated Net Worth: $XXX Billion"
  - "Execution Threshold: X,XXX,XXX $CHOP"
  - "Progress: XX.X%"
- [ ] Net worth data fetched from a simple JSON endpoint on the site itself
  - File: `public/api/net-worths.json`
  - Updated manually by admin (the "oracle")
  - Frontend fetches it and displays as if it's real-time oracle data

### 3.3 — Admin Dashboard (Internal)

**New page:** `src/app/admin/page.tsx` (hidden, no nav link)

- [ ] Set thresholds per target
- [ ] Set nomination cost
- [ ] View all candidates
- [ ] Manual override: force next target (for humor)
- [ ] View execution history
- [ ] Protected by simple password (no auth needed — it's a joke project)

---

## Phase 3.5: The Guillotine Prediction Market — Binary Bets on the Blade (Week 6)

**Goal:** Let users bet $CHOP on one simple question: *"Will the blade drop in [month] [year]?"* — Yes or No. This creates real token demand: people must buy $CHOP to bet, locking tokens in escrow, reducing circulating supply. Winners get more $CHOP. Losers' tokens are partially burned. Every bet is deflationary.

> **⚠️ Investment Thesis:** This is definitively a better investment than the SpaceX IPO, which dropped 50% in its first two weeks of trading. At least here you KNOW you're gambling on a pixelated guillotine. Transparency is our alpha.

**The Pitch:** *"Why just hate for free when you can hate for profit? The Prediction Market lets you bet $CHOP on whether the blade drops this month. Winners take the losers' $CHOP. The house burns 2.5%. Every bet removes tokens from circulation and creates buy pressure. It's prediction markets meets deflationary tokenomics meets the French Revolution."*

### 3.5.1 — Smart Contract: Guillotine Bets (Standalone Solana Program)

**New file:** `contracts/guillotine-bets/src/lib.rs` (Anchor framework)

A separate program. Holds escrowed $CHOP. Settles yes/no. That's the whole thing.

- [ ] **Account structure:**
  ```rust
  struct BetPool {
      pool_id: u64,
      month: u8,                  // 1-12
      year: u16,                  // e.g., 2026
      total_yes_chop: u64,        // total $CHOP bet on YES
      total_no_chop: u64,         // total $CHOP bet on NO
      house_cut_bps: u16,         // 250 = 2.5%
      settled: bool,
      outcome: Option<bool>,      // true = blade dropped, false = didn't
      created_at: i64,
  }

  struct Bet {
      better: Pubkey,
      pool_id: u64,
      amount: u64,                // $CHOP in raw token units
      is_yes: bool,               // true = bet YES (blade drops), false = NO
      claimed: bool,
  }
  ```

- [ ] **`create_pool(month: u8, year: u16)`** — admin only
  - Creates a `BetPool` for the given month/year
  - Emits `PoolCreated { pool_id, month, year }`
  - Only one pool per month/year combo

- [ ] **`place_bet(pool_id: u64, is_yes: bool, amount: u64)`** — user sends $CHOP
  - $CHOP transferred from user's token account to escrow PDA
  - Assign to `total_yes_chop` or `total_no_chop` based on `is_yes`
  - Create `Bet` account
  - Emit `BetPlaced { pool_id, better, amount, is_yes }`

- [ ] **`settle_pool(pool_id: u64, did_drop: bool)`** — admin only, called after month ends OR when blade drops
  - If blade dropped during the month: `did_drop = true`
  - If month ended with no drop: `did_drop = false`
  - Winners = everyone who bet on the correct outcome
  - `winner_pool = (total_pool * (10000 - house_cut_bps)) / 10000`
  - Each winner gets: `winner_pool * (their_bet / total_bet_on_winning_side)`
  - Losers' $CHOP: distributed to winners + 2.5% burned to dead address
  - Mark pool settled, store outcome
  - Emit `PoolSettled { pool_id, did_drop, total_winners, house_cut_burned }`

- [ ] **`claim_winnings(pool_id: u64)`** — winners pull their $CHOP
  - Verify bet was on winning side of settled pool
  - Transfer winner's share of $CHOP from escrow PDA
  - Mark bet as claimed

- [ ] **Events:**
  - `PoolCreated { pool_id, month, year }`
  - `BetPlaced { pool_id, better, amount, is_yes }`
  - `PoolSettled { pool_id, did_drop, total_winners, house_cut_sol }`
  - `WinningsClaimed { pool_id, better, amount }`

### 3.5.2 — Settlement Logic (The Only Complexity)

| Scenario | Resolution | Who Wins |
|---|---|---|
| Blade drops in August 2026 | Pool settles `did_drop = true` | YES bets win |
| August 2026 ends, no drop | Pool settles `did_drop = false` | NO bets win |
| Blade drops Aug 31 at 11:59 PM | Still August. `did_drop = true` | YES bets win |
| Blade drops Sep 1 at 12:01 AM | Too late for August pool. That pool settles `false`. September pool (if created) gets `true`. | August NO wins, September YES wins |

- [ ] Admin manually calls `settle_pool` from admin dashboard
- [ ] Settlement is gated: for `did_drop = true`, must wait for actual `TargetExecuted` event timestamp within the month. For `did_drop = false`, must wait until the month is over.
- [ ] **No auto-settlement** — manual oracle keeps it simple and avoids cross-program invocation complexity

### 3.5.3 — Frontend: Betting Panel

**New component:** `src/components/BettingPanel.tsx`

- [ ] **Current Month Pool card:**
  - "Will the blade drop in August 2026?"
  - Two big buttons: **"YES ✅"** and **"NO ❌"**
  - Shows live odds based on pool balance:
    - "YES: 420,000 $CHOP (67%) · NO: 210,000 $CHOP (33%)"
    - Implied probability: 67% chance of drop
  - Your active bet (if any): "You bet 5,000 $CHOP on YES"
- [ ] **Bet Modal:**
  - $CHOP amount input
  - Estimated payout: "If YES wins, you'll receive ~7,400 $CHOP"
  - "Lock In 🔒" button
- [ ] **Past Pools section:**
  - "July 2026: Blade did NOT drop. 89 NO winners split 320,000 $CHOP. You: —"
  - "June 2026: Blade DROPPED! 42 YES winners split 680,000 $CHOP."
- [ ] **Personal Stats:**
  - "Your record: 2 wins / 5 losses · Net: -12,400 $CHOP 💀" or "Net: +42,000 $CHOP 🤑"

**New component:** `src/components/BettingLeaderboard.tsx`

- [ ] "🎰 Top Degenerates" — ranked by lifetime $CHOP won
- [ ] "💀 Biggest Bagholders" — ranked by lifetime $CHOP lost
- [ ] "📊 Sharpe Ratio of a Guillotine" — a joke metric that's always negative

### 3.5.4 — Frontend: Integration Points

**Modify:** `src/components/HeroCounter.tsx`

- [ ] When blade progress > 50%, show:
  - "📊 Betting pool live: Will it drop in August? YES 420K CHOP / NO 210K CHOP"
  - Link to betting panel

**Modify:** `src/lib/execution-context.tsx`

- [ ] Add `activePoolMonth: string`, `activePoolYesSol: number`, `activePoolNoSol: number`

### 3.5.5 — The UX Flow

```
1. User sees blade at 72%. Banner: "Betting: August drop? YES 420K CHOP / NO 210K CHOP"
2. User clicks YES, stakes 10,000 $CHOP
3. Card updates: "You bet 10,000 $CHOP on YES. Potential payout: ~15,000 $CHOP"
4. Blade drops August 17. Pool settles YES.
5. User claims 15,000 $CHOP → "You won +5,000 $CHOP! 🎉"
6. User immediately bets winnings on September pool
7. Addiction acquired. Token demand increases. Flywheel spins.
```

### 3.5.6 — Economic Flywheel

```
Blade progress visible → People buy $CHOP to bet YES → Pool grows →
  → $CHOP locked in escrow (reduced circulating supply) →
  → More attention → More $CHOP burned → Blade drops sooner →
  → YES bets win → Winners get more $CHOP → Cycle accelerates

OR: Blade doesn't drop → NO bets win → Winners feel smug →
  → They burn $CHOP to taunt YES losers → Blade still advances →
  → Everyone wins (except losers, whose $CHOP gets burned)
```

- [ ] House cut (2.5%) is burned to dead address (more deflation)
- [ ] Betting pools lock $CHOP on-chain → reduced supply → upward price pressure
- [ ] **Unironic value prop:** *"Every bet removes $CHOP from circulation. Every message burns $CHOP. This token has more deflationary mechanisms than most 'serious' DeFi projects. Accidental tokenomics."*

### 3.5.7 — Disclaimer

> *"Betting on whether a cartoon guillotine blade drops on a pixelated billionaire's head within a calendar month is not financial advice. It is financial performance art. Past performance of SpaceX IPO (-50% in 2 weeks) is not indicative of future results, but it IS very funny. The house always wins. The house is a guillotine."*

---

## Phase 4: NFTs & DAO (Vaporware Polish) (Week 7+)

**Goal:** Add features that sound impressive but do almost nothing. Pump the narrative.

### 4.1 — "Heads in a Jar" NFT Gallery

**New page:** `src/app/hall-of-fame/page.tsx`

- [ ] Display executed targets as collectible cards
- [ ] Each card: target name, date executed, total $CHOP burned to kill them
- [ ] "Mint NFT" button (doesn't actually mint — button shows "Coming Q4 2026")
- [ ] Clicking "Mint" triggers confetti animation and a fake "transaction pending" spinner
- [ ] "NFT Revenue funds Submarine R&D Fund" tagline

### 4.2 — Governance Theater

**New page:** `src/app/governance/page.tsx`

- [ ] "CHOP DAO — Governance Portal"
- [ ] List of fake proposals:
  - "Should we increase the nomination cost to 5,000 $CHOP?"
  - "Should we add [celebrity] to the queue?"
  - "Should the blade drop faster?"
- [ ] Each proposal has fake vote counts
- [ ] "Connect Wallet to Vote" button (just connects wallet, voting is "coming soon")
- [ ] "Snapshot vote will be live Q1 2027" badge
- [ ] Page headline: "You Are The Blade™"

### 4.3 — Easter Eggs & Polish

- [ ] "Optimus Grift" page: a guy in a spandex suit (static image), "coming 2030"
- [ ] Random Elon tweet embed that changes on page refresh
- [ ] Sound effect when blade drops (wet thud + crowd cheer)
- [ ] Confetti when threshold is reached
- [ ] "Submarine R&D Fund" counter (starts at $4.20, slowly ticks up)

---

## Phase 5: Polish & Ship (Ongoing)

- [ ] Mobile responsiveness audit
- [ ] Loading states for all on-chain interactions
- [ ] Error handling: insufficient balance, failed transactions
- [ ] Wallet connection UX polish
- [ ] SEO metadata for all pages
- [ ] OG image generation (guillotine with target's head)
- [ ] Share button: "I just burned X $CHOP to execute [target]. The blade drops at Y."

---

## File Manifest — What to Create/Modify

### New Files

| File | Phase | Purpose |
|---|---|---|
| `contracts/chop-token/src/lib.rs` | 1 | SPL token program |
| `contracts/guillotine/src/lib.rs` | 1–2 | Guillotine program (burn, vote, nominate, cycle, treasury) |
| `contracts/guillotine-bets/src/lib.rs` | 3.5 | Betting escrow program (pools, bets, settlement) |
| `src/components/AngerFlywheel.tsx` | — | Whitepaper diagram: anger → money flywheel |
| `src/components/TreasuryLeaderboard.tsx` | 1.5 | Top Treasury funders hall of fame |
| `src/components/DecapitationQueue.tsx` | 2 | Candidate leaderboard with voting |
| `src/components/BettingPanel.tsx` | 3.5 | Betting UI (place bets, view pools, claim winnings) |
| `src/components/BettingLeaderboard.tsx` | 3.5 | Top winners/losers leaderboard |
| `src/components/TargetProfile.tsx` | 3 | Current target info card |
| `src/app/admin/page.tsx` | 3 | Admin dashboard (thresholds, nominations, settle bets) |
| `src/app/hall-of-fame/page.tsx` | 4 | Executed targets gallery |
| `src/app/governance/page.tsx` | 4 | Fake DAO governance page |
| `public/api/net-worths.json` | 3 | "Oracle" data for thresholds |

### Modified Files

| File | Phase | Changes |
|---|---|---|
| `src/components/SubmitForm.tsx` | 1–2 | Token burn mode, vote selector, nomination UI, treasury indicator |
| `src/components/MessageFeed.tsx` | 1–2 | Burn amount display, per-target filtering |
| `src/components/HeroCounter.tsx` | 1–3.5 | On-chain counter, target cycling, treasury status, betting prompts |
| `src/components/DecapitationQueue.tsx` | 2–3.5 | Candidate leaderboard + per-candidate betting odds |
| `src/lib/execution-context.tsx` | 2–3.5 | Target state, execution history, betting pool stats |
| `src/lib/types.ts` | 1–3.5 | New fields for burns, votes, targets, treasury, bets |
| `src/lib/constants.ts` | 2–3.5 | Multi-target thresholds, nomination cost, house cut BPS |
| `src/app/actions/submit.ts` | 1.5 | Treasury burn relay after free message submission |
| `src/app/actions/settle-bets.ts` | 3.5 | Settlement oracle: resolves pools when blade drops |
| `src/app/whitepaper/page.tsx` | 1 | Sections 2–10, TOC |
| `src/app/layout.tsx` | 4 | Navigation links for new pages |
| `src/app/page.tsx` | 2 | Add DecapitationQueue, TargetProfile, TreasuryLeaderboard |

---

## Dependency Graph

```
Phase 1 ───────► Phase 1.5 ───────► Phase 2 ───────► Phase 3 ───────► Phase 3.5 ──────► Phase 4 ──► Phase 5
│                 │                   │                 │               │                  │
├─ SPL token      ├─ Treasury PDA     ├─ GuillotineV2   ├─ Admin page   ├─ Betting escrow  ├─ NFT gallery
├─ GuillotineV1   ├─ Treasury relay   ├─ DecapQueue UI  ├─ net-worth   ├─ BettingPanel     ├─ Governance
├─ Token burn UI  ├─ Whale board      ├─ Target cycling ├─ TargetProfile├─ Settlement oracle├─ Easter eggs
├─ On-chain cnt   ├─ Treasury status  ├─ Nomination UI  └─ set_threshold├─ Betting LB       └─ Sound/confetti
└─ Whitepaper     └─ (needs P1 token) └─ Per-target msgs                └─ (needs P2 cycle
                                           (needs P1.5)                     + P3 thresholds)
```

**Phase 1 can ship independently.** Phase 1.5 requires Phase 1's token + contract. Phase 2 builds on 1.5. Phase 3 is admin tooling. **Phase 3.5 is the first phase that creates real economic gravity** — it needs Phase 2's target cycling AND Phase 3's per-target thresholds to function properly.

> **The Whale Paradox:** Phase 1.5 is technically a dependency for Phase 2 (the contract needs treasury state), but it's also a vaporware feature that may never activate. The contract supports it; the frontend gracefully degrades. This is called "speculative infrastructure" — building rails for a train that may never arrive. Very on-brand.

---

## Success Criteria (per phase)

### Phase 1 ✅
- [ ] $CHOP token deployed and verifiable on-chain
- [ ] User can burn $CHOP to post a message
- [ ] Message board ranks by burn amount
- [ ] Blade drops at threshold, resets counter
- [ ] Full whitepaper renders on `/whitepaper`

### Phase 1.5 ✅
- [ ] `burn_for_message` routes tokens to Treasury PDA (not directly to dead address)
- [ ] Treasury burns `burn_per_message` for the payer's own post, saves remainder
- [ ] Backend relay: free messages trigger `burn_from_treasury_for_free_message`
- [ ] Treasury status visible on frontend (funded/low/empty)
- [ ] Treasury refuels automatically with every paid message
- [ ] TreasuryLeaderboard shows top funders
- [ ] **Key test:** First paid message activates Treasury. Every subsequent free message burns from it. When empty, free messages still post but stop burning.

### Phase 2 ✅
- [ ] Users can nominate new targets by burning tokens
- [ ] Users can vote for queued candidates
- [ ] Blade drop automatically selects highest-voted candidate
- [ ] Target cycles: Elon → Bezos → Zuck → ... → back to Elon if queue empty
- [ ] Per-target message boards with archive

### Phase 3 ✅
- [ ] Admin can set per-target thresholds
- [ ] Target profile shows "net worth" and threshold
- [ ] Admin dashboard functional

### Phase 3.5 ✅
- [ ] Betting escrow contract deployed (yes/no per month, uses $CHOP)
- [ ] Users can place $CHOP bets on "Will it drop in [month] [year]?"
- [ ] Pool displays live odds: YES X CHOP / NO Y CHOP
- [ ] Pool settles correctly: blade drops → YES wins, month ends → NO wins
- [ ] Winners claim proportional $CHOP share, losers' tokens partially burned
- [ ] 2.5% house cut burned to dead address (deflationary)
- [ ] Betting panel shows current pool, past results, personal stats
- [ ] Betting leaderboard shows top winners and biggest losers
- [ ] Admin can create monthly pools and manually settle from dashboard
- [ ] **Key economic test:** Every bet creates $CHOP demand → buy pressure → deflation → cycle

### Phase 4 ✅
- [ ] Hall of Fame gallery shows executed targets
- [ ] Fake governance page with proposals
- [ ] Sound + confetti on blade drop

### Phase 5 ✅
- [ ] Mobile responsive
- [ ] All loading/error states handled
- [ ] Share functionality
- [ ] SEO + OG images

---

*"This roadmap constitutes a legally non-binding expression of intent. Phases may be reordered, renamed, or retroactively declared complete. Funding secured."*
