# Deploying the Worker

The live site is a Cloudflare Worker (`alaguillotine`) built with OpenNext and
served on `alaguillotine.com` with D1 behind it. There is no server to restart
and **a GitHub push does not deploy**.

## The one command

```bash
cd /FYE
git status --short        # must be empty — see "Why the tree must be clean"
bash scripts/deploy.sh
```

`scripts/deploy.sh` does:

1. refuses if the working tree has uncommitted changes (unless `--allow-dirty`,
   which should only be used if you know the artifact is disposable),
2. checks Node is v22 (`/home/admin/.local/bin/node`),
3. runs `npm run typecheck`,
4. builds: `TMPDIR=/var/tmp/opencode-build npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion`,
5. deploys: `npx wrangler deploy`,
6. fetches `/`, `/archive` and prints the version id.

It needs Cloudflare credentials in the environment, which the script sources
itself from `/SOCIAL/configs/superincompetence-cloudflare.env`
(`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`).

## Doing it by hand

```bash
cd /FYE
set -a && source /SOCIAL/configs/superincompetence-cloudflare.env && set +a

npm run typecheck
TMPDIR=/var/tmp/opencode-build \
  npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion

npx wrangler deploy            # uploads the artifact and promotes it to 100%
```

The flag is required, not optional: the installed Next is 15.5.29, past the
version OpenNext supports, and the build exits with an error without it. If Next
is upgraded or pinned back inside the window, remove the flag from
`package.json` and `scripts/deploy.sh` in the same commit.

`wrangler deploy` uploads and promotes in one step. If you prefer the two-step
form the platform also supports it:

```bash
npx wrangler versions upload
npx wrangler versions deploy <version-id>@100%
```

Do not rebuild between those two — the point is that the uploaded artifact is
the one that gets promoted.

## Why the tree must be clean

On 16–17 Nov 2026 the Worker was repeatedly built from a dirty `/FYE` while
another session was editing it. The live site ran code that was in no commit,
and `api/posts/ingest`, `api/register/rollcall` and `DoomMeter` were live for a
day without being on `main`. Anyone reading the repository got a different
program from the one users were using. Commit first, then build.

If a session has work in progress you do not want to ship, commit it or move it
out of the tree before deploying — do not deploy around it.

## Migrations

Schema changes are numbered SQL files in `migrations/` and are applied by hand
to the remote database before (or with) the code that needs them:

```bash
set -a && source /SOCIAL/configs/superincompetence-cloudflare.env && set +a
npx wrangler d1 execute alaguillotine-content --remote --file migrations/0050_act_verdicts.sql
```

D1 is `alaguillotine-content` (`830aa6e6-d1bb-4cfa-98cf-b7c8e5284755`).
Check it afterwards, e.g. `SELECT name FROM pragma_table_info('feed_items')`.

## Crons

`wrangler.jsonc` holds the schedules; `worker.ts` maps each one to a route.
After a deploy, `npx wrangler deploy` prints them. The important ones:

| Schedule | Route | What it does |
|---|---|---|
| `*/15 * * * *` | `/api/hateometer/tick` | sentence a name, drop the blade |
| `7,22,37,52 * * * *` | `/api/findings/line` | read the line's names for acts |
| `2,17,32,47 * * * *` | `/api/findings/discover` | find new names from power terms |
| `*/5 * * * *` | `/api/feed/refresh`, `/api/posts/refresh` | the wire |
| `0 7 * * *` | `/api/congress/refresh` | roll calls |

## Rollback

```bash
npx wrangler deployments list
npx wrangler versions deploy <previous-version-id>@100%
```

Retracting a claim is separate from a deploy: set `claims.status = 'retracted'`
and `rescoreQueue` will move the counts. `/api/admin/judge?reset=1` clears the
verdict cache when a rubric changes.

## Admin endpoints

`/api/admin/*` require the `x-admin-key` header with `ADMIN_KEY` from
`/FYE/.env.local`. Example:

```bash
KEY=$(grep '^ADMIN_KEY=' /FYE/.env.local | cut -d= -f2-)
curl -sS -X POST -H "x-admin-key: $KEY" \
  "https://alaguillotine.com/api/admin/judge?limit=40"
```

## GitHub is not wired to the Worker

Every deployment in this account shows `source: wrangler`; nothing was ever
built by Cloudflare from the repository, and the shared Cloudflare tokens lack
the Workers Builds scope, so the trigger cannot be created by API from this box.

To make a push deploy, either:

- connect the repo in the dashboard — Workers → `alaguillotine` → Settings →
  Build → connect `weareheadless/alaguillotine` with the GitHub App, and give it
  a build command of `npm run build:worker` plus the temporary
  `NEXT_UNSUPPORTED=1`-style flag the Next version needs; or
- issue a token with **Workers Builds: Edit** and create the trigger by API.

Until then: **push the commit and deploy the Worker separately.** They are two
actions, and the repository is only honest if you do both.

## Pushing

`origin` is `weareheadless/alaguillotine`. The remote needs the token at
`/home/admin/.config/opencode/github-pat`:

```bash
bash scripts/push.sh          # commits must exist locally first
```

## Post-deploy check

```bash
curl -s -o /dev/null -w 'home %{http_code} %{time_total}s\n' https://alaguillotine.com/
curl -s -o /dev/null -w 'archive %{http_code}\n' https://alaguillotine.com/archive
curl -s https://alaguillotine.com/api/hateometer?lean=1 | head -c 300
```

The homepage is server-rendered: the response body should contain the charge
count and the names in the line. If it contains only the headline, the build or
the D1 binding is wrong.
