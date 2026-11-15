# The register — target architecture

Status: proposal, not yet built beyond the core tables in migrations
0029–0032. This file is the plan to build against; the site keeps working
throughout because the boundary is a view, not a rewrite.

## What is actually there now

Measured on the production database, 15 Nov 2026:

| | |
|---|---|
| claims in `ledger_entries` | 6,082 |
| claims with an evidence quote | **4** |
| claims with a mechanism recorded | 21 |
| claims with a beneficiary recorded | 21 |
| claims with an institutional status | 24 |
| claims that passed a citation check | 65 |
| distinct source URLs | 1,895 |
| distinct person strings | 483 |
| names ranked in the line | 45 |

Six thousand sentences, each with an array of URLs, almost none with the passage
they came from, none joined to a document, and no identifiers to join them to
anything else. That is not a database. It cannot be audited, so it cannot be
trusted at scale, and every article built on it is built on prose that nobody can
re-verify without redoing the research.

The causes are structural, not bugs:

1. **Three intakes.** Lemmy for the feed, a search API for the queue, and a
   search dossier per name for the record. Each has its own bias and its own
   definition of "news".
2. **The claim is the unit.** A claim is a sentence written by a model from a
   search result. The document it came from is discarded, so nothing can be
   re-checked when the model changes.
3. **Names are strings.** No identifier means no join, no alias handling, no
   ownership, no funding, no traversal.
4. **The rank is the product.** The queue decides who is investigated, so the
   news decides who exists in the archive.

## Five laws

1. **Everything is a document.** A docket, a roll call, a PTR, a contract, a
   press release, a field investigation, a video. One table, one shape, with
   issuer, number, date, URL, hash and provenance. No source exists outside it.
2. **No claim without a quote that verifies.** A claim must carry a quote and a
   locator, and the quote must be found in the stored text of the document. If
   it is not, the claim does not exist — this is checked mechanically, per claim,
   at write time and again on every re-fetch.
3. **Every actor is an entity.** Claims reference `entities`, never a typed name.
   Resolution happens once, at write time, with aliases and external ids.
4. **One writer per table.** Each table is written by exactly one job. Jobs are
   idempotent, leased, and resumable; a failed pass leaves rows in a known state.
5. **Confidence is computed and shown.** Stance plus independent origins plus
   specificity, with the working attached. The reader is the judge; the site
   never labels a crime on its own authority.

## Pipeline

```
connectors ──▶ documents ──▶ extraction ──▶ claims ──▶ verification ──▶ read models
   (fetch)      (+ text)      (gazetteer)    (+ quote)   (quote, stance)   (views, API)
                                   │
                              resolution ──▶ entities, edges
```

Four stages, one direction. No stage may write outside its own tables.

### 1. Connectors → documents

A connector is a small function with a cursor: `(source, cursor) → documents,
nextCursor`. It may page, it may be rate-limited, it never writes claims and
never ranks anything. Each document gets `content_hash`, and its text goes to
R2 (`text_ref`); D1 keeps the metadata.

| Connector | Kind | Cost |
|---|---|---|
| CourtListener / RECAP | docket, filing | free API |
| House Clerk + Senate PTRs | ptr | free, published |
| SEC EDGAR full-text | filing | free |
| FEC (contributions, IEs) | fec | free key |
| USAspending / TED | contract | free |
| Companies House / EU registers | registry | free |
| OFAC / EU sanctions | sanction | free |
| Roll calls (Clerk, Senate) | roll_call | free |
| Press RSS (allow-list) | press | free |
| Field investigations, OSINT | report | free, manual |

Every connector has a declared budget (documents/day) and a declared universe
(what population it is expected to cover). A connector that returns nothing for
its universe is a finding, not a quiet day.

### 2. Extraction → claims

Extraction is the only place that spends money, and it is gated by the
**gazetteer**: the list of entities the site tracks, with aliases and external
ids. A document is extracted only if it matches the gazetteer, or if it is from a
connector whose universe is being enumerated (then extraction creates new
entities).

- Model call per document, capped length, structured output.
- Output: one row per act — actor, act, category, mechanism, beneficiary, date,
  quote, locator.
- The quote must be a substring of the document text (normalised); otherwise the
  row is rejected with the reason stored.
- `claim_key = hash(entity_id, normalised act, act_date)`; re-extraction updates
  instead of duplicating.

This is what keeps the $0.50/day budget: we do not read the web, we read
documents that name people we already track, plus the declared populations.

### 3. Resolution → entities, edges

Names to entities, once: exact match on alias, then on external id, then a
review queue for the ambiguous. Edges come from the same documents (ownership,
appointment, contribution, award) and carry the document that states them. Two
hops, never three.

### 4. Verification → status

The verifier recomputes, for each claim: does the quote still appear in the
document text, what stance does each source hold, how many independent origins,
and therefore what grade and score. It writes `confidence`, `confidence_basis`
and `status` (`alleged | reported | recorded | found | admitted`). A document
that changes upstream and no longer supports the quote flags the claim
`superseded` — it does not silently stay.

## Tables

Core, written by one job each:

```sql
entities(id, kind, name, slug, country, created_at)
entity_aliases(alias, entity_id, source)          -- replaces the JSON column
entity_ids(scheme, value, entity_id)              -- bioguide, cik, lei, fec
documents(id, kind, issuer, title, number, url, published_at, fetched_at,
          content_hash, text_ref, derived_from, provenance, self_serving)
claims(id, entity_id, act, category, mechanism, beneficiary, act_date,
       date_precision, confidence, confidence_basis, status, claim_key,
       supersedes, created_at)
claim_documents(claim_id, document_id, quote, locator, stance)
claim_entities(claim_id, entity_id, role)         -- payer, beneficiary, owner
entity_edges(id, from_entity, to_entity, kind, since, amount, currency,
             document_id, quote)
universes(id, name, definition, source_url, expected, declared_at)
universe_members(universe_id, entity_id, status)
```

Derived, rebuilt by the publish job: `v_entity_record` (what the person page
reads), `v_coverage` (declared populations vs rows), `v_source_mix` (which
document classes back an entity's record). `ledger_entries` is frozen at 6,082
rows and read only through `v_entity_record`, so the UI never learns that the
storage changed.

## Query surface

```
GET /api/q/claims?entity=&category=&from=&to=&minConfidence=&stance=&document=
GET /api/q/entity/:slug            → claims + sources + coverage
GET /api/q/coverage?universe=
POST /api/q/report                 → save a query, freeze its result as a snapshot
GET /api/q/report/:id              → the frozen rows an article cites
```

Every row returns: entity, act, date, category, confidence **and its basis**, and
for each source: stance, provenance, issuer, URL, quote. A report is a saved
query plus a row snapshot, so an article cannot silently drift from the data it
was written on.

## The loop: a name arrives from the paper

This is the part that keeps the archive from becoming a directory of officialdom.
A press document is a document like any other, stance `reports`, and it is the
surface that names people no roster contains.

```
press document ──▶ names extracted ──▶ entity (lead)
                                          │
                        bounded document lookup across connectors
                                          │
        ┌─────────────────────────────────┼──────────────────────────────────┐
        ▼                                 ▼                                  ▼
  document says it                 credible reporting, no document      nothing found
  claims filed, status             claim filed as `alleged`             no claim, outcome
  `reported`/`recorded`            (grade C or D, cannot rank)          recorded `no documents`
  ranks on evidence                visible, attributed, cited           not in the line
```

All three outcomes are published, because "we looked and found nothing" is
information about our coverage, not about the person. What the line will not do
is rank an entity on a press claim alone: an `alleged` claim contributes zero
weight, so a name can be known to the archive and still not stand under the
blade until something is filed.

The lookup is bounded and cheap by construction:

- one lead, up to five connector queries (name, aliases, external ids), then an
  outcome is written whether or not anything was found;
- an entity is searched again only when a connector publishes something that
  matches it, or after a cooldown — never in a loop;
- every lead ends in a row: `found`, `alleged` or `none`, with a date, so the
  backlog of names we have looked at is countable.

That is also how the gazetteer grows. A name that arrives from the paper and
later acquires a document stays tracked, so the next connector run picks it up
without anyone remembering to add it.

## Cost

| Item | Per day |
|---|---|
| Connector fetches | free (rate limits only) |
| Document storage (R2) | pennies at this volume |
| Extraction | the only real cost, bounded by the gazetteer match rate |
| Verification, publish | free (D1 queries) |

Budget guard: extraction takes a per-run cap and a per-connector cap, and stops
before the daily ceiling. A connector that suddenly matches everything gets
throttled rather than draining the day.

## Phases, each shippable alone

**P0 — stop the bleeding (2 days).** Freeze new writes to the legacy path so the
archive stops growing unverifiable rows. Backfill `documents` from the 1,895
distinct URLs so every existing claim has a document row. Audit query reports
claims with no quote, no document, or a name/entity mismatch.

**P1 — the core (3–4 days).** `claims` table + quote verification + entity
resolution. Migrate the 6,082 rows as `legacy` (kept, unquotable, visibly
unverified). `v_entity_record` serves the current person pages unchanged.
Acceptance: every *new* claim has a quote that verifies; a deliberately corrupted
quote is rejected in a test.

**P2 — two connectors end to end (1 week).** PTRs and FEC. Fetch → extract →
resolve → verify → query. Acceptance: `/api/q/claims?entity=<member>` returns
trades with filings attached; the coverage panel says 535 expected, N enumerated,
M covered.

**P3 — press as a document class (1 week).** Allow-listed outlets and
individuals, RSS only, stance `reports`, gazetteer match required. New names
arrive as `alleged` claims and cannot rank until a second independent origin or a
record supports them. Acceptance: a name that exists only in press shows as
alleged, with its source and grade, and does not move the blade.

**P4 — reports (3 days).** Saved queries and snapshots; the dispatch pipeline
writes from a report instead of from raw search results.

## Non-goals

No graph database, no vector search, no per-user ranking, no multi-tenant logic,
no real-time. D1 and a handful of tables are enough at 10⁴–10⁵ rows; the point is
the invariants, not the infrastructure.

## What this buys

- **"Why is this person here"** always has an answer: a universe, a document, or
  an edge, with a link.
- **"How confident"** is a computation with a visible working, not a grade
  assigned by whoever was reviewing that day.
- **"Are we biased"** is a query against declared populations and source classes,
  published, rather than an argument.
- **Articles** come from saved queries, so every sentence in a dispatch can be
  traced to rows that still say the same thing.
