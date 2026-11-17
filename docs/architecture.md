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

### Three numbers, never confused

| Number | Question it answers | Where it comes from |
|---|---|---|
| **confidence** | is the claim true, and how well sourced | stance, independent origins, specificity |
| **weight** | how bad is the act | category base × grade × documented magnitude |
| **standing** | who do we look at first | documented wealth and public money, never a charge |

Confidence is about evidence, weight is about harm, standing is about attention.
A rich person has standing and no automatic weight. A thin claim has neither.

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
| Roll calls (European Parliament RCV XML) | roll_call | free, published |
| Register of Members' Financial Interests (UK Commons) | register | free, official CSV/API |
| Press (six published feeds) | press | free, RSS, gazetteer-gated |
| Press RSS (allow-list) | press | free |
| Field investigations, OSINT | report | free, manual |

Every connector has a declared budget (documents/day) and a declared universe
(what population it is expected to cover). A connector that returns nothing for
its universe is a finding, not a quiet day.

### One register, many bodies

The register is about everybody, and "everybody" is not one population. A
universe therefore declares the country and the body it enumerates:

```
universes(id, name, country, body, body_key, definition, source_url, expected, declared_at)
```

`country` is empty when the body spans countries, as the European Parliament
does; that is a fact about the body, not a missing value. `body_key` is the
stable name rules are scoped by. Coverage is computed and published per
universe, never summed across them: a ratio over the US House and the European
Parliament together would describe a body that does not exist.

A register document is not automatically an accusation. `accused` is set by a
passage that reports, finds or alleges a misdeed; a document that records a
filing or admits one is `documented`, not `accused`. The distinction is a field
on the claim (`finding`: `none | alleged | found | admitted`), not a property
of the source class. A press document says where the passage was published; the
passage says whether it is about a misdeed. Declaring a conflict is not
admitting one. The European Parliament's
conflict declarations are the test case: 40 filings about declared conflicts,
none of them a finding.

Committee jurisdiction is a rule about one body. "Armed Services oversees
defence procurement" is a US House rule; "the Treasury Committee oversees banks"
is a UK Commons rule. The mapping is stored with `body_key` so one can never be
applied to another parliament by accident, and every lead prints the body, the
rule and both citations.

A rule is matched against a disclosed fact, not a hunch: an asset name from a
periodic transaction report in the US, or the member's own register entry in the
UK — the summary and the named fields that carry employer, payer and company.
Sub-committees carry a `parent_code`, so a seat on the Treasury Sub-Committee on
Financial Services Regulations inherits the Treasury rule instead of silently
producing no leads.

Adding a body is a declaration and a connector, not a code path. The European
Parliament is `ep-10`, enumerated from its own open-data list, with the
Parliament's person id as the external id; its roll-call XML is the second
document class read against a second population. The UK Commons is
`uk-commons-59`, enumerated from the Members API and joined to the register by
MNIS id; its bulk CSV ZIP is one document per member, because that is how the
register itself is organised.

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

**A structured record is a field, not a sentence.** A roll call, a PTR line, a
docket entry, a contract award: the fact is a column with a value, and reading it
as prose is how a machine invents a passage. The first re-grounding pass
"verified" 3,591 vote claims because the surname sits in the member list and the
bill number sits in the header — the extracted quote was the page header. So
each such document class gets a parser, not a matcher, and its claims are compared
field by field:

| Claim says | Record says | Status |
|---|---|---|
| Voted Yea | Yea / Aye | `recorded`, confidence 0.95 |
| Voted Yea | Nay / No | `refuted` — the record contradicts the sentence |
| Voted Yea | Not Voting / Present | `refuted`, with the actual field shown |
| Voted Yea | member absent from the file | stays `legacy`, counted as unverified |

The passage stored is the exact substring the value was read from — byte for
byte, not a reconstruction from parsed attributes, because a quote that is not
in the document is not a quote. A recorded vote is a fact about the chamber, not
a finding of wrongdoing; it carries no weight by itself. It is the spine that
money attaches to.

**The money layer is a PDF, and a PDF is not a document you can skim.** A
periodic transaction report is encrypted with an empty password, sets its text in
CID fonts with no Unicode map, and prints a table with no table markup. Reading
it takes decryption, a font map and an inflater inside the connector, and the
result is still only a row: owner, asset, type, date, disclosed band. The band is
stored as a band. The claim says what the filing says — bought, sold, how much,
when — and never that the trade was wrong. A trade is a fact about a portfolio;
conflict is a question the reader asks with the committee list in hand.

### 3. Resolution → entities, edges

Names to entities, once: exact match on alias, then on external id, then a
review queue for the ambiguous. Edges come from the same documents (ownership,
appointment, contribution, award) and carry the document that states them. Two
hops, never three.

### 4. Verification → status

The verifier recomputes, for each claim: does the quote still appear in the
document text, what stance does each source hold, how many independent origins,
and therefore what grade and score. It writes `confidence`, `confidence_basis`
and `status` (`legacy | alleged | reported | recorded | refuted | found |
admitted | superseded`). A document
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
       date_precision, amount, currency, confidence, confidence_basis, status,
       claim_key, supersedes, created_at)
claim_documents(claim_id, document_id, quote, locator, stance)
claim_entities(claim_id, entity_id, role)         -- payer, beneficiary, owner
entity_edges(id, from_entity, to_entity, kind, since, amount, currency,
             document_id, quote)
universes(id, name, country, body, body_key, definition, source_url, expected, declared_at)
universe_members(universe_id, entity_id, status)
```

Derived, rebuilt by the publish job: `v_entity_record` (what the person page
reads), `v_coverage` (declared populations vs rows), `v_source_mix` (which
document classes back an entity's record). `ledger_entries` is frozen at 6,082
rows and read only through `v_entity_record`, so the UI never learns that the
storage changed.

As built: `v_entity_record` does not exist. `getLedgerFor` in `archive-store.ts`
stands in for it — the same claims, joined to their entity and document, with
the legacy ledger merged underneath by act. The archive reads the same tables
through `readArchive`, so the two pages cannot count different things. A person
page exists only for a name standing in the line; every other name is read in
the archive, and `/person/<slug>` redirects there.

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

### The reader's surface

There is one dashboard (`/archive`, labelled "The Record"), not a page per
concept. It opens on the latest acts with a stored passage — votes and
unverified rows excluded, because neither is a finding — and every row expands
to the passage and the document under it. Search, body, kind, topic and year are
filters on the same query, and the counts in the header are the register's own:
claims, documents, people, passages.

Coverage and leads stopped being destinations. Coverage was a page explaining
the register's completeness; its counts now sit in the dashboard header and its
bodies are filter chips. Leads were a join of a seat and a disclosure; the
dashboard queries the two claims and leaves the join to the reader. Both old
URLs redirect, so no link rots, but there is one place to look.

A name is a filter, not a page: `?entity=<id>` narrows the same query, and the
header becomes that person's claims, passages, findings and documents. Sort is
newest, confidence or largest amount. There is no invented harm score; the
reader chooses the order, and the passage does not change with it.

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

## Weights: harm, magnitude, standing

The current weights are indefensible as they stand: genocide 1.0, war 0.9,
repression 0.8, arms 0.7, climate and impunity 0.6, labour and extraction 0.5,
**finance 0.4**. Under those numbers no financier can outrank a commander, no
matter what the filings say. That is a political position hidden in a constant.

But "a billionaire is extraction by default" cannot replace it, because it breaks
the law the rest of the system rests on: no claim without a document. Wealth is
an outcome. Inheritance, a product people bought, a monopoly, a fraud and a
currency collapse all end in the same balance sheet, and calling the balance
sheet the proof makes every citation on the site decoration. It also hands the
other side the only argument it needs: *they say being rich is a crime.*

So the weight changes in three ways, and only one of them is about the actor.

**1. Magnitude, per act.** Each claim carries `amount` and `currency`, taken from
the document. The weight of an act rises with what moved, on a log scale, so a
$10B transfer outranks a $50k fine without anyone deciding that money is evil:

```
magnitude = 0.6 + 0.4 × min(1, log10(1 + amount / 1e6) / 5)     -- pivot $1M, cap $100B
weight    = category_base × grade × magnitude
```

**2. Flatter category bases.** With magnitude doing the work, the bases can stop
carrying a partisan ranking: genocide 1.0, war 0.85, repression 0.8, arms 0.75,
extraction 0.7, finance 0.7, impunity 0.65, climate 0.6, migration 0.65, labour
0.6, media 0.5. A documented $20B subsidy now beats a documented $2M arms deal,
which is the point.

**3. Wealth as standing, not as proof.** The sourced numbers already in
`person_numbers` (holdings, public money received, tax paid) are displayed on the
record and decide **attention**: who gets connectors first, who gets a first-look
dossier. They never create a claim and never enter the score. A reader can see
$400B and draw their own conclusion; that is the reader being the judge, which is
the whole design.

What this buys: a financier can top the blade on documented transfers of public
money, because the documents describe the transfers. Being rich adds nothing to
the score, so the site cannot be dismissed for asserting that it is a crime.

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
