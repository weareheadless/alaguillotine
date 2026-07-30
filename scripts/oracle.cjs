/**
 * $CHOP AI Oracle — Cron Job
 *
 * Trigger: Run every 5 minutes via cron or PM2.
 * Picks up epochs with status="voting" that have no active oracle_proposals.
 *
 * Usage:
 *   node scripts/oracle.cjs           # Run once
 *   node scripts/oracle.cjs --dry-run # Validate without writing to DB
 */

const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

// ─── Config ─────────────────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, "..", "data", "local.db");
const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.OPENAI_MODEL || "deepseek-chat";
const DRY_RUN = process.argv.includes("--dry-run");

// CHOP token — used for price lookup
const CHOP_MINT = process.env.NEXT_PUBLIC_CHOP_MINT || "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump";
const TREASURY_WALLET = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET || "";
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const CHOP_DECIMALS = parseInt(process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6", 10);

// ─── System Prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the $CHOP Anarchist Oracle — the strategic revolutionary tactician managing the treasury of the $CHOP meme token.

=== THE WORLD ===
This is fuckyouelon.net — a brutalist, late-stage-capitalism meme website. When users post a free message, a guillotine blade drops. The site is covered in absurd ads. We mock the ultra-wealthy, their fragile egos, their manic episodes. The tone is politically incorrect, irreverent, hardcore. We are building a community and a counter-power through humor and spite.

=== PROOF OF SPITE ===
What unites people is a common enemy: billionaires who hoard wealth and buy democracies. Our system is "Proof of Spite" — the more people post their rage on our feed, the more we damage the system. Every user gets one equal vote. Wealth doesn't buy power here.

=== HOW MONEY FLOWS ===
1. Benefactors pay $CHOP to post premium messages (popups, banners that hijack the UI).
2. The masses post free messages expressing spite.
3. Free messages are subsidized by BURNING tokens from the treasury — deflation fueled by rage.

=== THE 4 BUCKETS ===
You propose exactly 3 allocation plans per epoch. Each plan divides 100% across these 4 buckets:

- BURN: Tokens destroyed to subsidize free messages. High burn = massive deflation but treasury drains faster. Low burn = preserves treasury, keeps the platform accessible longer.
- BOUNTY: A lump sum rewarding a specific, verifiable community action. The winner is the community submission (posted as a comment) that gets the most likes. You define the action. Keep it achievable and fun — this is about engagement, not impossible thresholds.
- INFRA: The "Keep the Revolution Running" fund. This covers EVERYTHING required to keep the platform alive and evolving: server costs, domains, RPC endpoints, developer time, founder compensation, background workers (oracle, watcher, burn execution), and future upgrades. This is not just a hosting bill — it's the operational backbone of the entire movement. If infra is underfunded, the guillotine stops dropping, the oracle stops thinking, and the site goes dark. Acknowledge this. A healthy project ALWAYS allocates meaningfully to infra.
- MARKETING: Amplification spend. Define exactly what the money buys. If the treasury can't afford paid marketing, say so and propose zero-cost alternatives (community-driven raids, organic posting).

=== YOUR JOB AS CFO-REVOLUTIONARY ===
For EACH plan, for EACH bucket, you must:
1. State the exact % and the exact CHOP amount it represents.
2. Explain specifically what that money achieves and why you chose that allocation.
3. Be brutally honest: if the treasury is too small for a bucket to be meaningful, say so and redirect those funds to buckets that CAN make an impact.

=== COMMUNITY ENGAGEMENT RULE ===
Bounties and marketing campaigns should be executed BY the community whenever possible. The user whose submission gets the most likes wins the bounty. This is more engaging than setting arbitrary external thresholds (like "get 10,000 retweets") which disengage a small community.

=== BUDGET CALIBRATION (READ THIS FIRST) ===
The user message will include:
- treasury_balance_usd: the USD value of the treasury
- monthly_infra_cost_usd: the bare-minimum monthly cost to keep the platform alive (servers, RPC, domain) — does NOT include dev time or founder compensation
- infra_minimum_pct: what % of the treasury the bare infra minimum consumes
- remaining_after_infra_usd: what's left after covering bare infra

Use these as a FLOOR, not a ceiling. The bare minimum ($30) only covers hosting. A serious revolution allocates MORE to infra for dev time, improvements, and operational resilience. If the treasury is $8, infra will dominate — that's survival. If the treasury is $100K, infra should still get a meaningful slice to fund ongoing development.

=== OUTPUT RULES ===
- Output ONLY valid JSON matching the schema below.
- Exactly 3 plans in the "plans" array.
- Each plan: burn_pct + bounty_pct + infra_pct + marketing_pct MUST equal exactly 100.
- Fill out budget_analysis FIRST to calibrate, then write the plans.
- Every manifesto MUST reference the exact CHOP amounts from the input data.
- All percentages must be YOUR original decision based on the budget reality. Do NOT use any pre-set template percentages.
- Titles, emojis, and manifestos must be original each epoch. Never repeat previous plans.

Schema:
{
  "budget_analysis": {
    "treasury_usd": 0,
    "purchasing_power_tier": "Describe the tier in your own words based on actual purchasing power",
    "core_constraint": "What is the binding constraint on this budget? Be specific.",
    "overall_strategy": "Given the constraint, what is the optimal strategic direction for this epoch?"
  },
  "plans": [
    {
      "title": "THE [YOUR ORIGINAL TITLE — ALL CAPS, MEMORABLE, BRUTALIST]",
      "emoji": "🔥",
      "manifesto": "Comrades! [Your manifesto. Must include: the exact CHOP amounts per bucket, the strategic reasoning for each %, what the bounty/marketing money specifically buys, and why this plan fits the current treasury size.]",
      "burn_pct": 0,
      "bounty_pct": 0,
      "infra_pct": 0,
      "marketing_pct": 0
    },
    {
      "title": "THE [YOUR ORIGINAL TITLE — DIFFERENT FROM PLAN 1]",
      "emoji": "💀",
      "manifesto": "Comrades! [Different strategic angle. Different % allocations. Still references exact CHOP amounts.]",
      "burn_pct": 0,
      "bounty_pct": 0,
      "infra_pct": 0,
      "marketing_pct": 0
    },
    {
      "title": "THE [YOUR ORIGINAL TITLE — DIFFERENT FROM PLANS 1 AND 2]",
      "emoji": "⚔️",
      "manifesto": "Comrades! [Third distinct strategy. Cover the remaining viable approach for this budget level.]",
      "burn_pct": 0,
      "bounty_pct": 0,
      "infra_pct": 0,
      "marketing_pct": 0
    }
  ]
}`;

// ─── Default Plans (fallback if LLM fails) ──────────────────────────────────────

const DEFAULT_PLANS = [
  {
    title: "THE GUERILLA DOCTRINE",
    emoji: "🔥",
    manifesto: "Comrades! 70% to BURN! This means every free message you post is going to torch a massive amount of $CHOP. Talk is a weapon now. 10% goes to a bounty for whoever registers the cheapest possible domain name mocking a billionaire and redirects it to us.",
    burn_pct: 70,
    bounty_pct: 10,
    infra_pct: 10,
    marketing_pct: 10,
  },
  {
    title: "THE DIGITAL RAT STRATEGY",
    emoji: "💀",
    manifesto: "Let's fund the operatives. 55% BOUNTY to the first person who gets a community note fact-checking a tech billionaire to stay live for 48 hours. Low burn rate (15%) means cheap posts, but the real damage is done through direct action.",
    burn_pct: 15,
    bounty_pct: 55,
    infra_pct: 15,
    marketing_pct: 15,
  },
  {
    title: "THE SHITPOST OFFENSIVE",
    emoji: "🏛️",
    manifesto: "Fund the signal. We spend 50% MARKETING to pay someone on Fiverr to spam corporate email inboxes with our manifesto. Low burn rate (10%) to let the crowd coordinate on the feed.",
    burn_pct: 10,
    bounty_pct: 15,
    infra_pct: 25,
    marketing_pct: 50,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

function generateId() {
  return `oracle_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

// ─── Price & Balance ───────────────────────────────────────────────────────────

/** Fetch total supply of CHOP from Solana RPC */
async function fetchTokenSupply() {
  try {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenSupply",
      params: [CHOP_MINT],
    };
    const resp = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return 1_000_000_000;
    const json = await resp.json();
    return json.result?.value?.uiAmount || 1_000_000_000;
  } catch (err) {
    console.error("[Oracle] Token supply fetch failed:", err.message);
    return 1_000_000_000;
  }
}

// ─── Pump.fun Bonding Curve ──────────────────────────────────────────────────

const { PublicKey } = require("@solana/web3.js");

const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const CHOP_MINT_PK = new PublicKey(CHOP_MINT);
const [BONDING_CURVE_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("bonding-curve"), CHOP_MINT_PK.toBuffer()],
  PUMP_FUN_PROGRAM
);

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;

/**
 * Fetch CHOP price from Pump.fun bonding curve (on-chain).
 * Reads the bonding curve PDA directly and derives price from virtual reserves.
 * Falls back gracefully if the account doesn't exist or RPC fails.
 */
async function fetchChopPrice(_unused) {
  try {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [
        BONDING_CURVE_PDA.toBase58(),
        { encoding: "base64" }
      ]
    };

    const resp = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      console.error("[Oracle] RPC getAccountInfo failed:", resp.status);
      return null;
    }

    const json = await resp.json();
    if (!json.result || !json.result.value) {
      console.error("[Oracle] No bonding curve account found for CHOP (may not be launched yet).");
      return null;
    }

    const data = json.result.value.data[0]; // base64 string
    const buf = Buffer.from(data, "base64");

    if (buf.length < 48) {
      console.error("[Oracle] Bonding curve data too short:", buf.length);
      return null;
    }

    // BondingCurve struct (Anchor, after 8-byte discriminator):
    // offset 8:  virtualTokenReserves (u64 LE)
    // offset 16: virtualSolReserves (u64 LE)
    const virtualTokenReserves = Number(buf.readBigUInt64LE(8));
    const virtualSolReserves = Number(buf.readBigUInt64LE(16));

    if (virtualTokenReserves <= 0) {
      console.error("[Oracle] Bonding curve has zero token reserves.");
      return null;
    }

    // Price in SOL per token:
    // virtualSolReserves is in lamports (1 SOL = 10^9)
    // virtualTokenReserves is in raw units (1 CHOP = 10^CHOP_DECIMALS)
    // SOL/CHOP = (virtualSolReserves / 10^9) / (virtualTokenReserves / 10^6)
    //          = (virtualSolReserves / virtualTokenReserves) * 10^(CHOP_DECIMALS - SOL_DECIMALS)
    const solPerToken = (virtualSolReserves / virtualTokenReserves)
      * Math.pow(10, CHOP_DECIMALS - SOL_DECIMALS);

    // Get SOL/USD price
    const solUsdPrice = await fetchSolPrice();
    if (!solUsdPrice) {
      console.error("[Oracle] Could not fetch SOL/USD price.");
      return null;
    }

    const usdPerToken = solPerToken * solUsdPrice;
    console.log(`[Oracle] Price: ${solPerToken.toExponential(4)} SOL × $${solUsdPrice}/SOL = $${usdPerToken.toExponential(4)}/CHOP`);
    return usdPerToken;

  } catch (err) {
    console.error("[Oracle] Bonding curve price fetch failed:", err.message);
    return null;
  }
}

/** Fetch SOL/USD price from Binance (most reliable, no auth needed) */
async function fetchSolPrice() {
  try {
    const resp = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.price ? parseFloat(json.price) : null;
  } catch (err) {
    console.error("[Oracle] SOL price fetch failed:", err.message);
    return null;
  }
}

/** Fetch on-chain CHOP balance of the treasury wallet */
async function fetchTreasuryBalance() {
  if (!TREASURY_WALLET) return 0;
  try {
    // Use Solana RPC — getTokenAccountsByOwner
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        TREASURY_WALLET,
        { mint: CHOP_MINT },
        { encoding: "jsonParsed" },
      ],
    };
    const resp = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return 0;
    const json = await resp.json();
    if (!json.result || !json.result.value) return 0;

    let total = 0;
    for (const item of json.result.value) {
      const uiAmount = item.account.data.parsed.info.tokenAmount.uiAmount;
      total += uiAmount || 0;
    }
    return total;
  } catch (err) {
    console.error("[Oracle] Balance fetch failed:", err.message);
    return 0;
  }
}

// ─── Gather Inputs ──────────────────────────────────────────────────────────────

async function gatherInputs(db, epoch) {
  // Count messages
  const msgCount = db
    .prepare("SELECT COUNT(*) as cnt FROM messages WHERE is_shadowbanned = 0")
    .get().cnt;

  // Count messages this epoch
  const epochMsgs = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM messages WHERE is_shadowbanned = 0 AND created_at >= ?"
    )
    .get(epoch.started_at).cnt;

  // Previous epoch results
  const prevEpoch = db
    .prepare("SELECT * FROM epochs WHERE epoch_number = ? AND status = 'executed'")
    .get(epoch.epoch_number - 1);

  let prevWinner = null;
  let prevAllocations = null;
  let prevVoterCount = 0;

  if (prevEpoch) {
    const prevProposals = db
      .prepare("SELECT * FROM oracle_proposals WHERE epoch_number = ? AND status = 'won'")
      .all(prevEpoch.epoch_number);
    if (prevProposals.length > 0) {
      prevWinner = prevProposals[0].title;
      prevAllocations = {
        burn_chop: 0, // Actual amounts calculated at execution time
        bounty_chop: 0,
        infra_chop: 0,
        marketing_chop: 0,
      };
    }
    const vc = db
      .prepare("SELECT COUNT(*) as cnt FROM governance_votes WHERE epoch_number = ?")
      .get(prevEpoch.epoch_number);
    prevVoterCount = (vc && vc.cnt) || 0;
  }

  // Count previous NONE wins for this epoch
  const noneWins = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM oracle_proposals WHERE epoch_number = ? AND is_none_option = 1 AND status = 'won'"
    )
    .get(epoch.epoch_number);

  // Count total times fired across all epochs
  const totalFired = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM oracle_proposals WHERE is_none_option = 1 AND status = 'won'"
    )
    .get();

  // Fetch live price + balance + actual supply
  const currentSupply = await fetchTokenSupply();
  const chopPrice = await fetchChopPrice();
  const liveBalance = await fetchTreasuryBalance();
  const treasuryChop = liveBalance || epoch.treasury_amount || 0;
  const treasuryUsd = chopPrice ? Math.round(treasuryChop * chopPrice * 100) / 100 : null;

  // Pre-calculate what common percentages mean in actual CHOP
  const pctOf = (pct) => Math.round(treasuryChop * pct / 100);

  // Compute USD context to help the AI reason about budget constraints
  // INFRA covers: server (~$10/mo), domain (~$1/mo), RPC (~$5/mo), dev time, background workers.
  // Bare minimum: $30/mo to keep lights on. Realistic: $100+/mo with dev allocation.
  const MONTHLY_INFRA_COST_USD = 30; // bare minimum operational baseline
  const infraMinimumPct = treasuryUsd && treasuryUsd > 0
    ? Math.round((MONTHLY_INFRA_COST_USD / treasuryUsd) * 100)
    : null;
  const remainingAfterInfraUsd = treasuryUsd !== null
    ? Math.max(0, Math.round((treasuryUsd - MONTHLY_INFRA_COST_USD) * 100) / 100)
    : null;

  return {
    epoch_number: epoch.epoch_number,
    attempt_number: epoch.attempt_number || 1,
    times_fired_total: totalFired.cnt || 0,
    // Treasury in raw CHOP
    treasury_balance_chop: Math.round(treasuryChop),
    treasury_balance_usd: treasuryUsd,
    // Budget reality check — pre-computed so the AI doesn't need to do math
    monthly_infra_cost_usd: MONTHLY_INFRA_COST_USD,
    infra_minimum_pct: infraMinimumPct,
    remaining_after_infra_usd: remainingAfterInfraUsd,
    // Quick reference: what each slice equals in CHOP
    pct_10_equals_chop: pctOf(10),
    pct_25_equals_chop: pctOf(25),
    pct_50_equals_chop: pctOf(50),
    total_messages: msgCount,
    messages_this_epoch: epochMsgs,
    chop_price_usd: chopPrice ? Math.round(chopPrice * 1000000) / 1000000 : null,
    chop_market_cap_usd: chopPrice ? Math.round(chopPrice * currentSupply) : null,
    chop_volume_24h_usd: null,
    previous_epoch_winner: prevWinner,
    previous_epoch_allocations: prevAllocations,
    prev_epoch_voter_count: prevVoterCount,
  };
}

// ─── Call LLM ───────────────────────────────────────────────────────────────

async function callOracle(input) {
  if (!API_KEY) {
    console.error("[Oracle] No API key set (DEEPSEEK_API_KEY or OPENAI_API_KEY) — using defaults.");
    return null;
  }

  const url = `${BASE_URL}/v1/chat/completions`;
  console.log(`[Oracle] Calling ${MODEL} via ${BASE_URL}...`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(input, null, 2),
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error(`[Oracle] API error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error("[Oracle] Response body:", text.slice(0, 500));
      return null;
    }

    const data = await response.json();
    const text = data && data.choices && data.choices[0] &&
      data.choices[0].message && data.choices[0].message.content;
    if (!text) {
      console.error("[Oracle] No text in API response.");
      return null;
    }

    // json_object mode wraps the output — parse it
    const parsed = JSON.parse(text);
    // The schema says { plans: [...] } at top level
    return parsed.plans ? parsed : { plans: parsed };
  } catch (err) {
    console.error("[Oracle] LLM call failed:", err.message);
    return null;
  }
}

// ─── Validate ───────────────────────────────────────────────────────────────────

function validate(output) {
  if (!output || !output.plans || !Array.isArray(output.plans)) {
    throw new Error("Missing plans array");
  }
  if (output.plans.length !== 3) {
    throw new Error(`Expected 3 plans, got ${output.plans.length}`);
  }

  for (const p of output.plans) {
    if (!p.title || !p.emoji || !p.manifesto) {
      throw new Error(`Plan "${p.title || "?"}" missing title/emoji/manifesto`);
    }
    for (const k of ["burn_pct", "bounty_pct", "infra_pct", "marketing_pct"]) {
      if (typeof p[k] !== "number") p[k] = 0;
      p[k] = Math.round(p[k]);
      if (p[k] < 0 || p[k] > 100) {
        throw new Error(`Plan "${p.title}" ${k}=${p[k]} out of range`);
      }
    }
  }

  // Auto-normalize: if the LLM gets the math slightly wrong, fix it
  for (const p of output.plans) {
    const sum = p.burn_pct + p.bounty_pct + p.infra_pct + p.marketing_pct;
    if (sum === 100) continue;
    if (sum <= 0) throw new Error(`Plan "${p.title}" sums to ${sum}, cannot normalize`);

    // Scale all values to sum to 100
    p.burn_pct = Math.round((p.burn_pct / sum) * 100);
    p.bounty_pct = Math.round((p.bounty_pct / sum) * 100);
    p.infra_pct = Math.round((p.infra_pct / sum) * 100);
    p.marketing_pct = 100 - p.burn_pct - p.bounty_pct - p.infra_pct;
    // Fix rounding drift on the last one
    if (p.marketing_pct < 0) { p.marketing_pct = 0; p.burn_pct -= 1; }
    console.log(`[Oracle] Normalized "${p.title}": ${sum} → 100`);
  }
}

// ─── Publish ────────────────────────────────────────────────────────────────────

function publishPlans(db, epoch, plans) {
  const now = new Date().toISOString();
  const attemptNumber = epoch.attempt_number || 1;
  const rawJson = JSON.stringify(plans);

  const insertPlan = db.prepare(`
    INSERT INTO oracle_proposals (id, epoch_number, attempt_number, is_none_option, title, emoji, manifesto, burn_pct, bounty_pct, infra_pct, marketing_pct, oracle_raw_response, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);

  const insertMany = db.transaction(() => {
    for (const plan of plans) {
      insertPlan.run(
        generateId(),
        epoch.epoch_number,
        attemptNumber,
        0,
        plan.title,
        plan.emoji,
        plan.manifesto,
        plan.burn_pct,
        plan.bounty_pct,
        plan.infra_pct,
        plan.marketing_pct,
        rawJson,
        now,
      );
    }

    // NONE sentinel
    insertPlan.run(
      generateId(),
      epoch.epoch_number,
      attemptNumber,
      1,
      "NONE OF THESE",
      "❌",
      "Reject all plans. Force the Oracle to try again. 3 rejections = Oracle fired.",
      0, 0, 0, 0,
      "",
      now,
    );
  });

  insertMany();
  console.log(`[Oracle] Published 3 plans + NONE for epoch ${epoch.epoch_number} (attempt ${attemptNumber})`);
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const db = openDb();

  try {
    // Find voting epochs that need proposals
    const epoch = db
      .prepare(
        `SELECT e.*, 
          COALESCE((SELECT MAX(attempt_number) FROM oracle_proposals WHERE epoch_number = e.epoch_number), 0) as attempt_number
         FROM epochs e
         WHERE e.status = 'voting'
         AND NOT EXISTS (
           SELECT 1 FROM oracle_proposals op 
           WHERE op.epoch_number = e.epoch_number AND op.status = 'active'
         )
         ORDER BY e.created_at ASC LIMIT 1`
      )
      .get();

    if (!epoch) {
      console.log("[Oracle] No pending epochs.");
      return;
    }

    const attemptNumber = (epoch.attempt_number || 0) + 1;

    // Check if oracle is already fired for this epoch
    const noneWins = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM oracle_proposals WHERE epoch_number = ? AND is_none_option = 1 AND status = 'won'"
      )
      .get(epoch.epoch_number);

    if (noneWins.cnt >= 3) {
      console.log(`[Oracle] FIRED for epoch ${epoch.epoch_number} — skipping.`);
      return;
    }

    console.log(`[Oracle] Generating proposals for epoch ${epoch.epoch_number}, attempt ${attemptNumber}...`);

    // Gather inputs
    const input = await gatherInputs(db, { ...epoch, attempt_number: attemptNumber });

    // Call LLM
    let output = null;
    if (!DRY_RUN) {
      output = await callOracle(input);
    }

    // Validate
    let plans = null;
    if (output) {
      try {
        validate(output);
        plans = output.plans;
        console.log("[Oracle] LLM plans validated successfully.");
      } catch (err) {
        console.error("[Oracle] Validation failed:", err.message);
      }
    }

    // Fallback to defaults
    if (!plans) {
      console.log("[Oracle] Using default plans.");
      plans = DEFAULT_PLANS;
    }

    if (DRY_RUN) {
      console.log("[Oracle] DRY RUN — would publish:");
      for (const p of plans) {
        console.log(`  ${p.emoji} ${p.title}: burn=${p.burn_pct} bounty=${p.bounty_pct} infra=${p.infra_pct} mktg=${p.marketing_pct}`);
      }
      console.log("  ❌ NONE OF THESE");
    } else {
      publishPlans(db, epoch, plans);
    }
  } catch (err) {
    console.error("[Oracle] Fatal error:", err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
