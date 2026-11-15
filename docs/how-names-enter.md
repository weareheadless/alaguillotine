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

## Under the register

A name enters by exactly three routes, and each has a document at the end of it:

1. **Universe membership.** The population is declared first — every member of
   Congress, the largest federal contractors, every OFAC designation in the
   year — and membership is enumerated from the issuer's own roster. Being in
   the population is not an accusation; it is what makes the gaps countable.
2. **A document names them.** A docket defendant, a PTR filer, a contract
   recipient, a sanctions entry. The entity is created because a document
   contains it, not because a story mentioned it.
3. **A lead.** A reader proposal, a tip, a wire story. A lead creates an
   `entity` and a **search target**, never a claim. It becomes part of the
   record only when a document is found; if the searches come back empty, that
   outcome is recorded and the name does not enter the line.

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

### Retirement

A name is not dropped for being unremarkable. It is dropped when its universe
no longer includes it, or when a declared number of document searches returns
nothing — and either way the outcome is written down, because an empty record is
evidence about our coverage, not about the person.
