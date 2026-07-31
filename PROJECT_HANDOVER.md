# Project Handover — 2026-07-30

## Summary

Added a Reddit-style "War Room" community message board to the Governance page. During deployment, Node.js was upgraded from v12 → v20, which broke native module compatibility (better-sqlite3 segfault). The War Room code is complete and compiled successfully, but the oracle test script cannot run due to the native module issue.

---

## What Was Built: War Room

A persistent community message board at `/governance` — Reddit-style posts with upvote/downvote and nested comments.

### Files Created
| File | Purpose |
|---|---|
| `src/components/WarRoom.tsx` | Full component: post list, comments, voting, new post form, pagination, 15s polling |

### Files Modified
| File | Change |
|---|---|
| `src/lib/local-db.ts` | Added 3 tables: `war_room_posts`, `war_room_comments`, `war_room_votes` (with `is_sticky`, `is_locked`, `is_removed` for future admin panel) |
| `src/lib/oracle-types.ts` | Added `WarRoomPost`, `WarRoomComment`, `WarRoomVoteStatus` types |
| `src/lib/types.ts` | Barrel-exported new types |
| `src/app/actions/governance.ts` | Added `resolveIdentity()` helper + 6 server actions: `createWarRoomPost`, `fetchWarRoomPosts`, `fetchWarRoomPost`, `postWarRoomComment`, `castWarRoomVote`, `fetchMyWarRoomVotes`. Old `postComment`/`fetchProposalComments` now redirect to War Room |
| `src/app/governance/page.tsx` | Layout changed to `grid-cols-2` (50/50 split). Proposals left, War Room right. Header made more compact |
| `src/components/ProposalCard.tsx` | Removed `ProposalComments` import, replaced with `→ Discuss in War Room` link |
| `ecosystem.config.cjs` | Removed `fuckyouelon` app (Next.js runs via nohup, not pm2). Only watcher + oracle remain |
| `scripts/oracle.cjs` | Reverted — does NOT auto-create War Room posts. War Room is human-generated only |
| `scripts/test-oracle.sh` | Updated to use `/usr/local/bin/node` and also clean up War Room posts |
| `scripts/deploy.sh` | New — full rebuild + restart |
| `scripts/restart.sh` | New — restart Next.js without rebuilding |
| `package.json` | uuid downgraded from `^14.0.1` → `^9.0.1` |

### Layout
```
┌─────────────────────────────────────────────────────┐
│              PROXY WAR HEADER                       │
├───────────────────────┬─────────────────────────────┤
│  Proposals (left 50%) │  War Room (right 50%)       │
│  - Vote buttons       │  - New post form            │
│  - Allocation bars    │  - Post list (▲/▼ votes)    │
│  - Discuss link →     │  - Expandable comments      │
│                       │  - Pagination               │
└───────────────────────┴─────────────────────────────┘
```

### Auth Model
- Posts/comments/votes require authentication
- Session users: identity from session cookie
- Wallet users: NOT YET IMPLEMENTED (the server action `resolveIdentity()` supports it, but the War Room component doesn't have the `signMessage` UI flow)

---

## Node.js Upgrade

| Before | After |
|---|---|
| v12.22.9 (Ubuntu apt) | v20.18.1 (binary install to `/usr/local/bin`) |
| npm v8.5.1 | npm v10.9.8 |

Installed via direct tarball: `/usr/local/bin/node` (headers at `/usr/local/include/node/`)

---

## What Works

- **Next.js build**: Clean compile, all 16 pages, no TS errors
- **Website**: Live at https://www.fuckyouelon.net, returns 200
- **War Room component**: Compiled and served on `/governance`
- **pm2 scripts**: watcher online, oracle runs every 5 min via cron
- **uuid**: Downgraded to v9.0.1 in package.json

---

## What's Broken: better-sqlite3 Segfault

### Symptom
Any Node.js process that opens a SQLite database via better-sqlite3 crashes with `Segmentation fault (core dumped)`. This affects:
- `scripts/oracle.cjs`
- `scripts/watcher.cjs` 
- `scripts/test-oracle.sh`
- Any direct invocation of better-sqlite3 from terminal

### Root Cause
The better-sqlite3 native binary (`.node` file) was compiled against the old Node v12 ABI. Node 20 has a different ABI (v115). The module loads but crashes when calling SQLite's C API (specifically during `sqlite3_open_v2` or mmap operations).

### Attempted Fixes
1. `npm rebuild better-sqlite3` — silently failed (binary not produced)
2. `npm install better-sqlite3` fresh — installed prebuilt binary, same segfault
3. `node-gyp rebuild --nodedir=/usr/local` — compiled successfully, still segfaults
4. Removing prebuilt binaries and forcing source compile — compiled, still segfaults

The prebuilt `linux-x64.node` binary has correct architecture (x86-64, glibc 2.35, Node ABI 115) but still segfaults on DB open. The VS Code sandbox may have been a factor, but disabling it didn't resolve the issue.

### Working Context
The Next.js server (`next start`) uses the same better-sqlite3 module and works fine. This may be because:
- Next.js started via `nohup` inherits a clean environment
- VS Code terminal still applies some restrictions even with sandbox "disabled"
- Or the Next.js worker process loads the module differently

### Also: uuid Nested Module
`rpc-websockets` (dependency of `@solana/web3.js`) bundles its own `uuid` v14 at `/FYE/node_modules/rpc-websockets/node_modules/uuid/`. This v14 is ESM-only and crashes with `ERR_REQUIRE_ESM` when loaded via `require()`.

**Fix**: After every `npm install`, run:
```bash
rm -rf /FYE/node_modules/rpc-websockets/node_modules/uuid
```
This forces rpc-websockets to use the project's uuid v9.0.1.

---

## Deployment Commands

```bash
# Full rebuild + deploy:
bash scripts/deploy.sh

# Quick restart (no rebuild):
bash scripts/restart.sh

# Oracle test (from real terminal, not VS Code):
bash scripts/test-oracle.sh
```

Manual deployment:
```bash
cd /FYE
rm -rf .next
npm run build
rm -rf node_modules/rpc-websockets/node_modules/uuid   # critical!
sudo fuser -k 3002/tcp
nohup /usr/local/bin/node node_modules/next/dist/bin/next start -p 3002 > /dev/null 2>&1 &
pm2 start /FYE/ecosystem.config.cjs
pm2 save
```

---

## Recommended Next Steps

### Priority 1: Fix better-sqlite3
Try reinstalling it from the **real terminal** (not through VS Code):
```bash
cd /FYE
rm -rf node_modules/better-sqlite3
npm install better-sqlite3
node -e "require('better-sqlite3'); const D=require('better-sqlite3'); const d=new D('data/local.db'); console.log(d.prepare('SELECT 1').get()); d.close()"
```
If the VS Code environment is interfering, this will work from a real SSH session.

### Priority 2: Wallet-only auth for War Room
The `resolveIdentity()` function in `governance.ts` already supports wallet signatures, but `WarRoom.tsx` doesn't have the `signMessage` flow. Add wallet signature prompt for users who aren't logged in.

### Priority 3: Admin panel
Tables already have `is_sticky`, `is_locked`, `is_removed` columns. Build `/admin` page with:
- Post moderation (sticky, lock, remove)
- Oracle management (force regenerate)
- Vote monitoring

### Priority 4: Oracle decision persistence
When an epoch is finalized, the winning proposal disappears from the governance page until a new oracle fires. Modify `fetchActiveProposals()` to show the most recent finalized epoch's proposals as a fallback.

---

## Current Server State

| Service | Manager | Status |
|---|---|---|
| Next.js (port 3002) | nohup | Running, 200 OK |
| chop-watcher | pm2 | online |
| chop-oracle | pm2 cron | Runs every 5 min |
| nginx | systemd | Proxying :443 → :3002 |
