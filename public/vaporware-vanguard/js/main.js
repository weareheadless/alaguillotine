/* Vaporware Vanguard — bootstrap. */

'use strict';

const game = new Game();
const ui = new UI();
ui.bind(game);

const TICK_MS = 100;
setInterval(() => {
  const s = game.state;
  if (!s) return;
  if (!s.over) game.tick(TICK_MS / 1000);
  ui.render();
  if (s.over && !s.receiptShown) {
    s.receiptShown = true;
    ui.showReceipt(s.won);
  }
}, TICK_MS);

// Keep the screen awake while it's open (helps on mobile).
try {
  if (navigator.wakeLock) {
    navigator.wakeLock.request("screen").catch(() => {});
  }
} catch (e) { /* noop */ }