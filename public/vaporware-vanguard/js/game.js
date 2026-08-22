/* Vaporware Vanguard — engine. Pure logic, no DOM. The UI binds to this. */

'use strict';

// Which card plays surface which Receipt fact.
const CARD_FACT = {
  p_loop: "fsd_timeline", p_robotaxis: "fsd_timeline", p_coast: "fsd_timeline", p_sleep: "fsd_timeline",
  p_optimus: "optimus_targets", p_moon: "mars_goalposts", p_pivot: "mars_goalposts",
  t_hyperloop: "hyperloop", t_hyperloop2: "hyperloop",
  t_boring: "vegas_loop", t_vegas: "vegas_loop",
  t_solar: "solar_roof", t_solar2: "solar_roof",
  t_firehose: "x_markdown", d_publicsquare: "x_acquisition", d_absolutist: "x_acquisition",
};

class Game {
  constructor() {
    this.state = null;
    this.ui = null;
  }

  start() {
    this.state = {
      capital: 40,
      loyalty: 60,
      guillotine: 0,
      advertisers: 1.0,
      baseline: 0,
      timers: [],
      outrages: [],
      deck: [...VW_STARTER_DECK],
      hand: [],
      owned: [],
      jokerUsed: false,
      level: 0,
      runTime: 0,
      panic: null,
      crisis: null,
      crisisPool: [],
      nextCrisisAt: 15,
      scandal: new Set(),
      log: [],
      over: false,
      won: false,
      draftChoices: null,
      startedAt: Date.now(),
    };
    this.drawHand();
    this.pushCrisis();
    this.addLog("You take the helm. The rocket needs modules. The people need a story.", "ok");
  }

  // ---- derived ----------------------------------------------------------
  phase() { return Math.min(4, Math.floor(this.state.level / 3) + 1); }
  phaseCfg() { return VW_PHASES[this.phase() - 1]; }
  moduleCost() { return 80 + 50 * this.state.level; }
  rocketPct() { return Math.min(100, (this.state.capital / this.moduleCost()) * 100); }

  // ---- meters -----------------------------------------------------------
  modCapital(d) { this.state.capital = Math.max(0, this.state.capital + d); }
  modLoyalty(d) {
    const s = this.state;
    s.loyalty = Math.min(100, Math.max(0, s.loyalty + d));
  }
  modGuillotine(d) {
    const s = this.state;
    s.guillotine = Math.min(100, Math.max(0, s.guillotine + d));
    if (s.guillotine >= 100) this.end(false);
  }
  modAdvertisers(d) { this.state.advertisers = Math.max(0.1, Math.min(1.5, this.state.advertisers + d)); }
  modBaseline(d) { this.state.baseline = Math.max(0, this.state.baseline + d); }
  clearOutrage() { this.state.outrages = []; }

  // ---- cards / hand -----------------------------------------------------
  drawHand() {
    const s = this.state;
    while (s.hand.length < 4 && s.deck.length) {
      const i = Math.floor(Math.random() * s.deck.length);
      s.hand.push(s.deck.splice(i, 1)[0]);
    }
  }

  playCard(id) {
    const s = this.state;
    if (s.over || s.panic || s.draftChoices) return false;
    const idx = s.hand.indexOf(id);
    if (idx === -1) return false;
    const card = VW_CARDS[id];
    if (!card) return false;
    s.hand.splice(idx, 1);
    let line = card.play(this);
    if (card.type === "tech") {
      s.owned.push(id);
      line += " [PASSIVE]";
    }
    if (CARD_FACT[id]) s.scandal.add(CARD_FACT[id]);
    this.addLog(card.icon + " " + line, "play");
    this.drawHand();
    this.maybeLevelUp();
    return true;
  }

  // ---- timers -----------------------------------------------------------
  startTimer(cardId, duration, opts) {
    this.state.timers.push({
      cardId, total: duration, left: duration,
      label: opts.label || "promise",
      infinite: !!opts.infinite,
    });
  }

  replaceTimer(timer, extra) {
    timer.total += extra;
    timer.left += extra;
  }

  nearestTimer() {
    const active = this.state.timers.filter((t) => !t.infinite);
    if (!active.length) return null;
    return active.sort((a, b) => a.left - b.left)[0];
  }

  fireTimers() {
    const s = this.state;
    for (const t of s.timers) {
      if (t.infinite) {
        if (t.left <= 0) {
          t.left = t.total;
          const c = VW_CARDS[t.cardId] || {};
          this.modLoyalty(-(c.loopLoyalty || 2));
          this.modGuillotine(c.loopGuillotine || 1.5);
          this.addLog("∞ " + (t.label || "The Infinite Loop") +
            " reset. The fandom shivers. (loyalty −" + (c.loopLoyalty || 2) + ")", "warn");
        }
        continue;
      }
      if (t.left <= 0) {
        t.expired = true;
        const c = VW_CARDS[t.cardId] || {};
        const shock = c.outrage || 6;
        const rate = c.outrageRate || 0.25;
        s.outrages.push({ rate, label: t.label });
        this.modGuillotine(shock);
        this.addLog("⏰ " + (t.label || "a promise") + " failed to launch. The Guillotine surges. (+" + shock + ")", "warn");
        if (Math.random() < 0.35) this.triggerPanic();
      }
    }
    s.timers = s.timers.filter((t) => t.infinite || !t.expired);
  }

  // ---- panic (POST MEME) ------------------------------------------------
  triggerPanic(disaster) {
    const s = this.state;
    if (s.panic || s.over) return;
    const d = disaster || VW_DISASTERS[Math.floor(Math.random() * VW_DISASTERS.length)];
    const need = 8 + Math.floor(s.guillotine / 12);
    s.panic = { title: d.title, sub: d.sub, need, taps: 0, timeLeft: 8, total: 8 };
  }

  tapPanic() {
    const s = this.state;
    const p = s.panic;
    if (!p) return;
    p.taps++;
    this.modLoyalty(-0.6);
    this.modGuillotine(-0.9);
    if (p.taps >= p.need) {
      this.modGuillotine(-6);
      this.addLog("📣 You buried the story. The Guillotine drops. (−6)", "ok");
      s.panic = null;
    } else if (s.loyalty <= 0) {
      this.addLog("💔 The crowd abandoned you mid-panic. The Guillotine surges. (+15)", "warn");
      this.modGuillotine(15);
      s.panic = null;
    }
  }

  tickPanic(dt) {
    const p = this.state.panic;
    if (!p) return;
    p.timeLeft -= dt;
    if (p.timeLeft <= 0) {
      this.state.panic = null;
      this.modGuillotine(12);
      this.addLog("📣 The news cycle won. The Guillotine surges. (+12)", "warn");
    }
  }

  // ---- crises -----------------------------------------------------------
  pushCrisis() {
    const s = this.state;
    if (s.crisis) return;
    if (!s.crisisPool || !s.crisisPool.length) s.crisisPool = [...VW_CRISES];
    const i = Math.floor(Math.random() * s.crisisPool.length);
    s.crisis = s.crisisPool.splice(i, 1)[0];
  }

  swipeCrisis(side) {
    const s = this.state;
    const c = s.crisis;
    if (!c || (side !== "left" && side !== "right")) return;
    s.crisis = null;
    if (c.fact) s.scandal.add(c.fact);
    const act = c[side];
    let line;
    if (side === "left") {
      this.modCapital(-(act.cost || 0));
      this.modGuillotine(act.guillotine || 0);
      this.modLoyalty(act.loyalty || 0);
      line = "🕊️ " + c.title + " — you paid them off.";
    } else {
      this.modGuillotine(act.guillotine || 0);
      this.modLoyalty(act.loyalty || 0);
      if (act.advertisers) this.modAdvertisers(act.advertisers);
      line = "🔥 " + c.title + " — you doubled down. The crowd loves it.";
    }
    this.addLog(line, "crisis");
    s.nextCrisisAt = s.runTime + 12 + Math.random() * (18 - this.phase() * 3);
  }

  // ---- draft ------------------------------------------------------------
  rollDraft() {
    const pool = [...VW_DRAFT_POOL];
    const picks = [];
    while (picks.length < 3 && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(i, 1)[0]);
    }
    return picks;
  }

  maybeLevelUp() {
    const s = this.state;
    while (!s.over && !s.draftChoices && s.capital >= this.moduleCost()) {
      s.capital -= this.moduleCost();
      s.level++;
      s.draftChoices = this.rollDraft();
      this.addLog("🚀 Rocket module complete. Level " + s.level + ". Choose a new card.", "ok");
      if (s.level >= VW_MODULES_TO_ESCAPE) { this.end(true); return; }
      if (this.ui) this.ui.showDraft(s.draftChoices);
    }
  }

  chooseDraft(id) {
    const s = this.state;
    if (!s.draftChoices || !s.draftChoices.includes(id)) return;
    s.deck.push(id);
    s.draftChoices = null;
    this.addLog("📜 New playbook card: " + VW_CARDS[id].name, "ok");
    this.drawHand();
    this.maybeLevelUp();
    if (this.ui) this.ui.hideDraft();
  }

  // ---- joker ------------------------------------------------------------
  useJoker() {
    const s = this.state;
    if (s.jokerUsed || s.over || s.panic || s.draftChoices) return false;
    s.jokerUsed = true;
    if (this.ui) this.ui.showKhol(() => this.applyJoker());
    return true;
  }

  applyJoker() {
    const s = this.state;
    const eff = VW_JOKER_EFFECTS[Math.floor(Math.random() * VW_JOKER_EFFECTS.length)];
    // Fast-forward five days: fire whatever was due.
    const skip = 120;
    for (const t of s.timers) t.left -= skip;
    this.fireTimers();
    // Meters shuffle wildly.
    this.modCapital(Math.random() * 60 - 20);
    this.modLoyalty(Math.random() * 30 - 10);
    // The chaotic status effect.
    eff.apply(this);
    this.addLog("💊 3AM K-HOLE: " + eff.text, "joker");
  }

  // ---- main tick --------------------------------------------------------
  tick(dt) {
    const s = this.state;
    if (s.over) return;
    s.runTime += dt;

    // Passive tech.
    for (const id of s.owned) {
      const c = VW_CARDS[id];
      if (c && c.tick) c.tick(this, dt);
    }

    // Advertiser revenue: passive capital. The X-type distractions shred this
    // multiplier, so burning your advertiser base to bury a story costs you
    // forever after.
    this.modCapital(s.advertisers * (0.5 + s.level * 0.6) * dt);

    // Passive income can complete a module on its own — draft when it does.
    this.maybeLevelUp();

    // Timers + outrage.
    this.fireTimers();
    this.tickPanic(dt);

    // Guillotine pressure: base + outrage, armored by loyalty.
    const base = 0.06 + 0.04 * (this.phase() - 1) + s.baseline * 0.02;
    const outrage = s.outrages.reduce((a, o) => a + o.rate, 0);
    const armor = 1 - s.loyalty / 200;
    this.modGuillotine((base + outrage) * armor * dt);

    // Random disasters → panic.
    if (!s.panic && s.runTime > 25 && Math.random() < dt * (0.006 + this.phase() * 0.003)) {
      this.triggerPanic();
    }

    // Crisis cadence.
    if (!s.crisis && s.runTime >= s.nextCrisisAt) this.pushCrisis();

    // A tiny trickle of fandom decay so loyalty is a resource, not a hoard.
    if (s.loyalty > 20 && Math.random() < dt * 0.02) this.modLoyalty(-0.1);
  }

  // ---- end / receipt ----------------------------------------------------
  end(won) {
    const s = this.state;
    if (s.over) return;
    s.over = true;
    s.won = won;
    s.endedAt = Date.now();
  }

  receipt() {
    const s = this.state;
    const seconds = Math.round(s.runTime);
    const made = Math.round((VW_BILLIONAIRE.netWorthUSD / 86400) * seconds);
    const facts = VW_FACTS.map((f) => ({ ...f, seen: s.scandal.has(f.id) }));
    return { seconds, made, facts, levels: s.level, won: s.won, capital: Math.round(s.capital) };
  }

  addLog(text, kind) {
    const s = this.state;
    s.log.push({ text, kind, ts: Math.round(s.runTime) });
    s.log = s.log.slice(-30);
  }
}