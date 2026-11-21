# A LA GUILLOTINE — working notes for an agent

Read this first. It is the shortest path from "I just landed in /FYE" to
"my change is live and the repository still describes production".

## What this is

A public record of powerful people and the harm they do with power: war,
weapons, repression, extraction, impunity, self-dealing, and money used as
leverage over politics. One Next.js app, one Cloudflare Worker, one D1 database.

The editorial rule is the product:

- **A row is a claim with a passage behind it.** Every act links to the stored
  text of the article and the sentence that states it. The rule is enforced in
  SQL by `PASSAGE_SQL` (`src/lib/passage.ts`) and gates the archive, person
  pages, the score and the charge count: if the quote is not found in the
  stored article text, the row is not on the record. Never invent a name, a
  number, a date or a URL.
- **The record is for bad actors.** Ordinary politics, advocacy, charity,
  opposition to a war or a genocide, victimhood and someone else's conduct are
  not charges. `src/lib/act-judge.ts` is the written form of that rule and it
  runs before a machine-found act is filed.
- **One record.** The homepage line, `/archive`, `/person/<slug>` and the queue
  score read the same claims. If an act is retracted it leaves all of them.
- **The act is printed with the argument for it.** `claims.take` is Ada's
  reading of why the act counts; it is shown under the act on the profile, the
  archive and the front page's appointment block. A take that only restates the
  act is rejected rather than stored.
- **Keep the reason, and let it be challenged.** A sentence snapshots its charge
  and the acts behind it into `chop_sentences`/`chop_events`; the profile shows
  every execution with the reason recorded at the time. Every public claim has a
  challenge button; upholding a challenge writes `status='retracted'` and runs
  `rescoreQueue`, so it leaves the page, the score and the archive together.
- **No manual per-case rows.** Discovery, the line pass and the findings ingest
  find names; nothing is hand-entered.

## Where everything is

| Path | What it is |
|---|---|
| `src/app/page.tsx` | Server component: builds the reading, renders `home-client.tsx` |
| `src/app/home-client.tsx` | The front page itself (client) |
| `src/lib/hate-state.ts` | `buildHateState` — the one reading shared by page and API |
| `src/lib/archive-store.ts` | The record: `getLedgerFor`, `readLedgerSummaries`, scoring |
| `src/lib/findings-query.ts` | `/archive` query; `PRESS` excludes retracted claims |
| `src/lib/act-judge.ts` | The judge: actor + harm + category, cached in `act_verdicts` |
| `src/lib/claim-take.ts` | Ada's take per claim (`claims.take`): why the act counts, not what happened |
| `src/lib/passage.ts` | `PASSAGE_SQL` — the rule that a row needs a verifying quote |
| `src/components/BrokenTV.tsx` | The fixed broken-signal overlay: scanlines, tears, full-frame slogans, the switch |
| `src/components/ChallengeClaim.tsx` | The per-claim challenge form on profiles and the archive |
| `src/app/api/challenges/route.ts` | Public POST: file a challenge against a claim |
| `src/app/api/admin/challenges/route.ts` | Review: uphold (retract) or reject a challenge |
| `src/lib/discovery.ts`, `line-ingest.ts`, `findings-ingest.ts` | The three intakes |
| `src/lib/hate-store.ts` | The queue, chops, sentences, `rescoreQueue` |
| `worker.ts` | Cron dispatcher — every schedule in `wrangler.jsonc` lands here |
| `migrations/` | Numbered SQL, applied by hand (see `DEPLOY.md`) |

`docs/` holds the current design notes; `docs/history/` holds dead plans from
earlier eras and describes nothing that runs today.

## Release rule

**A deploy must come from a clean, committed tree.** The repository has to
describe what is live, or the next person cannot tell what production is.

```bash
cd /FYE
git status --short          # must be empty
bash scripts/deploy.sh      # typecheck, build, deploy, verify
git push                    # scripts/push.sh if the remote asks for a password
```

- Never run `npx opennextjs-cloudflare build` by hand and skip the flag: the
  installed Next is past the supported window and the build refuses without
  `--dangerouslyUseUnsupportedNextVersion`. `scripts/deploy.sh` already does it.
- Never run `scripts/deploy-vps.sh`. That is the retired systemd app on
  fuckyouelon.net:3002, not the Worker.
- Do not rebuild after inspecting the artifact. Build once, deploy once.
- If another session is working in `/FYE`, commit or stash first. An uncommitted
  tree is how the live build stopped matching GitHub on 16–17 Nov 2026.

Full runbook, secrets, migrations, rollback: **`DEPLOY.md`**.

## Environment facts

- Worker `alaguillotine`; D1 `alaguillotine-content`
  (`830aa6e6-d1bb-4cfa-98cf-b7c8e5284755`); domains `alaguillotine.com` and
  `www.fuckyouelon.net`.
- Cloudflare credentials: `/SOCIAL/configs/cloudflare.env`
  (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`). Source it, never copy it.
- Admin key for `/api/admin/*`: `ADMIN_KEY` in `/FYE/.env.local`, sent as
  `x-admin-key`. Not the cron secret.
- GitHub: `weareheadless/alaguillotine`, token at
  `/home/admin/.config/opencode/github-pat`.
- Node must be v22 (`/home/admin/.local/bin/node`). The box has older nodes on
  `PATH` that produce confusing build failures.

## Checks before you claim something works

```bash
npm run typecheck                      # the only type gate; next build skips it
curl -s -o /dev/null -w '%{http_code}\n' https://alaguillotine.com/
curl -s https://alaguillotine.com/api/hateometer?lean=1 | head -c 200
```

For content changes, check the HTML itself, not just a 200: the record is
server-rendered now, so the names and counts are in the response body.

## What is legacy and can be ignored

`scripts/deploy-vps.sh`, `ecosystem.config.cjs`, `nginx-fuckyouelon.conf`,
`data/local.db`, the root `forum/` theme, and the Appwrite environment variables
all belong to the earlier VPS/SQLite/Appwrite build. They are kept for history.
They do not run the Worker.
