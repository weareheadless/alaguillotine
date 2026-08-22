/* Vaporware Vanguard — UI layer. Renders state, handles gestures.
   The Spite Times dashboard: newspaper (main), wire (side), poker hand. */

'use strict';

const QUIET_PAPER = [
  { head: "ALL QUIET ON THE GRIFT FRONT", sub: "Markets steady. No deadlines broken. Yet." },
  { head: "THE TOWN HALLS ARE BORED", sub: "The crowd waits for a promise worth believing. Or at least worth streaming." },
  { head: "ROCKET FUND ENTERS PHASE: HYPE", sub: "Engineers confirm the timeline is 'aspirational' — the only part that exists." },
  { head: "NO NEWS IS GOOD NEWS", sub: "Your lawyers have requested that sentence remain accurate for at least one more hour." },
  { head: "STOCK SLIGHTLY UP ON NOTHING", sub: "Analysts attribute the gain to 'vibes, mostly'." },
];

class UI {
  constructor() {
    this.game = null;
    this.$ = (id) => document.getElementById(id);
    this.el = {
      capitalFill: this.$("capitalFill"), capitalText: this.$("capitalText"),
      loyaltyFill: this.$("loyaltyFill"), loyaltyText: this.$("loyaltyText"),
      guillotineFill: this.$("guillotineFill"), guillotineText: this.$("guillotineText"),
      rocketFill: this.$("rocketFill"), rocketText: this.$("rocketText"),
      phaseTag: this.$("phaseTag"),
      paperBody: this.$("paperBody"),
      wireTimers: this.$("wireTimers"),
      wireLog: this.$("wireLog"),
      handFan: this.$("handFan"),
      joker: this.$("joker"),
      panic: this.$("panic"), panicSub: this.$("panicSub"), panicMeta: this.$("panicMeta"), panicBtn: this.$("panicBtn"),
      khol: this.$("khol"),
      draft: this.$("draft"), draftChoices: this.$("draftChoices"),
      intro: this.$("intro"), startBtn: this.$("startBtn"),
      receiptWrap: this.$("receiptWrap"), receipt: this.$("receipt"),
    };
    this._paperSig = "";
    this._timerSig = "";
    this._logSig = "";
    this._handSig = "";
    this._timerNodes = new Map();
    this._uid = 1;
    this._quietIdx = 0;
  }

  bind(game) {
    this.game = game;
    game.ui = this;
    this.el.startBtn.addEventListener("click", () => {
      this.el.intro.classList.add("hidden");
      this.game.start();
    });
    this.el.joker.addEventListener("click", () => this.game.useJoker());
    this.el.panicBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (navigator.vibrate) navigator.vibrate(8);
      this.game.tapPanic();
    });
  }

  // ---- top-level render (called each tick) ------------------------------
  render() {
    const s = this.game.state;
    if (!s) return;

    this.el.capitalText.textContent = "$" + Math.round(s.capital);
    this.el.capitalFill.style.width = Math.min(100, this.game.rocketPct()) + "%";
    this.el.loyaltyFill.style.width = s.loyalty + "%";
    this.el.loyaltyText.textContent = Math.round(s.loyalty);
    this.el.guillotineFill.style.width = s.guillotine + "%";
    this.el.guillotineText.textContent = Math.round(s.guillotine) + "%";
    this.el.guillotineFill.parentElement.classList.toggle("danger", s.guillotine > 55);
    this.el.rocketFill.style.width = this.game.rocketPct() + "%";
    this.el.rocketText.textContent = "MODULE " + s.level + "/" + VW_MODULES_TO_ESCAPE;

    const p = this.game.phaseCfg();
    this.el.phaseTag.textContent = "PHASE " + p.n + " · " + p.name + " — " + p.desc;

    this.el.joker.classList.toggle("used", s.jokerUsed);

    this.renderPaper();
    this.renderTimers();
    this.renderLog();
    this.renderHand();
    this.renderPanic();
  }

  // ---- THE NEWSPAPER ----------------------------------------------------
  renderPaper() {
    const s = this.game.state;
    const c = s.crisis;
    const sig = c ? c.id : "quiet";
    if (sig === this._paperSig) return;
    this._paperSig = sig;
    this.el.paperBody.innerHTML = "";
    if (c) {
      const node = this._buildCrisis(c);
      this.el.paperBody.appendChild(node);
      this._attachSwipe(node, c);
    } else {
      const q = QUIET_PAPER[this._quietIdx % QUIET_PAPER.length];
      this._quietIdx++;
      const node = document.createElement("div");
      node.className = "article quiet";
      node.innerHTML =
        '<div class="quiet-head">' + this._esc(q.head) + '</div>' +
        '<div class="quiet-sub">' + this._esc(q.sub) + '</div>';
      this.el.paperBody.appendChild(node);
    }
  }

  _buildCrisis(c) {
    const node = document.createElement("div");
    node.className = "article";
    node.style.position = "relative";
    node.innerHTML =
      '<div class="breaking-bar">' + c.icon + ' BREAKING</div>' +
      '<h2>' + this._esc(c.title) + '</h2>' +
      '<div class="byline">By The Spite Times Wire · Your Lawyers Are Screaming</div>' +
      '<p>' + this._esc(c.body) + '</p>' +
      '<div class="swipe-hint l">◀ SILENCE</div>' +
      '<div class="swipe-hint r">DOUBLE DOWN ▶</div>' +
      '<div class="article-actions">' +
        '<button class="left-btn">💸 ' + this._esc(c.left.label || "SILENCE") + '</button>' +
        '<button class="right-btn">🔥 ' + this._esc(c.right.label || "DOUBLE DOWN") + '</button>' +
      '</div>';
    node.querySelector(".left-btn").addEventListener("click", () => this.game.swipeCrisis("left"));
    node.querySelector(".right-btn").addEventListener("click", () => this.game.swipeCrisis("right"));
    return node;
  }

  _attachSwipe(node, crisis) {
    let startX = 0, dx = 0, active = false, moved = false;
    const onDown = (e) => {
      active = true; moved = false; dx = 0; startX = e.clientX;
      node.style.transition = "none";
      node.setPointerCapture && node.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!active) return;
      dx = e.clientX - startX;
      if (Math.abs(dx) > 6) moved = true;
      node.style.transform = "translateX(" + dx + "px) rotate(" + dx * 0.02 + "deg)";
      node.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 400));
    };
    const onUp = (e) => {
      if (!active) return;
      active = false;
      node.style.transition = "transform .25s, opacity .25s";
      node.style.transform = "";
      node.style.opacity = "1";
      if (moved && Math.abs(dx) > 70) {
        this.game.swipeCrisis(dx < 0 ? "left" : "right");
      }
    };
    node.addEventListener("pointerdown", onDown);
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onUp);
  }

  // ---- THE WIRE: timers -------------------------------------------------
  renderTimers() {
    const s = this.game.state;
    const sig = s.timers.map((t) => t._uid || (t._uid = this._uid++)).join(",");
    if (sig !== this._timerSig) {
      this._timerSig = sig;
      for (const n of this._timerNodes.values()) n.remove();
      this._timerNodes.clear();
      for (const t of s.timers) {
        const node = this._buildTimer();
        this.el.wireTimers.appendChild(node);
        this._timerNodes.set(t._uid, node);
      }
      if (!s.timers.length) {
        const node = document.createElement("div");
        node.className = "wire-timer";
        node.style.opacity = ".6";
        node.innerHTML = '<div class="wt-top"><span class="wt-label">No deadlines due. Suspicious.</span></div>';
        this.el.wireTimers.appendChild(node);
      }
    }
    for (const t of s.timers) {
      const node = this._timerNodes.get(t._uid);
      if (!node) continue;
      const pct = Math.max(0, Math.min(100, (t.left / t.total) * 100));
      const card = VW_CARDS[t.cardId] || {};
      node.querySelector(".wt-bar i").style.width = pct + "%";
      node.querySelector(".wt-time").textContent = t.infinite ? "∞" : Math.ceil(t.left) + "s";
      node.querySelector(".wt-label").textContent = t.infinite
        ? (t.label + " · looping") : (t.label + " · due");
      node.classList.toggle("late", !t.infinite && t.left / t.total < 0.25);
    }
  }

  _buildTimer() {
    const node = document.createElement("div");
    node.className = "wire-timer";
    node.innerHTML =
      '<div class="wt-top"><span class="wt-label"></span><span class="wt-time"></span></div>' +
      '<div class="wt-bar"><i></i></div>';
    return node;
  }

  // ---- THE WIRE: the ledger (your actions) ------------------------------
  renderLog() {
    const s = this.game.state;
    const last = s.log[s.log.length - 1];
    const sig = s.log.length + ":" + (last ? last.ts + ":" + last.text.length : 0);
    if (sig === this._logSig) return;
    this._logSig = sig;
    this.el.wireLog.innerHTML = "";
    for (const entry of s.log.slice(-10)) {
      const node = document.createElement("div");
      node.className = "wire-log";
      node.innerHTML =
        '<span class="wl-time">' + this._fmtTime(entry.ts) + '</span>' +
        this._esc(entry.text);
      this.el.wireLog.appendChild(node);
    }
    this.el.wireLog.scrollTop = this.el.wireLog.scrollHeight;
  }

  _fmtTime(ts) {
    const m = Math.floor(ts / 60);
    const s = ts % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // ---- THE HAND: poker cards --------------------------------------------
  renderHand() {
    const s = this.game.state;
    const sig = s.hand.join(",");
    if (sig === this._handSig) return;
    this._handSig = sig;
    this.el.handFan.innerHTML = "";
    for (const id of s.hand) {
      const card = VW_CARDS[id];
      const node = document.createElement("div");
      node.className = "hand-card " + card.type;
      node.innerHTML =
        '<span class="corner tl"><i class="c-pip">' + card.icon + '</i><i class="c-label">' + this._esc(card.type) + '</i></span>' +
        '<span class="c-name">' + this._esc(card.name) + '</span>' +
        '<span class="big-pip">' + card.icon + '</span>' +
        '<span class="cost">' + (card.capitalLabel || "") + '</span>' +
        '<span class="corner br"><i class="c-pip">' + card.icon + '</i><i class="c-label">' + this._esc(card.type) + '</i></span>';
      this._attachDrag(node, id);
      this.el.handFan.appendChild(node);
    }
  }

  _attachDrag(node, cardId) {
    let ghost = null, startX = 0, active = false;
    const dashboard = this.$("dashboard");
    const onDown = (e) => {
      active = true;
      startX = e.clientX;
      const r = node.getBoundingClientRect();
      ghost = node.cloneNode(true);
      ghost.style.cssText = "position:fixed;z-index:50;width:" + r.width + "px;opacity:.92;pointer-events:none;left:" + r.left + "px;top:" + r.top + "px;transform:none;margin-left:0;";
      document.body.appendChild(ghost);
      node.style.opacity = "0.25";
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!active || !ghost) return;
      ghost.style.left = (e.clientX - (startX - parseFloat(ghost.style.left))) + "px";
      ghost.style.top = e.clientY + "px";
    };
    const onUp = (e) => {
      if (!active) return;
      active = false;
      node.style.opacity = "";
      if (ghost) { ghost.remove(); ghost = null; }
      const r = dashboard.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom &&
          e.clientX >= r.left && e.clientX <= r.right) {
        this.game.playCard(cardId);
      }
    };
    node.addEventListener("pointerdown", onDown);
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onUp);
  }

  // ---- panic ------------------------------------------------------------
  renderPanic() {
    const p = this.game.state.panic;
    this.el.panic.classList.toggle("hidden", !p);
    if (p) {
      this.el.panicSub.textContent = p.title + " — " + p.sub;
      this.el.panicMeta.textContent =
        p.taps + "/" + p.need + " posts · " + Math.ceil(p.timeLeft) + "s left · loyalty " +
        Math.round(this.game.state.loyalty);
    }
  }

  // ---- overlays ---------------------------------------------------------
  showDraft(picks) {
    this.el.draftChoices.innerHTML = "";
    for (const id of picks) {
      const c = VW_CARDS[id];
      const node = document.createElement("div");
      node.className = "draft-card";
      node.innerHTML =
        '<div class="dc-icon">' + c.icon + '</div>' +
        '<div class="dc-mid"><div class="dc-name">' + this._esc(c.name) + '</div>' +
        '<div class="dc-desc">' + this._esc(c.desc) + '</div></div>';
      node.addEventListener("click", () => this.game.chooseDraft(id));
      this.el.draftChoices.appendChild(node);
    }
    this.el.draft.classList.remove("hidden");
  }

  hideDraft() { this.el.draft.classList.add("hidden"); }

  showKhol(cb) {
    this.el.khol.classList.remove("hidden");
    this.el.khol.innerHTML =
      '<div class="khol-text">💊 3AM K-HOLE<br/><span style="font-size:16px">you wake up five days from now</span></div>';
    setTimeout(() => {
      cb && cb();
      this.el.khol.classList.add("hidden");
    }, 3500);
  }

  showReceipt(won) {
    const r = this.game.receipt();
    this.el.receipt.innerHTML = this._buildReceipt(won, r);
    this.el.receiptWrap.classList.remove("hidden");
    this.el.receipt.querySelector("#shareBtn").addEventListener("click", () => this.share(r, won));
    this.el.receipt.querySelector("#copyBtn").addEventListener("click", () => this.copyReceipt(r, won));
    this.el.receipt.querySelector("#donateBtn").addEventListener("click", () => this.donate());
    this.el.receipt.querySelector("#replayBtn").addEventListener("click", () => location.reload());
  }

  donate() {
    const addrs = {
      BTC: "bc1qhmyjv628prkxkjy9dnzkmwsyx8d3s04evq4ttz",
      SOL: "9GL3M1DdNrrEBgKnbxupJqM4piya4pw2Kf5HRAstyWxB",
      ETH: "0x3799b3210ebe09039EaC2F6174A99c07AC577d87",
    };
    const text = "Fund the guillotine polish:\nBTC " + addrs.BTC + "\nSOL " + addrs.SOL + "\nETH " + addrs.ETH;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => this.toast("Donation addresses copied. Feed the machine."))
      .catch(() => this.toast(text));
  }

  _buildReceipt(won, r) {
    const seenFacts = r.facts.filter((f) => f.seen);
    const allFacts = r.facts;
    const headline = won ? "YOU MADE IT TO MARS" : "THE GUILLOTINE FELL";
    const sub = won
      ? "Congratulations. You left a burning planet behind."
      : "The facade crumbled. The crowd saw the receipts.";

    let html =
      '<h2>🧾 THE CAPITALIST RECEIPT</h2>' +
      '<div class="r-sub">' + headline + ' · ' + sub + '</div>';

    html += '<div class="rec-section"><h3>YOUR RUN</h3>' +
      '<div class="rec-row"><span>Run time</span><b>' + this._fmtTime(r.seconds) + '</b></div>' +
      '<div class="rec-row"><span>Rocket modules</span><b>' + r.levels + '/' + VW_MODULES_TO_ESCAPE + '</b></div>' +
      '<div class="rec-row"><span>Final capital</span><b>$' + r.capital + '</b></div>' +
      '<div class="rec-row"><span>While you played, ' + VW_BILLIONAIRE.name + ' made</span><b>$' + this._fmtNum(r.made) + '</b></div>' +
      '</div>';

    html += '<div class="rec-section"><h3>THE REALITY CHECK</h3>';
    if (seenFacts.length) {
      html += '<div class="r-sub" style="margin:0 0 8px">The lies you actually told this run:</div>';
      for (const f of seenFacts) html += this._factHtml(f);
      html += '<div class="r-sub" style="margin:10px 0 8px">And the rest of the documented record:</div>';
    }
    for (const f of allFacts) {
      if (seenFacts.includes(f)) continue;
      html += this._factHtml(f);
    }
    html += '</div>';

    html += '<div class="rec-section"><h3>THE FUNNEL</h3>' +
      '<div class="rec-actions">' +
        '<button class="primary" id="shareBtn">📤 SHARE THIS RECEIPT</button>' +
        '<button id="copyBtn">📋 COPY THE RECEIPT</button>' +
        '<button class="donate" id="donateBtn">💰 FUND THE GUILLOTINE POLISH</button>' +
        '<button id="replayBtn">↻ PLAY AGAIN</button>' +
      '</div></div>';
    html += '<div class="r-end">Satire. The blade is metaphorical. Every claim above links to a documented source.<br/>One wallet. One vote. Infinite spite.</div>';
    return html;
  }

  _factHtml(f) {
    return '<div class="rec-fact">' +
      '<b>' + this._esc(f.title) + '</b><br/>' +
      this._esc(f.body) + '<br/>' +
      '<a href="' + this._esc(f.url) + '" target="_blank" rel="noopener">' + this._esc(f.url) + '</a>' +
      '</div>';
  }

  share(r, won) {
    const text = this.receiptText(r, won);
    if (navigator.share) {
      navigator.share({ title: "Vaporware Vanguard — The Mars Escape", text }).catch(() => {});
    } else {
      this.copyReceipt(r, won);
    }
  }

  copyReceipt(r, won) {
    const text = this.receiptText(r, won);
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => this.toast("Receipt copied."))
      .catch(() => this.toast("Couldn't copy — " + text));
  }

  receiptText(r, won) {
    const lines = [
      "🧾 VAPORWARE VANGUARD — THE CAPITALIST RECEIPT",
      won ? "OUTCOME: YOU MADE IT TO MARS. You left a burning planet behind." : "OUTCOME: THE GUILLOTINE FELL.",
      "Run time: " + this._fmtTime(r.seconds) + " · Modules: " + r.levels + "/" + VW_MODULES_TO_ESCAPE,
      "While you played, " + VW_BILLIONAIRE.name + " made $" + this._fmtNum(r.made) + ".",
      "",
      "THE REALITY CHECK:",
    ];
    const facts = r.facts.filter((f) => f.seen).length ? r.facts.filter((f) => f.seen) : r.facts.slice(0, 5);
    for (const f of facts) lines.push("• " + f.title + " — " + f.body + " (" + f.url + ")");
    lines.push("", "Satire. The blade is metaphorical. Sources linked in the full receipt.");
    return lines.join("\n");
  }

  toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  _esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  _fmtNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
}