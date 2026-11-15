# Implementation plan — the register

Companion to `docs/architecture.md`. That file says *what the system is*; this one
says *what gets built, in what order, and how we know each step worked*.

Definition of done for the whole programme: a reader can open any person, see
every claim with the passage it came from, and see what backs the confidence —
and a dispatch can be written from a saved query whose sources are still live.

## Ground rules

1. **No big bang.** Each phase ships alone and the site keeps working. The UI
   reads a view; the old tables stop being written long before they stop being
   read.
2. **One writer per table.** If two jobs write `claims`, one of them is wrong.
3. **New code lives in new files.** `src/lib/register/` for the core,
   `src/lib/connectors/` for sources. Nothing new goes into `feed.ts`,
   `hate-store.ts`, `dossier.ts`, `ledger-write.ts` or `coverage.ts` beyond the
   call that retires them.
4. **Every job is leased and idempotent** — `status`, `attempts`, `lease_until`,
   and a natural key so a retry cannot duplicate.
5. **Ship the audit with the feature.** A phase is not done until an SQL audit
   proves its invariant on production data.

## Workstreams and the critical path

```
W0 audit/freeze ──▶ W1 core ──▶ W2 connectors ──▶ W3 press ──▶ W4 reports
                        │              │
                        └── W5 query API ┴── W6 UI port (views only)
```

W2 can start as soon as W1's document table lands; W3 needs W1's gazetteer. W6
is not a rewrite: the pages are switched from `ledger_entries` to
`v_entity_record` behind a flag and compared side by side.

---

# P0 — stop the bleeding (1–2 days)

**Goal:** the archive stops growing unverifiable rows, and we can measure what is
already wrong.

| # | Ticket | Change | Acceptance | Size |
|---|---|---|---|---|
| T0.1 | Freeze legacy writes | every `INSERT INTO ledger_entries` path routes through `register/legacy.ts`, which is a no-op when `REGISTER_ONLY=1` | a research pass under the flag writes 0 rows; a run log says so | S |
| T0.2 | Audit queries | `src/lib/register/audit.ts` + `GET /api/register/audit` (admin) | returns counts: no quote, no source, no entity, no mechanism, no status | S |
| T0.3 | Document backfill | `register/backfill-documents.ts`: every distinct URL in `ledger_entries.sources` becomes a `documents` row, `kind` classified by host (courtlistener, sec.gov, fec.gov, usaspending, companieshouse → register; else `press`) | 1,895 rows, 0 duplicate URLs, host classification reviewable | M |
| T0.4 | Run log | `register_runs(job, started_at, finished_at, rows, error)` mirroring `feed_runs` | every job writes a row; a missing cycle is visible | S |
| T0.5 | Stand up `v_entity_record` | view returning today's person-page shape from `ledger_entries` + entities | the page renders identically behind a `?view=register` flag | S |

**Exit check:** `/api/register/audit` on production returns the baseline numbers
in `architecture.md`, and the feed and blade behave exactly as before.

---

# P1 — the core (4–5 days)

**Goal:** claims exist only with a document and a quote that verifies.

### Schema (one migration each, applied to remote with `--file`)

| # | File | Contents |
|---|---|---|
| T1.1 | `0033_claims.sql` | `claims`, `claim_aliases` (merge trail), uniqueness on `claim_key` |
| T1.2 | `0034_entity_identity.sql` | `entity_aliases(alias, entity_id, source)`, `entity_ids(scheme, value, entity_id)`; migrate the JSON columns |
| T1.3 | `0035_document_text.sql` | `documents.text_ref`, `documents.fetched_at`, `documents.http_status`; R2 bucket for text |

### Code

| # | Ticket | Change | Acceptance | Size |
|---|---|---|---|---|
| T1.4 | Gazetteer | `register/gazetteer.ts`: load entities + aliases + ids into a matcher; `match(text) → entity_ids` | unit test: "Elon Musk", "MUSK, ELON", "E. Musk" all resolve to one id; "Muskogee" resolves to none | M |
| T1.5 | Quote verification | `register/verify.ts`: `verifyQuote(quote, text) → {ok, locator}` with normalisation (whitespace, soft hyphens, curly quotes) | a 1-character alteration fails; a re-wrapped quote passes; the locator is the paragraph index | M |
| T1.6 | Claim writer | `register/claims.ts`: insert/update by `claim_key = hash(entity, act_norm, date)`; refuses a claim with 0 documents or a failed quote | a duplicate extraction updates, never duplicates; a claim without a document throws | M |
| T1.7 | Resolver | `register/resolve.ts`: alias → id, external id → id, else queue for review in `entity_review` | a new name from a document creates an entity with `source` recorded; ambiguous matches are queued, not guessed | L |
| T1.8 | Verifier job | `register/verifier.ts`: recompute quote, stance, origins, confidence, status for a batch | after a re-fetch that changes a document, orphaned claims become `superseded` | M |
| T1.9 | Legacy migration | `0036_legacy_claims.sql`: copy 6,082 rows into `claims` with `status='legacy'`, no quote, one `claim_documents` row per URL, `stance='reports'` | counts match; nothing deleted; `v_entity_record` shows them under a "filed before the register" label | M |
| T1.10 | Weight | `register/weight.ts`: `weight = category_base × grade × magnitude(amount)` with the published constants; replaces `CATEGORY_WEIGHT` in the score path behind a flag | a $20B subsidy outranks a $2M arms act in a fixture; the old score is reproducible for the same day | M |
| T1.11 | Score parity test | a script that computes today's scores both ways and prints the diff before the flag is flipped | the diff is explainable row by row | S |

**Exit check:** a deliberately corrupted quote is rejected by the API; the person
page runs on `v_entity_record`; the day's blade and queue are unchanged by the
flag being off.

---

## Migration reality (measured on the legacy import)

The old record has been carried into `claims` and `documents` (migrations 0033,
0034). What it showed:

- **6,082 claims imported, 0 lost.** 1,895 document rows created from the URLs
  already stored; 6,893 claim-document links.
- **The archive is 95% press.** 1,797 press URLs, 64 register URLs, 34 roll-call
  documents. That is the imbalance the register is meant to correct, now counted.
- **Re-grounding is possible but partial.** 262 documents fetched; 156 of the
  claim links examined carried a passage matching the act under a strict test
  (surname present, 40% content-word overlap, figures must match). About one in
  five press claims can stand on its own sentence. The rest were paraphrase, or
  the article did not say what the claim says.

### A false verification, caught

The first pass "matched" 3,591 claims in minutes, because House roll-call XML
was being read as prose: the surname appears in the member list, the bill number
appears in the header, and the extracted "quote" was the page header. That is
exactly the failure mode the architecture forbids — a machine match presented as
a passage. Fixed by three rules now in the code:

1. sentence matching applies to `kind='press'` only; structured records wait for
   their connector and their fields;
2. a claim containing figures requires those figures in the passage;
3. 40% content-word overlap and a 60–500 character sentence, not "shares a word".

### What the legacy data is, and is not

It is a usable index of *who* and *what was said*, with dates, categories and
persons attached. It is not evidence: 5,926 of 6,082 claims still have no
passage. The switch treats it accordingly — legacy rows are shown, labelled, and
excluded from the score until re-grounded.

Estimated completion of re-grounding: ~1,600 press documents left, 40 per call,
about 40 minutes of calls. Expect roughly 300–400 grounded claims, and a much
larger set that will need re-deriving from documents rather than rescuing.

# P2 — two connectors end to end (7–8 days)

**Goal:** one full loop through real paperwork, twice.

| # | Ticket | Change | Acceptance | Size |
|---|---|---|---|---|
| T2.0 | Cost probe | extract 20 documents, measure tokens per extraction, set `EXTRACT_MAX_USD_PER_RUN` | documented cost per 100 documents; a hard cap in config | S |
| T2.1 | Connector contract | `connectors/types.ts`: `fetch(cursor) → {documents[], nextCursor}`, budgets, `universe` declaration, run logging | a fake connector passes a contract test; failing connectors mark `cursor` unchanged | M |
| T2.2 | PTR connector | House Clerk + Senate PTR index → document (PDF) → text → `claims` | a known member's trade appears with filing number, date, ticker, amount band, quote | L |
| T2.3 | FEC connector | contributions + independent expenditures for a declared universe | a donor, a committee and a member's committee are three entities with edges | L |
| T2.4 | EDGAR connector | full-text search → filings naming a tracked entity | a 13D produces an `owns` edge with the filing number | M |
| T2.5 | Universe #1 | 535 members enumerated from the Clerk/Senate rosters with bioguide ids | `v_coverage` says 535 expected, 535 listed, N covered | M |
| T2.6 | Query API | `GET /api/register/claims?entity=&category=&from=&to=&minConfidence=&stance=` | returns claims with sources, stances, quotes, confidence and basis | M |
| T2.7 | Coverage panel | admin page: per universe, per connector, per source class | shows gaps, not just totals | M |
| T2.8 | Invariant audits | jobs that assert: no claim without document, no document without hash, no verified claim missing a locator | `/api/register/audit` returns 0 violations | S |

**Exit check:** `/api/register/claims?entity=<member>` returns trades and votes
with filings attached, and coverage shows a real number against 535.

---

# P3 — press as a document class (5 days)

**Goal:** names from journalism enter without becoming verdicts.

| # | Ticket | Change | Acceptance | Size |
|---|---|---|---|---|
| T3.1 | Press connectors | RSS allow-list (outlets + named individuals), `stance='reports'`, `provenance` = outlet and author | 10 feeds, ≤ N items/day each, dedupe by URL and by title hash | M |
| T3.2 | Derived-from | resolve each press item's outbound links to identify the origin document where possible | a story citing a filing links to it; a story citing another story records `derived_from` and adds no origin | M |
| T3.3 | Lead queue | `leads(entity_id, source_document, queries_run, outcome, checked_at)`; max 5 queries per lead, cooldown 30 days | a name from press produces one lead row and three outcomes only | M |
| T3.4 | Alleged claims | press-only claims are written with `status='alleged'`, grade C/D, and contribute 0 weight to the score | a press-only name appears on its page, labelled, and never moves the blade | S |
| T3.5 | Name extraction gate | a press document is extracted only if it names a tracked entity **or** the gazetteer match is ≥ 2 mentions and act-shaped | measured false-positive rate on 50 documents | M |

**Exit check:** a real name that only exists in journalism is visible, sourced and
unranked; a name with a filing outranks it.

---

# P4 — reports (3 days)

**Goal:** articles come from saved queries, not from recollection.

| # | Ticket | Change | Acceptance | Size |
|---|---|---|---|---|
| T4.1 | Saved queries | `register_queries` + `POST /api/register/queries` | a query is reproducible from its stored parameters | S |
| T4.2 | Snapshots | `register_query_rows` frozen on demand, with document hashes | re-running later shows what changed, and the dispatch still cites the frozen set | M |
| T4.3 | Dispatch input | the dispatch pipeline reads a snapshot instead of raw search results | an article's every factual sentence maps to a row id | M |
| T4.4 | Reader surface | a "sources" block on each dispatch, generated from the snapshot | the page lists issuer, number, date, URL per claim | S |

---

# Cross-cutting

**Observability.** `register_runs` per job; daily audit job writing a row; a
single admin page showing: documents/day, claims/day, verification pass rate,
extraction spend, leads open, coverage per universe.

**Cost.** Extraction is the only variable cost. Caps: per run, per connector, per
day; the job stops before the ceiling and logs why. Everything else is free at
this volume.

**Testing.** Three layers: pure unit tests for quote normalisation, claim keys,
weights and confidence; fixture documents (one docket, one PTR, one press item,
one corrupted quote) replayed through the pipeline end to end; SQL invariant
audits on production after each deploy.

**Security and legal.** Documents are stored as text + hash, not republished.
Quotes are bounded (≤ 400 chars) and always attributed. The press connector reads
RSS only — no scraping behind a paywall. Every claim page carries "a claim on the
record, not a verdict".

# The switch: what "proven accurate and insightful" means

The site moves to the register when all six pass, not before:

1. **Quote integrity.** 100% of new claims have a quote that verifies against the
   stored document text; the audit returns zero violations.
2. **Blind check.** 20 claims sampled at random, read against their documents by
   a person: at least 18 supported. Run once per phase; a failure is a blocker.
3. **Person pages.** For the ten most visible names, every claim in the top five
   has a document, a stance and a quote; nothing unquoted is above the fold.
4. **Coverage.** At least one declared universe with a published ratio, and the
   number is not embarrassing (for Congress: 535 listed, ≥ 60% covered).
5. **Score parity.** The register's weight and confidence reproduce the current
   ranking closely enough that the difference can be explained row by row — and
   the user signs off on the new order, because the weights are editorial.
6. **Articles.** One dispatch written entirely from a saved query, with every
   factual sentence mapped to a row id.

During the overlap, both systems run. The pages read whichever view the flag
says; the old tables are frozen, not deleted. Rollback is the flag.

# Milestones

| Milestone | Contents | Estimate |
|---|---|---|
| M0 | P0 complete: writes frozen, audit live, 1,895 documents | 2 days |
| M1 | P1 complete: claims + quotes + resolver + legacy migrated | +5 days |
| M2 | P2 complete: PTR and FEC live, coverage for Congress | +8 days |
| M3 | P3 complete: press class, leads, alleged claims | +5 days |
| M4 | P4 complete: reports drive dispatches | +3 days |

Critical path: P1 → P2. Press and reports can run in parallel by a second pair of
hands without touching the core.

# Risks

| Risk | Mitigation |
|---|---|
| Extraction invents acts | quote verification rejects anything not in the document; extraction is a proposal, the verifier is the gate |
| Gazetteer misses a name variant | alias table + review queue; a missed match is visible as an uncovered entity |
| Connector breaks upstream | cursor unchanged on failure, run log, no partial writes |
| Cost spike | per-run and per-day caps, measured in T2.0 before the second connector |
| The UI drifts from the record | pages read views only; T1.10 parity script before the score flips |
| Scope creep | the non-goals in `architecture.md` are binding |

# Rollback

Every phase is additive. To undo: stop the jobs (cron), flip the UI flag back to
`ledger_entries`, and the site is exactly as it was. No destructive migration
runs before M2; `claims` and `documents` can be dropped without touching the
legacy tables.

# Deliberately later

Vector search, graph UI, multi-language extraction, automated entity merge,
per-article fact-checking, publishing the gazetteer, a public API. None of them
are needed to answer *who, what, how confident, and where is it written*.
