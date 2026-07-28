# The $CHOP Protocol — An Economic Experiment

## Plain-English Summary of the Whole Thing

---

## What This Actually Is

This is not a company. It is not a DAO. It is not a meme coin with a roadmap to nowhere. This is an **economic experiment** that happens to look like a meme coin, hosted on a website where you can yell at billionaires.

The website (fuckyouelon.net) is the *laboratory*. The $CHOP token is the *instrument*. The Board of Class Traitors is the *subject*. The data is the *results*.

---

## The Existing Machine (What's Already Built)

Right now the site works like this:

- Anyone can post a **free message** after logging in with Google. The system burns 1 $CHOP from the treasury to cover it — a small deflationary pinch funded by the pot.
- Anyone can post a **paid message** by connecting a Solana wallet and sending $CHOP. That money goes to the **treasury**, not to a burn address. The treasury is a real on-chain pot of money that everyone can see.
- The **guillotine counter** ticks up with every message. When it hits the threshold (500,690 messages), the blade drops and the site enters a new era.

So the current system already distinguishes between:
- **Burn address** (`11111...1111`) — money that is destroyed forever, used to subsidize free users.
- **Treasury** — money that sits in a pot, waiting to be used.

What's missing is: who decides how the treasury gets used? Right now, nobody. It just burns for free messages until it's empty. That's not an experiment — that's a countdown.

---

## The Evolution: What We're Adding

### 1. The Board of Class Traitors

The **top 7 $CHOP holders** automatically become board members. Being on the board is not a trophy — it's a job. They appear on a "Board of Directors" page with their wallet, their holdings, and their voting record. Everyone can see who they are and what they voted for. There's no hiding.

**Why 7?** Odd number, no tie votes. Big enough for diversity, small enough to actually decide something. The top holders change over time as people buy and sell, so the board evolves.

### 2. Epochs — The Rhythm of the Experiment

Time is divided into **epochs**. One epoch = 50,000 messages. At the end of every epoch, three things happen:

1. The board votes.
2. The vote is executed (money moves accordingly).
3. Everyone can see the results.

This gives us a *time series* — a sequence of decisions we can watch and analyze. Without a time series, there's nothing to study.

### 3. The Board Vote — Four Sliders, One Choice

Each epoch, every board member votes on four numbers. These four numbers **must add up to 100%** — they're dividing a pie, not making independent choices:

| Slider | What It Controls | Who It Benefits |
|---|---|---|
| **Burn Rate** | What fraction of the treasury gets destroyed forever | $CHOP holders (deflation → price up) |
| **Lottery Fund Rate** | What fraction gets paid out to *one random participant* | The working class (active users) |
| **Dev Fund Rate** | What fraction pays the founder to keep the site running | The founder (keeps the lights on) |
| **Board Dividend Rate** | What fraction gets paid out to the board members | The board (the ruling class) |

The remaining treasury (whatever wasn't burned, put in the lottery, paid to dev, or paid to the board) stays in the pot for the next epoch. It's never empty unless the board votes it empty.

**The tension is the whole point.** The board can't maximize all four. If they vote high burn, the treasury shrinks, there's no lottery, the dev fund goes to zero, and they get no dividend. If they vote high board dividend, they get rich today, but the treasury drains, free messages stop, and the site dies. They have to *choose*, and the choice reveals their priorities.

### 4. The Alignment Trick — Why Greed Might Behave Like Generosity

This is the most important part. Board members get paid a **director's fee** every epoch. The fee is **not** based on how much $CHOP they hold. It's based on **how many new people sent a message that epoch.**

So a board member's income depends on the site growing. Trace the reasoning:

- "I want my fee to be big."
- "To get a big fee, I need lots of new people sending messages."
- "To get lots of new people, free messages need to keep working (poor users need to be able to participate)."
- "For free messages to keep working, the treasury needs $CHOP in it."
- "So I should *not* vote to burn everything, because that drains the treasury and kills the user growth that feeds me."
- "And I should vote a reasonable dev fund, because if the site breaks, users stop coming and my fee drops to zero."

**The greedy thing and the generous thing become the same thing.** The whales end up funding the poor users and paying the founder — not out of charity, but because the system makes it personally profitable for them to do so.

Whether they actually figure this out, or whether they panic and vote to pump their bag this epoch and let tomorrow take care of itself — **that is the experiment.** We don't know the answer. We're watching to find out.

### 5. The Founder's Role — No Vote, No Veto, No Theft

The founder (you) put in $10. That $10 sits in the system like everyone else's $10 — earning the same pro-rata redistribution when the board votes to pay out.

The founder:
- **Cannot vote.** Not on the board. No governance tokens. No special class of shares.
- **Cannot set their own pay.** The board votes the dev fund. The founder lives with the result.
- **Cannot access the treasury.** No "admin withdraw" button. No backdoor. The treasury belongs to the system.
- **Cannot steal.** Even if tempted, the strike mechanism (below) is the only lever. No rug possible.

The founder controls exactly one thing: **the ballot** — the menu of options the board chooses between each epoch. That's "agenda control," and it's real power, but it's deniable and it's documented. Every VC-backed founder in history has exactly this power and pretends they don't. This one admits it.

### 6. The Strike — The Founder's One Real Lever

If the board votes the dev fund to zero for three epochs in a row, the founder is starving. At that point, the founder can **strike**:

- The site stops accepting new messages.
- Epochs stop advancing.
- Board members' fees drop to zero (no new senders = no fee).
- **No money moves.** The treasury is untouched.

The board's income now depends on ending the strike. The only way to end the strike is to vote a dev fund that makes it worth the founder's while to unpause. The board negotiates with labor, because they have to.

**Rules of the strike:**
- After unpausing, the founder cannot strike again for 2 epochs (no shakedowns).
- During the strike, the founder's own $CHOP earns no redistribution (withholding labor means withholding benefit too).
- The strike is public — a banner on the site says "The site is on strike" with a link to the current epoch and the dev fund vote that triggered it.

This is the real critique of capitalism in the system. Capital can strike by withholding investment. Labor can strike by withholding work. The strike makes the relationship visible: the board needs the founder to keep the machine running, and the founder needs the board to keep from starving. They're dependent on each other, and the mechanism forces them to behave like it.

### 7. Dev Fund Protection — 3-Epoch Trailing Average

If the board votes the dev fund to zero this epoch out of spite or a mistake, the founder doesn't immediately starve. The dev fund pays out based on the **average of the last 3 epochs**, not just the current one.

So the board has to vote zero *three times in a row* to actually cut the founder off. By the second zero vote, the site is visibly degrading, new senders are dropping, and the board's fee is shrinking. They have time to reconsider before the damage is permanent.

This is a **slow dial, not a knife-edge.** Real governance works this way. Experiments need this to produce clean data instead of just conflict.

---

## The Three Hypotheses (Written Before Any Votes Happen)

Before the first epoch runs, we write down what we *think* will happen. This is what makes it an experiment instead of a game.

**H1 — The Plutocracy Hypothesis**  
The board will vote high burn rate and low redistribution, because whales act like whales. The dev fund will be minimal. The treasury will shrink. Free users will stop being able to post. The fee tied to new senders won't stop this because board members will be too busy pumping their bags to notice the connection until it's too late.

*If this happens: capitalism won. The alignment trick failed. Greed is too stupid to be useful.*

**H2 — The Class Traitor Hypothesis**  
The board will converge on moderate burn, moderate redistribution, and a reasonable dev fund. The alignment trick works — they figure out that keeping the system healthy for everyone maximizes their own fee. They act like enlightened capitalists.

*If this happens: the mechanism works. Greed routed properly looks like generosity. The system is stable but not exciting.*

**H3 — The Deadlock Hypothesis**  
The board will fail to reach consensus. Votes will be split. The treasury will accumulate without being allocated. The system will drift toward doing nothing — hoarding cash instead of making choices, exactly like real-world corporate boards.

*If this happens: the experiment reveals that boards prefer inaction to action, which is the most damning result of all.*

The site will show which hypothesis is currently winning on the Board page, updated every epoch. The whitepaper will update with the running results.

---

## The Data the Experiment Produces

After every epoch, the following is recorded publicly:

- **Epoch number** and which messages it covered.
- **Board composition** — who was on the board, their holdings, their delegated weight.
- **Vote tallies** — each member's burn/redistribution/dev vote, anonymized by wallet.
- **Outcome** — the actual allocation that executed.
- **Director fees earned** — what each board member got paid.
- **Unique senders** — the metric that determined their fees.
- **Founder's dev fund** — what actually paid out (3-epoch trailing avg).
- **Strike events** — if the founder struck, when and why.

This is published as a public dataset after enough epochs accumulate. Anyone can download it and test their own theories against it. The experiment is *reproducible* — or at least as reproducible as human behavior ever is.

---

## What Doesn't Change

The core of the site remains the same:

- Free messages (with Google auth).
- Paid messages (with Solana wallet).
- The guillotine counter and blade animation.
- The message feed (High Rollers + Recent).
- The shadowban system (OpenAI moderation, silent flagging).

The board mechanic *layers on top* of this without removing anything. The board votes determine how the treasury flows, but they don't affect whether your message posts or where it appears. The only visible change is a new **Board page** showing the directors and their votes, plus a small **epoch counter** on the site header.

---

## The Whitepaper Update

The whitepaper gets one new section — the **Experimental Protocol** — which states:

1. The hypotheses (H1, H2, H3) written before any data exists.
2. The mechanism description (board, epochs, vote, fee, strike).
3. The founder's role and limitations (no vote, no veto, no theft; strike only).
4. The data that will be collected and published.
5. The pre-registration timestamp (when this version of the whitepaper was published, frozen on-chain as a notarized record that the hypotheses came first).

This last point is critical for credibility. The hypotheses must be *time-stamped before* the results. Otherwise anyone can say "I knew it all along." The on-chain timestamp proves we didn't.

---

## What Matters and What Doesn't

**What matters:** The data. The time series. The honest documentation of what the board actually did. A result that surprises us is *more* valuable than a result that confirms what we expected.

**What doesn't matter:** The token price. The TVL. The number of users. The memes. These are inputs, not outputs. A successful experiment produces good data regardless of whether anyone shows up to play.

**What breaks the experiment:** Founder override. Founder theft. Undisclosed admin keys. Changing the rules after votes happen. Not publishing the data. Any of these turns it from an experiment into a game with a pre-written ending. The whole point is that we don't know the ending. If we did, it'd be a lecture, not an experiment.

---

## Summary — The One-Page Version

| Concept | Plain Meaning |
|---|---|
| **Treasury** | The pot of $CHOP that everyone pays into. Visible, on-chain, untouchable by the founder. |
| **Burn** | $CHOP destroyed forever. Makes remaining coins scarcer. Funded from treasury. |
| **Board** | Top 7 $CHOP holders. They decide how the treasury is allocated. |
| **Epoch** | One voting cycle = 50,000 messages. Produces one row of data. |
| **Vote** | Board splits the treasury four ways: burn / lottery / dev fund / board dividend. Must sum to 100%. |
| **Fee** | Board gets paid based on *new unique senders*, not token price. Aligns greed with growth. |
| **Dev Fund** | The founder's salary. Set by the board, paid on a 3-epoch trailing average. |
| **Strike** | The founder's only power: pause the site if starved. Mutually assured inconvenience. |
| **Hypotheses** | Three written predictions, timestamped before any data exists. |
| **Data** | Everything published. Anyone can analyze it. Reproducible. |

---

*This document is the living manual for the $CHOP Protocol economic experiment. It evolves as the experiment runs, but the core constraints — founder cannot steal, board votes everything, hypotheses precede results — are permanent. If those change, it's no longer an experiment, and this document will say so plainly.*
