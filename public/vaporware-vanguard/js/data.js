/* Vaporware Vanguard — content layer.
   Every gameplay element is grounded in the Research Dossier (documented,
   real-world events). The Receipt cites stable sources for each claim. */

'use strict';

// Wealth stat for the Receipt's "while you played, they made $X".
const VW_BILLIONAIRE = { name: "a tech billionaire", netWorthUSD: 400e9 };

// ---------------------------------------------------------------------------
// THE RECEIPT — the documented reality (dossier facts, sober, cited).
// ---------------------------------------------------------------------------
const VW_FACTS = [
  {
    id: "fsd_timeline",
    title: "Autonomy: 'next year', every year (2014–2024)",
    body: "Promised 'complete autonomy in ~2 years' (2015), a coast-to-coast autonomous drive (2016), '1 million robotaxis' (2019), 'full autonomy this year' (2023). FSD remains SAE Level 2 — a driver-assist system requiring a supervised human.",
    url: "https://en.wikipedia.org/wiki/Tesla_Autopilot",
  },
  {
    id: "hw3",
    title: "2026: The hardware you sold can't do it",
    body: "Backtracked on the long-held promise that older 'Hardware 3' vehicles could ever reach unsupervised autonomy — functionally admitting the hardware sold to millions under that premise was insufficient.",
    url: "https://en.wikipedia.org/wiki/Tesla_Autopilot",
  },
  {
    id: "optimus_suit",
    title: "2021: The 'robot' was a human in spandex",
    body: "The Optimus debut was famously a dancer in a robot costume. Of 11 major Optimus promises tracked 2021–2025, one was met on time.",
    url: "https://en.wikipedia.org/wiki/Optimus_(robot)",
  },
  {
    id: "optimus_teleop",
    title: "2024: The 'dexterous' robot was teleoperated",
    body: "Videos of Optimus folding laundry and handling tasks were debunked — journalists confirmed the robots were remotely operated by humans off-camera.",
    url: "https://en.wikipedia.org/wiki/Optimus_(robot)",
  },
  {
    id: "optimus_targets",
    title: "2025–26: 10,000 promised, fewer than 500 built",
    body: "Missed the 10,000-unit production target by over 95%. By early 2026, confirmed zero units were doing 'useful work' outside the factory.",
    url: "https://en.wikipedia.org/wiki/Optimus_(robot)",
  },
  {
    id: "mars_goalposts",
    title: "Mars: 2024, then 2025, then 2029, then 5–7 years",
    body: "Claimed humans on Mars by 2024/2025, tickets at $100,000, a self-sustaining city of 1 million. In early 2026, delayed again and pivoted to 'cities on the Moon within 10 years'.",
    url: "https://en.wikipedia.org/wiki/Elon_Musk",
  },
  {
    id: "starship",
    title: "The engineers' verdict on Starship",
    body: "A 2024 Nature feasibility study and aerospace experts concluded the Starship architecture was unworkable for crewed interplanetary survival under fundamental engineering and radiation constraints.",
    url: "https://en.wikipedia.org/wiki/SpaceX_Starship",
  },
  {
    id: "hyperloop",
    title: "Hyperloop: quietly abandoned",
    body: "The 700+ mph vacuum-tube transit 'revolution' was abandoned without a production system ever existing.",
    url: "https://en.wikipedia.org/wiki/Hyperloop",
  },
  {
    id: "vegas_loop",
    title: "The Vegas Loop: 'the biggest, most absurd transit scam'",
    body: "The flagship became a 50 mph, single-lane tunnel with manually driven cars running at a fraction of the promised capacity. In 2026, transit officials called it a scam.",
    url: "https://en.wikipedia.org/wiki/The_Boring_Company",
  },
  {
    id: "solar_roof",
    title: "Solar Roof: 23/week when 1,000 were promised",
    body: "Missed the 2019 target of 1,000 installations/week by 97.7%. Average cost exceeded $106,000. A $6M class-action for price-gouging preceded its quiet abandonment.",
    url: "https://en.wikipedia.org/wiki/Tesla_Solar_Roof",
  },
  {
    id: "x_acquisition",
    title: "X: a $44B purchase, then a collapse",
    body: "After the 2022 acquisition, content moderation was gutted and thousands of banned accounts reinstated. Major advertisers permanently fled over brand safety.",
    url: "https://en.wikipedia.org/wiki/Acquisition_of_Twitter_by_Elon_Musk",
  },
  {
    id: "x_markdown",
    title: "Q3 2025: Fidelity marks X down 72%",
    body: "Asset managers valued X at roughly $12.5 billion. By 2026 the platform ran at a massive loss — a raw, non-consensual training-data firehose burning tens of millions a day.",
    url: "https://en.wikipedia.org/wiki/Acquisition_of_Twitter_by_Elon_Musk",
  },
  {
    id: "funding_secured",
    title: "2018: 'Funding secured' was fraud",
    body: "The SEC settled after the 'funding secured' tweet — a $40 million fine and a forced step-down as chairman.",
    url: "https://en.wikipedia.org/wiki/Elon_Musk",
  },
  {
    id: "dogecoin",
    title: "2021–23: Dogecoin manipulation lawsuits",
    body: "Multi-billion dollar insider-trading and market-manipulation lawsuits over the meme-coin pumping spanned 2021–2023.",
    url: "https://en.wikipedia.org/wiki/Dogecoin",
  },
  {
    id: "pepfar",
    title: "2025–26: The human toll of the 'efficiency' purge",
    body: "Agency cuts defunded PEPFAR; in reliant nations the sudden withdrawal of antiretrovirals collapsed supply chains. Independent global health trackers linked this to hundreds of thousands of preventable deaths.",
    url: "https://en.wikipedia.org/wiki/President%27s_Emergency_Plan_for_AIDS_Relief",
  },
];

// ---------------------------------------------------------------------------
// CARDS. play(g) -> a line for the log. Tech cards get tick(g, dt).
// ---------------------------------------------------------------------------

const VW_CARDS = {};

function _promise(id, name, icon, tier, desc, opts) {
  VW_CARDS[id] = {
    id, name, icon, type: "promise", tier, desc,
    gain: opts.gain || 0,
    timer: opts.timer || 20,
    outrage: opts.outrage || 6,
    outrageRate: opts.outrageRate || 0.25,
    infinite: !!opts.infinite,
    loopEvery: opts.loopEvery || 8,
    loopLoyalty: opts.loopLoyalty || 2,
    loopGuillotine: opts.loopGuillotine || 1.5,
    pivot: !!opts.pivot,
    capitalLabel: "$" + (opts.gain || 0),
    play(g) {
      g.modCapital(this.gain);
      if (this.pivot) {
        const target = g.nearestTimer();
        if (target) {
          const extra = Math.round(target.total * 0.4) + 8;
          g.replaceTimer(target, extra);
          return `The Pivot: the old deadline is gone. 'Cities on the Moon' is now due in +${extra}s. (+$${this.gain})`;
        }
        const d = this.timer + 15;
        g.startTimer(this.id, d, { label: this.name, late: false });
        return `The Pivot: new horizon. 'Cities on the Moon' — ${d}s. (+$${this.gain})`;
      }
      if (this.infinite) {
        g.startTimer(this.id, this.loopEvery, { label: this.name, infinite: true });
        return `The Infinite Loop is live. It never ships — it only drains loyalty. (+$${this.gain})`;
      }
      g.startTimer(this.id, this.timer, { label: this.name, late: false });
      return `You pitched "${this.name}". Launch due in ${this.timer}s. (+$${this.gain})`;
    },
  };
}

function _distraction(id, name, icon, tier, desc, opts) {
  VW_CARDS[id] = {
    id, name, icon, type: "distraction", tier, desc,
    gain: opts.gain || 0,
    clearOutrage: opts.clearOutrage !== false,
    guillotine: opts.guillotine || 0,
    loyalty: opts.loyalty || 0,
    advertisers: opts.advertisers || 0,        // permanent multiplier change
    baseline: opts.baseline || 0,               // permanent outrage baseline bump
    capitalLabel: opts.gain ? "$" + opts.gain : "FREE",
    play(g) {
      g.modCapital(this.gain);
      if (this.clearOutrage) g.clearOutrage();
      g.modGuillotine(this.guillotine);
      g.modLoyalty(this.loyalty);
      if (this.advertisers) g.modAdvertisers(this.advertisers);
      if (this.baseline) g.modBaseline(this.baseline);
      const bits = [];
      if (this.guillotine) bits.push(`Guillotine ${this.guillotine < 0 ? "-" : "+"}${Math.abs(this.guillotine)}`);
      if (this.loyalty) bits.push(`Loyalty ${this.loyalty < 0 ? "-" : "+"}${Math.abs(this.loyalty)}`);
      if (this.advertisers) bits.push(`advertisers ${this.advertisers < 0 ? "−" : "+"}${Math.abs(Math.round(this.advertisers * 100))}%`);
      if (this.baseline) bits.push("the crowd remembers (baseline up)");
      return `"${this.name}." ${bits.join(", ")}.` + (this.gain ? ` (+$${this.gain})` : "");
    },
  };
}

function _tech(id, name, icon, tier, desc, opts) {
  VW_CARDS[id] = {
    id, name, icon, type: "tech", tier, desc,
    gain: opts.gain || 0,
    banner: opts.banner || "IT WORKS",
    tickCap: opts.tickCap || 0,
    tickDrain: opts.tickDrain || 0,
    tickLoyalty: opts.tickLoyalty || 0,
    advertisers: opts.advertisers || 0,
    capitalLabel: opts.gain ? "$" + opts.gain : "PASSIVE",
    play(g) {
      g.modCapital(this.gain);
      if (this.advertisers) g.modAdvertisers(this.advertisers);
      return `"${this.name}" installed. ${this.banner}.` + (this.gain ? ` (+$${this.gain})` : "");
    },
    tick(g, dt) {
      let cap = this.tickCap * dt;
      if (this.tickDrain) cap -= this.tickDrain * dt;
      if (cap) g.modCapital(cap);
      if (this.tickLoyalty) g.modLoyalty(this.tickLoyalty * dt);
    },
  };
}

// --- Starter deck: low-risk, low-reward -------------------------------------
_promise("p_selfdriving", "Self-Driving Next Year", "🚗", "starter",
  "Pitch full autonomy. Again.", { gain: 16, timer: 26, outrage: 6, outrageRate: 0.25 });
_promise("p_cybercab", "Cybercab, Soon", "🚕", "starter",
  "A robotaxi with no steering wheel. Any day now.", { gain: 22, timer: 34, outrage: 7, outrageRate: 0.3 });
_promise("p_battery", "Revolutionary Battery", "🔋", "starter",
  "A battery that halves the cost of everything. Trust us.", { gain: 12, timer: 22, outrage: 5, outrageRate: 0.2 });
_promise("p_demo", "Robot Waiter Demo", "🤖", "starter",
  "A humanoid that can carry a tray. (A human in a suit is fine.)", { gain: 14, timer: 24, outrage: 5, outrageRate: 0.2 });
_distraction("d_regulators", "Blame the Regulators", "🎯", "starter",
  "It's their fault, actually.", { guillotine: -8, baseline: 1 });
_distraction("d_rival", "Attack a Rival", "🤺", "starter",
  "Fight the other billionaire. Crowd loves it.", { guillotine: -6, loyalty: 3, baseline: 2 });
_distraction("d_meme", "Emergency Meme", "😈", "starter",
  "Post something. Anything.", { guillotine: -4, loyalty: -4 });
_tech("t_hyperloop", "Hyperloop (Concept)", "🌀", "starter",
  "700 mph vacuum tubes. The future. (Also nothing.)", { gain: 10, banner: "THE FUTURE", tickDrain: 0.06 });
_tech("t_boring", "Boring Tunnel Sketch", "🕳️", "starter",
  "A tunnel solves traffic. One lane, manually driven.", { gain: 8, banner: "BIGGER. FASTER.", tickDrain: 0.05 });
_tech("t_solar", "Solar Glass Tiles", "🌞", "starter",
  "A roof that costs more than a roof.", { gain: 12, banner: "BEAUTIFUL", tickDrain: 0.08 });

// --- Draft pool: high-tier chaos --------------------------------------------
_promise("p_loop", "The Infinite Loop", "🚗", "draft",
  "Full Self-Driving. It never ships — it only resets and drains your fandom.",
  { gain: 60, infinite: true, loopEvery: 8, loopLoyalty: 2, loopGuillotine: 1.5 });
_promise("p_robotaxis", "One Million Robotaxis", "🤖", "draft",
  "A million of them. On the road. By next year.", { gain: 55, timer: 30, outrage: 10, outrageRate: 0.5 });
_promise("p_optimus", "10,000 Optimus Units", "🦾", "draft",
  "Factory-ready humanoids. (A human in a suit is fine.)", { gain: 50, timer: 34, outrage: 12, outrageRate: 0.55 });
_promise("p_moon", "Cities on the Moon", "🌙", "draft",
  "Not Mars. The Moon. In 10 years. New promise, same energy.", { gain: 45, timer: 40, outrage: 8, outrageRate: 0.35 });
_promise("p_coast", "Autonomous Coast-to-Coast", "🛣️", "draft",
  "LA to NY, no hands, by the end of next year.", { gain: 48, timer: 32, outrage: 11, outrageRate: 0.5 });
_promise("p_sleep", "Sleep at the Wheel", "😴", "draft",
  "Essentially safe to fall asleep and wake up there.", { gain: 42, timer: 28, outrage: 10, outrageRate: 0.45 });
_promise("p_pivot", "The Pivot", "🌙", "draft",
  "Delete a failing deadline. Promise the Moon instead.", { gain: 10, pivot: true, timer: 20 });
_distraction("d_absolutist", "Free Speech Absolutist", "🗣️", "draft",
  "Unban everyone. Burn the advertiser base.", { guillotine: -12, advertisers: -0.30 });
_distraction("d_publicsquare", "Acquire the Town Square", "📢", "draft",
  "Buy the platform everyone argues on.", { gain: 30, clearOutrage: false, advertisers: -0.25 });
_distraction("d_puppets", "Robot Showcase", "🎭", "draft",
  "A totally convincing robot demo. Nothing behind the curtain.", { gain: 20, guillotine: -8 });
_distraction("d_fight", "Fight a Rival CEO", "🥊", "draft",
  "Cage match with the other guy. Bury the story.", { guillotine: -10, loyalty: 6, baseline: 3 });
_tech("t_square", "Acquire the Public Square", "📰", "draft",
  "Own the town square. Rent-free influence.", { tickCap: 1.5, tickLoyalty: -0.2, banner: "INFLUENCE ++" });
_tech("t_firehose", "Grok Data Firehose", "🔥", "draft",
  "Every post, every DM — fuel for the machine.", { tickCap: 2.5, tickLoyalty: -0.5, advertisers: -0.1, banner: "DATA! DATA!" });
_tech("t_vegas", "Vegas Loop 'Expansion'", "🎰", "draft",
  "More tunnels. Same scam, more concrete.", { gain: 20, tickDrain: 0.25, banner: "EXPANDING" });
_tech("t_solar2", "Solar Roof Program", "☀️", "draft",
  "1,000 roofs a week. (We managed 23.)", { gain: 25, tickDrain: 0.30, banner: "1,000/WK" });
_tech("t_hyperloop2", "Hyperloop Worldwide", "🌐", "draft",
  "Take the concept global. Pay for nothing.", { gain: 30, tickDrain: 0.35, banner: "WORLDWIDE" });
_tech("t_starlink", "Starlink Constellations", "🛰️", "draft",
  "Free internet from space. (Billed monthly.)", { tickCap: 1.0, banner: "SATELLITES" });

const VW_STARTER_DECK = [
  "p_selfdriving", "p_cybercab", "p_battery", "p_demo",
  "d_regulators", "d_rival", "d_meme",
  "t_hyperloop", "t_boring", "t_solar",
];

const VW_DRAFT_POOL = [
  "p_loop", "p_robotaxis", "p_optimus", "p_moon", "p_coast", "p_sleep", "p_pivot",
  "d_absolutist", "d_publicsquare", "d_puppets", "d_fight",
  "t_square", "t_firehose", "t_vegas", "t_solar2", "t_hyperloop2", "t_starlink",
];

// ---------------------------------------------------------------------------
// CRISES — swipe left (silence) or right (double down). Each logs a fact.
// ---------------------------------------------------------------------------
const VW_CRISES = [
  {
    id: "c_sec", icon: "⚖️",
    title: "SEC files 'Funding Secured' charges",
    body: "Regulators say you committed fraud in a tweet. Your lawyers recommend paying them off quietly.",
    left: { label: "SETTLE", cost: 25, guillotine: 3 },
    right: { label: "DOUBLE DOWN", loyalty: 10, guillotine: 14 },
    fact: "funding_secured",
  },
  {
    id: "c_teleop", icon: "🎥",
    title: "Your 'dexterous' robot was a puppet",
    body: "Journalists confirmed the laundry-folding Optimus was teleoperated by humans off-camera. The video is everywhere.",
    left: { label: "COVER IT UP", cost: 30, guillotine: 4 },
    right: { label: "DENY IT", loyalty: 12, guillotine: 16 },
    fact: "optimus_teleop",
  },
  {
    id: "c_markdown", icon: "📉",
    title: "Fund managers mark your platform down 72%",
    body: "A Fidelity write-down values the thing you bought for $44B at $12.5B. The memes write themselves.",
    left: { label: "DISTRACT", cost: 20, guillotine: 3 },
    right: { label: "DEFLECT", loyalty: 8, guillotine: 12 },
    fact: "x_markdown",
  },
  {
    id: "c_advertisers", icon: "🏃",
    title: "Advertisers are fleeing",
    body: "You reinstated the extremists; the brands bolted. The revenue stream is a sieve.",
    left: { label: "APPEASE", cost: 22, guillotine: 3 },
    right: { label: "DOUBLE DOWN", loyalty: 10, guillotine: 12, advertisers: -0.10 },
    fact: "x_acquisition",
  },
  {
    id: "c_vegas", icon: "🚇",
    title: "Officials call your Loop 'a scam'",
    body: "Transit officials: 'the biggest, most absurd transit scam I have ever heard of.' The tunnel is 50 mph and manual.",
    left: { label: "FIX IT (ALLEGEDLY)", cost: 15, guillotine: 2 },
    right: { label: "RIDE THE MEME", loyalty: 6, guillotine: 11 },
    fact: "vegas_loop",
  },
  {
    id: "c_starship", icon: "🚀",
    title: "Engineers: Starship can't keep humans alive",
    body: "A Nature feasibility study says the architecture is unworkable for crewed survival. Mars is a slideshow.",
    left: { label: "SOFTEN THE STORY", cost: 20, guillotine: 3 },
    right: { label: "DOUBLE DOWN", loyalty: 9, guillotine: 13 },
    fact: "starship",
  },
  {
    id: "c_solar", icon: "☀️",
    title: "Solar Roof customers sue",
    body: "A $6M class action over price-gouging. Your 'cheaper than a roof' roof cost $106,000.",
    left: { label: "SETTLE", cost: 18, guillotine: 3 },
    right: { label: "BLAME THE PANELS", loyalty: 7, guillotine: 11 },
    fact: "solar_roof",
  },
  {
    id: "c_hw3", icon: "🔧",
    title: "HW3 owners want their money back",
    body: "The hardware you sold as 'future-proof' can't ever do autonomy. Millions of owners want a refund and an apology.",
    left: { label: "REBATE", cost: 16, guillotine: 3 },
    right: { label: "GASLIGHT", loyalty: 8, guillotine: 12 },
    fact: "hw3",
  },
  {
    id: "c_podcast", icon: "🎙️",
    title: "You tanked your own stock on a podcast",
    body: "You rambled for three hours and scared the market. The clip is clipped and looping.",
    left: { label: "BUY THE DIP", cost: 12, guillotine: 2 },
    right: { label: "OWN IT HARD", loyalty: 6, guillotine: 9 },
    fact: "funding_secured",
  },
  {
    id: "c_pepfar", icon: "💔",
    title: "Aid supply chains collapse",
    body: "The efficiency purge defunded global AIDS relief. In reliant nations, antivirals are running out. Health trackers are counting the dead.",
    left: { label: "RESTORE FUNDING", cost: 40, guillotine: -5, loyalty: 4 },
    right: { label: "HOLD THE LINE", loyalty: 5, guillotine: 20 },
    fact: "pepfar",
  },
];

// ---------------------------------------------------------------------------
// RANDOM DISASTERS — trigger a panic (POST MEME) storm.
// ---------------------------------------------------------------------------
const VW_DISASTERS = [
  { title: "Your rocket exploded on the pad", sub: "The feed is all slow-motion replays." },
  { title: "Congress subpoenas your slides", sub: "The 'timeline' is now evidence." },
  { title: "A leaked email shows you knew", sub: "'It will never fly. Tell them next year.'" },
  { title: "The board finally read the deck", sub: "And they forwarded it to the press." },
  { title: "The receipts are public", sub: "Someone leaked your internal deadlines." },
];

// ---------------------------------------------------------------------------
// THE 3AM K-HOLE — once per run. Fast-forward five days into chaos.
// ---------------------------------------------------------------------------
const VW_JOKER_EFFECTS = [
  {
    text: "You tanked your own stock on a podcast.",
    apply(g) {
      g.modCapital(g.state.capital * -0.35);
      g.modGuillotine(8);
    },
  },
  {
    text: "You promised free insurance to everyone. Somehow.",
    apply(g) { g.modCapital(-20); g.modLoyalty(10); },
  },
  {
    text: "You announced you're moving to Mars.",
    apply(g) { g.modLoyalty(15); g.modGuillotine(6); g.modCapital(10); },
  },
  {
    text: "The board staged an intervention.",
    apply(g) { g.modCapital(-10); g.modGuillotine(-12); },
  },
  {
    text: "You said you'd fix it 'next year'. Again.",
    apply(g) { g.modLoyalty(8); g.modGuillotine(-4); },
  },
  {
    text: "You 'bought' the company on X. The market believed you.",
    apply(g) { g.modCapital(-15); g.modGuillotine(-10); g.modAdvertisers(-0.05); },
  },
];

// ---------------------------------------------------------------------------
// PHASES
// ---------------------------------------------------------------------------
const VW_PHASES = [
  { n: 1, name: "THE HONEYMOON", desc: "Easy money. Easy lies." },
  { n: 2, name: "THE GRIFT", desc: "The timers tighten." },
  { n: 3, name: "THE DEATH SPIRAL", desc: "Overlapping deadlines." },
  { n: 4, name: "THE END", desc: "The facade crumbles." },
];

const VW_MODULES_TO_ESCAPE = 10; // rocket modules needed to "win"