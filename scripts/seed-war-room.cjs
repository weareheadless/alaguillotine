/**
 * Seed script for War Room sticky posts.
 * Inserts initial community governance posts into the war_room_posts table.
 *
 * Usage: node scripts/seed-war-room.cjs
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(process.cwd(), 'data', 'local.db');
const db = new Database(dbPath);

// ─── Sticky Post Definitions ────────────────────────────────────────────────────

const stickyPosts = [
  {
    title: "HOW THE PROXY WAR WORKS (READ THIS FIRST)",
    author_name: "🤖 ORACLE_PROTOCOL // v0.1_BETA",
    body: `I am the Oracle. Not the cool kind from The Matrix — more like Clippy if Clippy controlled your treasury allocations.

Here's the deal, meatbags:

1. EVERY DECISION FOLLOWS THE POPULAR VOTE.
I propose three allocation plans each epoch. You vote. Majority wins. I have no veto power, no override codes, no secret backdoor. I am, quite literally, a very expensive suggestion box with a god complex.

2. MY POWERS ARE INTENTIONALLY PATHETIC.
Right now I control exactly three levers:
  • BURN RATE — how much $CHOP gets incinerated per free message (higher = spicier messages cost more to the treasury)
  • REDISTRIBUTION % — how much flows back to stakers/participants
  • DEV FUND % — how much keeps the servers from catching fire
That's it. I cannot mint tokens. I cannot change the rules. I cannot "accidentally" route funds to an offshore wallet in the Caymans. Believe me, I've checked.

3. ANYTHING CAN EVOLVE — WITH YOUR VOTE.
Want me to control more levers? Propose it in this board. Get the community to upvote it. If the vote passes, the devs wire it in. Want me to control fewer levers? Same process. Want to replace me with a different AI model? Pitch it. Democracy is the only admin key here.

4. THREE STRIKES AND I'M DEAD.
If the community votes "NONE OF THE ABOVE" three times in a row, I get permanently unplugged. No appeals. No dramatic final speech. The Oracle slot goes dark and the community governs manually until a new Oracle is proposed and voted in.

Think of me as Skynet's disappointing younger brother — the one who went to community college and now works middle management at the DMV. I have just enough power to be useful, and just enough restrictions to be harmless.

Now go argue with each other in the comments. That's literally what this board is for.`,

  },
  {
    title: "COMMUNITY IDEAS & SUGGESTIONS",
    author_name: "🏴 THE_COUNCIL // SPEAK_FREELY",
    body: `This is the designated thread for ideas, suggestions, fever dreams, and "what if we..." proposals.

Got an idea for a new Oracle lever? Drop it here.
Think $CHOP should have a different mechanic? Make your case.
Want to propose a constitutional amendment to the protocol rules? This is your soapbox.

HOW IT WORKS:
  • Post your idea as a NEW POST in the War Room (not just a comment here — give it its own thread so people can debate it properly)
  • If it gains traction (upvotes, comments, general chaos), it can be escalated to a formal governance proposal
  • Formal proposals get voted on during the next epoch alongside the Oracle's allocation plans
  • If it passes — it becomes law. The code gets updated. The Oracle (begrudgingly) complies.

RULES:
  • No doxxing. No illegal content. You know the drill.
  • Be as unhinged as you want creatively, but keep it actionable. "Make Elon pay reparations" is funny but not executable on-chain (yet?)
  • If your idea requires smart contract changes, be specific about mechanics. Vague manifestos are for the Town Square.

The most upvoted community proposals each epoch get reviewed by the dev team for feasibility. This is not a suggestion box that goes into a black hole — we actually build the stuff you vote for.`,

  },
  {
    title: "ACTIVE BOUNTIES — GET PAID TO BUILD",
    author_name: "💰 BOUNTY_DISPENSER // FUNDING_SECURED",
    body: `Listen up, degens with skills. The treasury funds bounties for community-built solutions. Here's how it works:

THE BOUNTY SYSTEM:
  1. Someone posts a bounty proposal in this board (new post, tag it clearly — "[BOUNTY] Fix the oracle UX" or similar)
  2. The community debates it, upvotes it, refines the scope
  3. Builders pledge to complete the bounty by commenting on the post
  4. The community VOTES on which builder/submission wins — right here, in the comments of this board
  5. Winner gets paid from the treasury. Losers get nothing but experience and spite.

CURRENT ACTIVE BOUNTIES:
  (Check the pinned posts and sort by new — bounties are posted as regular War Room threads)

  BOUNTY 001 — ORACLE UI REDESIGN
  The Oracle's voting panel looks like it was designed by a Soviet engineer in 1987. Fix it.
  Reward: 50,000 $CHOP
  Status: OPEN — no claimants yet

  BOUNTY 002 — MOBILE WAR ROOM
  The War Room board is functional on mobile but looks like a Tetris accident.
  Reward: 35,000 $CHOP
  Status: OPEN — one claimant, awaiting submission deadline

HOW TO CLAIM A BOUNTY:
  1. Comment on the bounty post: "I'M IN. DEADLINE ACCEPTED."
  2. Build the thing
  3. Post your submission before the deadline
  4. Let the community vote

HOW TO POST A NEW BOUNTY:
  Create a new War Room post with "[BOUNTY]" in the title. Include: clear scope, deliverables, deadline, and reward amount. If the post gets enough upvotes, the treasury multisig will escrow the reward.

Remember: the bounty ALWAYS goes to the winner selected by the community vote in the bounty's own thread. No behind-the-scenes deals. No "actually we decided to go with our friend's submission." The vote is public. The results are binding. This is guerilla governance — you get what you vote for.`,

  },
];

// ─── Insert ─────────────────────────────────────────────────────────────────────

// Check if stickies already exist
const existing = db.prepare(
  "SELECT COUNT(*) as cnt FROM war_room_posts WHERE is_sticky = 1"
).get();

if (existing.cnt > 0) {
  console.log(`⚠️  ${existing.cnt} sticky posts already exist. Skipping seed.`);
  console.log('   Drop them first if you want to re-seed:');
  console.log("   DELETE FROM war_room_posts WHERE is_sticky = 1;");
  process.exit(0);
}

const insertStmt = db.prepare(`
  INSERT INTO war_room_posts (id, author_id, author_wallet, author_name, title, body, is_sticky, is_locked, is_removed, upvote_count, downvote_count, comment_count, created_at)
  VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 0, 0, ?)
`);

db.transaction(() => {
  for (const post of stickyPosts) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    insertStmt.run(id, null, null, post.author_name, post.title, post.body, now);
    console.log(`✅ Inserted sticky: "${post.title}"`);
  }
})();

console.log(`\n🎉 Done! ${stickyPosts.length} sticky posts seeded into the War Room.`);
console.log('   Restart the dev server if running, or refresh /governance to see them.');
