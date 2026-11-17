# A LA GUILLOTINE

A public record of powerful people and the harm they do with power — war,
weapons, repression, extraction, impunity, self-dealing, and money used as
leverage over politics. Not a news aggregator and not a court: a list of names,
each with the sentence from the reporting that states the act, so a reader can
check the claim instead of trusting the site.

Live at **https://alaguillotine.com**.

## The rule

The record is for bad actors. Ordinary politics, advocacy, charity, opposing a
war or a genocide, victimhood and someone else's conduct are not charges.
Anything a machine finds passes `src/lib/act-judge.ts` before it is filed, and
the verdict is cached so the decision can be read and re-run. Every act carries
a passage that is verified against the stored article text.

## Stack

Next.js 15 (App Router) → OpenNext → Cloudflare Worker, with D1 for the record,
R2-free static assets, and crons in `wrangler.jsonc` for discovery, the line
pass, the blade and the wire.

The front page is server-rendered: `src/app/page.tsx` builds the reading with
`buildHateState` (`src/lib/hate-state.ts`) and hands it to
`src/app/home-client.tsx`, so the first HTML already contains the names and the
counts. `/api/hateometer` serves the same state for refreshes; `?lean=1` serves
only the appointment the navbar strip needs.

## Start here

| If you are… | Read |
|---|---|
| an agent picking up work in this repo | [`AGENTS.md`](AGENTS.md) |
| releasing a change | [`DEPLOY.md`](DEPLOY.md) |
| changing the record or the queue | `docs/architecture.md`, `docs/how-names-enter.md` |

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # the only type gate; the production build skips it
```

## Deploying

```bash
bash scripts/deploy.sh     # refuses a dirty tree, typechecks, builds, deploys, verifies
bash scripts/push.sh       # GitHub push with the token on this box
```

A push does not deploy and a deploy does not push. Do both. Details, migrations,
rollback and the Workers Builds caveat are in [`DEPLOY.md`](DEPLOY.md).

## Repository map

```
src/app/            routes; page.tsx is the front page
src/components/     the front end (client components)
src/lib/            the record, the queue, the judge, the intakes
migrations/         numbered D1 schema changes, applied by hand
worker.ts           cron dispatcher
wrangler.jsonc      Worker, D1 binding, cron schedules
docs/               current design notes
docs/history/       dead plans from earlier builds — describes nothing live
```

## Legacy

`scripts/deploy-vps.sh`, `ecosystem.config.cjs`, `nginx-fuckyouelon.conf`,
`data/local.db`, `forum/` and the Appwrite environment variables belong to the
earlier VPS/SQLite build of this site. They are kept for history and do not run
the Worker.
