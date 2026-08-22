# Vaporware Vanguard — The Mars Escape

A satirical resource-management and survival game. You are a billionaire tech
CEO. Pitch lies, farm hype, and flee to Mars before the public — and the
Guillotine — catch on. The blade is metaphorical. The receipts are real.

## Play

```bash
cd vaporware-vanguard
python3 -m http.server 8080
# open http://localhost:8080  (best on a phone, portrait, one thumb)
```

Or push the folder to GitHub Pages — it's a fully static site, zero build step.

## Controls (mobile-first, one thumb)

- **Swipe a crisis** left (pay it off) or right (double down). Buttons work too.
- **Drag a card** from your hand up onto the timeline to play it.
- **POST MEME** — rapidly tap during a news storm to suppress it (drains loyalty).
- **💊 The 3AM K-Hole** — once per run. Fast-forward five days into chaos.

## How it works

- **Capital** funds the rocket. **Cult Loyalty** is armor against the
  Guillotine. **The Guillotine** fills with outrage — 100% is game over.
- Promise cards grant capital but start countdowns; a missed launch surges the
  Guillotine. Distraction cards bury outrage but the crowd remembers (baseline
  rises) and some shred your advertiser multiplier, which drives passive income.
- Complete a rocket module (capital reaches the cost) → draft a new playbook
  card. Fill all 10 modules and you escape to Mars. Most runs end under the
  blade. That's the point.

## The Receipt

Every game ends in a **Capitalist Receipt**: your run time, what the real
billionaires made while you played, and the **Reality Check** — the documented
facts behind the cards you actually used, each linked to a source. Share it,
copy it, fund the guillotine.

Satire. Public figures appear strictly as symbolic proxies for late-stage
capitalism. Every claim in the Reality Check links to a factual source.

## Files

- `index.html` — the shell
- `style.css` — mobile-first UI
- `js/data.js` — cards, crises, disasters, the dossier facts
- `js/game.js` — the engine (meters, timers, panic, draft, joker)
- `js/ui.js` — rendering + gestures
- `js/main.js` — bootstrap + game loop
