# The Blade Model

How the Doomsday Clock decides where the blade sits, and why it can be argued
with. Every number below is reproducible from the stored reading.

## The problem with a straight average

The first build took the mean rage score of twelve headlines. It read 70.4, and
that number was meaningless: it had no memory, so one bad afternoon moved it ten
points; it had no floor, so a quiet week read like utopia; and it had no ceiling,
so a genuinely historic week read the same as a bad Tuesday. A clock that jumps
is not a clock.

## 1. Score five dimensions, not headlines

Each pass, the model files every item under one of five dimensions and scores it
0–100. The dimension score is the shrunk mean of its items (§2), so the shape of
a week is fixed by the taxonomy rather than by whatever the prompt happened to
say. The five are:

| dimension    | weight | what it measures                                                    |
| ------------ | -----: | ------------------------------------------------------------------- |
| extraction   |    25% | value moving up: billionaire wealth delta, profit share, buybacks    |
| cost         |    20% | what people pay: rent, food, real wages                              |
| impunity     |    20% | whether any of it is punished: fines vs profit, avoidance, charges   |
| suppression  |    20% | the price of objecting: arrests, crackdowns, press pressure          |
| precarity    |    15% | distance to the floor: layoffs, evictions, debt                      |

Weights sum to 100. Extraction and cost carry the most because they are the two
ends of the same transfer; precarity carries the least because it is the most
volatile and the easiest to fake with one press release.

## 2. Shrink each dimension toward the middle

A dimension scored from `n` items with mean `d̄` becomes:

```
d = (n·d̄ + m·50) / (n + m)      m = 3
```

One item scored 90 reads as `(90 + 150) / 4 = 60`. Six items at 90 read as
`(540 + 150) / 9 = 76.7`. Evidence has to accumulate before it can shout. This
is Bayesian shrinkage toward a neutral prior, and it is the single most
important line in the model — it is what stops a headline from moving the blade.

## 3. Composite

```
C = Σ wᵢ·dᵢ      C ∈ [0, 100]
```

## 4. The level has memory

```
Lₜ = Lₜ₋₁ + α·(C − Lₜ₋₁)        α = 0.12
```

with two clamps:

- `|Lₜ − Lₜ₋₁| ≤ 6` — no reading may move the blade more than six points.
- `15 ≤ Lₜ ≤ 99.5` — the machine never declares utopia and never reaches the neck.

α = 0.12 means a single reading is absorbed slowly: half of a step lands in about
five readings (~20 hours), and 90% in about eighteen (~3 days). The clock has a
three-day memory. That is the "board of the Bulletin" role, replaced by
arithmetic: the world has to stay bad for the blade to keep falling.

## 5. Level → clock

```
S = 5 + 43195 · (1 − L/100)²        seconds to midnight
```

| level L | seconds S | reads as |
| ------: | --------: | -------- |
|      15 |    31,217 | 08:40:17 |
|      50 |    10,804 | 03:00:04 |
|      70 |     3,893 | 01:04:53 |
|      90 |       437 | 00:07:17 |
|    99.5 |         5 | 00:00:05 |

The exponent of 2 is deliberate: the last twenty points cost more than the first
fifty. Near midnight the scale compresses, so the clock slows exactly when it
matters most — which is what makes it read as a clock and not a progress bar.

## 6. Blade position

```
bladePct = L            (clamped 3–97)
```

One number, two renderings. The dial and the blade can never disagree because
they are the same value.

## 7. Pressure

```
P = C − L
```

Displayed as `FALLING` / `HOLDING` / `RECOVERING` with the point delta. This is
the derivative, and it is what makes the installation feel alive between
readings without inventing motion the data does not support.

## 8. Failure modes, stated

- **No new evidence** → the level holds. It does not decay toward neutral;
  silence is not improvement.
- **Stale beyond 24h** → the dial shows `NO READING` and freezes. It never
  extrapolates.
- **Model returns garbage** → the previous reading is kept and the pass is
  logged as failed. The clock never falls back to zero.
- **A single catastrophic story** → capped at +6 per reading by construction.

## Worked example — the reading from 2026-11-07

```
extraction  72  ×0.25 = 18.00
cost        68  ×0.20 = 13.60
impunity    74  ×0.20 = 14.80
suppression 66  ×0.20 = 13.20
precarity   61  ×0.15 =  9.15
                        ------
C                      = 68.75

L (previous 70.4)      = 70.4 + 0.12·(68.75 − 70.4)
                       = 70.20        (Δ −0.20, within the ±6 clamp)

S  = 5 + 43195·(1 − 0.702)² = 3,839s
   = 01:03:59

blade = 70.2%
pressure = 68.75 − 70.20 = −1.45  →  RECOVERING
```

The blade moves *up* by 0.2% on a week of bad news, because the previous reading
was worse than this one. That is the model working: it remembers.
