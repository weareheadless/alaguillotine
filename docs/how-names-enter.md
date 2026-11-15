# How a name enters the archive

Two questions, and they are different: *how does a name arrive*, and *what happens
to it once it does*. Today the first answer is a model reading the news, which is
the bias the register exists to remove. This file records both, so the pipeline
is a decision rather than an accident.

## Today

Four doors write to `queue_people`:

| Door | Code | What decides |
|---|---|---|
| The reading | `hate-store.ts` → `writeQueue` | a model ranks the week's reporting and names the public figures it holds responsible |
| Sanctions | `sanctions.ts` | a UN listing inside the 180-day window |
| Proposals | `submissions.ts` | a reader proposes a name and an admin approves it |
| Congress | `api/congress/refresh` | the chamber's own votes |

Once a name is in the queue, `coverage.ts` registers it in `name_investigations`
(status `pending`), and `runCoverageBatch` gives it **one bounded first look**:
a handful of web searches per angle in `dossier.ts` (money, power, migration,
war, labour, climate, courts, foreign dealings), an extraction into
`ledger_entries` with `review_status = 'pending'`, then the citation check and a
grade. "Nothing found" is recorded. After that the name is re-read only when it
is the stalest `done` row.

### Where that leaks

1. **The news decides who is in the archive.** The reading door is the widest
   one, and it inherits whatever the wire covers. That is the mechanism that
   produces a record which looks one-sided without anyone choosing a side.
2. **One look is not an investigation.** Search returns what is indexed and
   ranked, not what is filed. Two people with identical conduct get different
   records depending on which one a search engine serves.
3. **A proposal is a lead treated as a finding.** Approving a name gives it a
   queue row, a score and a place in the line before a single document exists.
4. **No population is declared**, so the gap between "who is covered" and "who
   exists" cannot be measured at all.

## Where sources sit, and why government APIs are only one class

| Class | Examples | What it is good for |
|---|---|---|
| Finding | ICC warrant, judgment, verdict, inquiry, regulator | the act, and the characterisation, without us minting it |
| Record | roll call, contract, gazette, sanctions listing, company filing | what the state cannot unsay |
| Admission | the actor's own statement, order, press release | the act, in their words |
| Report | named journalism, field investigation, testimony, OSINT | what no register contains |
| Allegation | an accusation with nothing behind it | finding out where to look |

Government registers are the strongest class for the acts they record and the
weakest for the acts they omit, which are usually the ones that matter. They are
one part of the story: what the state wrote down. The rest is what it didn't.

## Confidence is arithmetic

`src/lib/confidence.ts` turns a set of artifacts into a grade the reader can
check: the stance sets the base, independence adds a capped bonus, an undated
act is capped at C, and a passage that does not name the person is not a weak
claim but no claim at all. The components are stored in
`ledger_entries.confidence_basis` and shown with the claim, because "82%
confident" without the working is a horoscope.

Two rules carry most of the weight. **Independence:** a story citing another
story is one origin, tracked through `documents.derived_from`, because a wire
item reprinted twelve times is still one artifact. **No borrowed authority:** an
admission documents the act and tells you nothing about intent, and a state's
inquiry into itself is a deduction rather than a finding.

## Under the register

A name enters by exactly three routes, and each has a document at the end of it:

1. **Universe membership.** The population is declared first — every member of
   Congress, the largest federal contractors, every OFAC designation in the
   year — and membership is enumerated from the issuer's own roster. Being in
   the population is not an accusation; it is what makes the gaps countable.
2. **A document names them.** A docket defendant, a PTR filer, a contract
   recipient, a sanctions entry. The entity is created because a document
   contains it, not because a story mentioned it.
3. **An edge.** A document that states a relationship — this person owns 12% of
   that company, this foundation funds that committee, this minister appointed
   that director — puts the far end of the edge in the archive without any
   claim about them. The edge is a fact from a filing; the claim, if there is
   one, still needs its own document. This is the route that reaches people no
   roster contains and no story names: the financier's name is not in the
   article, it is in the contribution schedule.
4. **A lead.** A reader proposal, a tip, a wire story. A lead creates an
   `entity` and a **search target**, never a claim. It becomes part of the
   record only when a document is found; if the searches come back empty, that
   outcome is recorded and the name does not enter the line.

### Three modes, and why one is not enough

| Mode | Reaches | Blind to |
|---|---|---|
| **Universe enumeration** (top-down) | everyone on a declared roster: members, contractors, designations | anyone without a roster, which is most of the world |
| **Event discovery** (bottom-up) | whoever a document names in an act: the minister who signed, the commander whose unit shelled the town | the people who paid, because paying is not an act with a defendant |
| **Edge traversal** (relational) | owners, directors, donors, funders, appointees — two hops out | nothing on its own; it is how the other two reach the money |

Universes alone would make the archive a directory of officialdom: every member
of Congress, no arms dealer, no funder. Events alone make it a mirror of the
press. Edges are what turn a contract into a person, a foundation into a donor,
a company into its owner.

The documents that make an edge possible are ordinary and public: FEC itemised
contributions and independent-expenditure reports, IRS 990 officer and grant
schedules, SEC 13D/G and Form D, Companies House persons with significant
control, EU beneficial-ownership registers, lobbying disclosures (LD-2), FARA
filings, procurement awards and their subcontracts.

The limit is two hops, and it is deliberate. A contract to a company, the
company to its owner, is a finding. The owner's cousin's foundation is how a
site becomes a conspiracy diagram.

### What "investigated" then means

For a person, investigation is **document enumeration**, not a web search:

- ask every connector for documents naming the entity (dockets, filings,
  contracts, votes, sanctions);
- for each document, extract the act into a claim with the quote and the
  locator, and attach it through `claim_documents`;
- run the citation check against the document itself, not against a summary;
- re-run when the connector sees a new document.

Press search survives as a **fallback for entities no connector covers**, and
anything it produces is tagged as press (`documents.kind = 'press'`), so a
reader can see the difference between a filing and an article. It can support a
claim; it cannot outrank one.

### What a lead can and cannot do

A proposal names someone. That is useful: it says where to look. It cannot
produce a claim, a score, or a place in the line. If the register finds no
document, the honest output is *"proposed, nothing on file"* — which is a result
the site can publish, and a better one than a rank built on a hunch.

### What counts as a document

Not only what an institution files. A state that commits the act writes most of
the paperwork, and the people who are never indicted tend to have the best
lawyers, so an archive of filings alone would record the careful and miss the
catastrophic. The artifact can be any of these, provided it is named, dated and
pointed at:

| Stance | Artifact | What it establishes |
|---|---|---|
| `admits` | the actor's own statement, release, order, filing | the act, as they describe it |
| `finds` | judgment, verdict, arrest warrant, indictment, inquiry, regulator | the act and, where the finding says so, the characterisation |
| `records` | contract, gazette, vote, sanctions listing, company filing | the act, as a register entry |
| `reports` | named journalism, field investigation, witness testimony, OSINT | the act, attributed and graded |
| `alleges` | an accusation with no artifact | nothing. A lead, never a claim |

The admission row is the one that does the most work in the hard cases. A
spokesperson announcing the strike has documented the strike; what they deny is
the characterisation, and the characterisation is its own row, sourced to
whoever made the finding. A denial that concedes the act ("we did not target
civilians") is a document of the act.

Where no finding exists, the claim carries the act and the category it belongs
to — arms, war, repression — with the characterisation marked alleged and
attributed to its source. What it never does is borrow a crime label from the
archive's own opinion. And repetition is not evidence: a second outlet quoting
the first is one artifact, not two.

### The international case

Most of the events the wire carries happen where no roster exists. There the
document that names a person is usually official rather than commercial: an ICC
warrant or indictment, a UN panel or fact-finding report, a national gazette, a
sanctions determination, a court judgment, a commission of inquiry. Those name
commanders, ministers and owners directly. Where they name a state or a unit
instead, the chain is the finding: the unit, its commander, the ministry that
armed it — each edge from a document, each claim from its own.

### Retirement

A name is not dropped for being unremarkable. It is dropped when its universe
no longer includes it, or when a declared number of document searches returns
nothing — and either way the outcome is written down, because an empty record is
evidence about our coverage, not about the person.
