# Auth Overhaul — Implementation Plan

> **Architect's note:** This plan is designed for a coding AI to execute step by step.
> Each phase is independently testable. Do not proceed to the next phase until the
> current one compiles and runs without regressions.

---

## ⚠️ CRITICAL RULES

1. **Never import `better-sqlite3` in a client component.** It's a native C module that
   only works in `"use server"` files, API routes, or scripts. It will crash the browser.
2. **Never use `cookies()` from `next/headers` in a client component.** It's server-only.
3. **Keep the existing `LocalDatabases` class untouched.** Add only the `users` table
   to its schema. Add user CRUD methods as standalone functions in a new file — do not
   bloat `local-db.ts`.
4. **One concern per file.** Auth logic, PoW logic, and user DB logic each get their
   own module. No god files.
5. **Error messages must be user-facing and thematic** (e.g., "The blade rejects your
   credentials" not "Invalid username or password"). But keep the tone dark-humor,
   not cringe.
6. **Session is HTTP-only cookie.** Not localStorage, not JWT in JS. The cookie name
   should be `fye_session`. It stores a session token (random hex, not a JWT).
7. **Never delete the Appwrite client code yet.** Comment it out with `// DEPRECATED`
   comments. We remove it only after everything is tested in production.

---

## PHASE 0 — Dependency Installation

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

`bcryptjs` is pure JS (no native bindings), works everywhere. Do NOT use `bcrypt` (the
native one) — it causes build issues with Next.js.

---

## PHASE 1 — Database Schema: `users` Table

### File: `src/lib/local-db.ts`

**What to do:** Add the `users` table to the `ensureTables()` function.

**Rules:**
- Add the CREATE TABLE statement **after** the `votes` table and **before** the closing
  backtick of `db.exec(...)`.
- Do NOT modify any other table definitions.
- Do NOT add user CRUD methods here — they go in a separate file.

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  wallet_address TEXT,
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
```

**Design decisions:**
- `UNIQUE` on username prevents duplicates at the DB level (no race conditions).
- `wallet_address` is nullable — users start without wallets, link later.
- `display_name` is separate from `username`. Username is for login. Display name is
  what shows on messages.
- No email column. No password reset token column. By design.

### Verify Phase 1:
Run `npm run build`. It must compile. If the app starts, check that existing messages
still load.

---

## PHASE 2 — User DB Operations

### File: `src/lib/users.ts` (NEW)

**Purpose:** All user CRUD operations. This module is server-only — it imports
`better-sqlite3` via the existing `getDb()` pattern.

**Rules:**
- Use the EXACT same singleton pattern as `local-db.ts`: `const db = getDb()` then
  `db.prepare(...)`.
- Do NOT create a new `Database` instance. Reuse the existing `getDb()` from
  `local-db.ts`. Import it: `import { getDb } from "./local-db"` — wait, `getDb` is
  not exported. **Check:** it's a local function inside `local-db.ts`.

### ⚠️ TRAP: `getDb()` is NOT exported from `local-db.ts`

You have two options:

**Option A (preferred):** Export `getDb` from `local-db.ts`:
```ts
export function getDb(): Database.Database { ... }
```

**Option B:** Create a separate `getDb()` in `users.ts` that opens the same file path.
This works because SQLite supports multiple connections with WAL mode, but it's ugly.

**Go with Option A.** It's a one-line change.

### Functions to implement in `users.ts`:

```ts
// All functions are server-only (import better-sqlite3)

import { getDb } from "./local-db";  // after exporting it
import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_ROUNDS = 10;

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  wallet_address: string | null;
  created_at: string;
}

// ─── Create ───

export function createUser(username: string, password: string): UserRow {
  // 1. Trim and lowercase username (case-insensitive uniqueness)
  // 2. Validate: 3-20 chars, alphanumeric + underscore only
  // 3. Hash password with bcrypt (10 rounds)
  // 4. Generate ID with crypto.randomUUID()
  // 5. INSERT INTO users, return user row (without password_hash)
  // 6. If UNIQUE constraint fails, throw "Username taken"
}

// ─── Authenticate ───

export function verifyLogin(username: string, password: string): UserRow | null {
  // 1. SELECT * FROM users WHERE username = ?
  // 2. bcrypt.compare(password, row.password_hash)
  // 3. Return UserRow (without hash) or null
}

// ─── Read ───

export function getUserById(id: string): UserRow | null { ... }
export function getUserByUsername(username: string): UserRow | null { ... }

// ─── Update ───

export function updateDisplayName(userId: string, displayName: string): void {
  // Trim to 30 chars max
  // UPDATE users SET display_name = ? WHERE id = ?
}

export function linkWalletAddress(userId: string, walletAddress: string): void {
  // Validate: must be a valid Solana base58 address (44 chars)
  // UPDATE users SET wallet_address = ? WHERE id = ?
}

export function getUserByWallet(walletAddress: string): UserRow | null { ... }
```

**Design decisions:**
- Username is case-insensitive: store as lowercase, display as-is.
- `crypto.randomUUID()` for IDs — no dependency needed, available in Node 19+.
- Use `db.prepare(...).get(...)` for single-row queries.
- Use `db.prepare(...).run(...)` for INSERT/UPDATE.
- Always parameterize queries. NEVER use string interpolation for SQL.

### Verify Phase 2:
Build must compile. No runtime test yet — we need API routes first.

---

## PHASE 3 — Session Management

### File: `src/lib/session.ts` (NEW)

**Purpose:** Create, verify, and delete sessions. Sessions are stored in a new SQLite
table, NOT in memory (survives server restarts). Session token is a random hex string
stored in an HTTP-only cookie.

**Rules:**
- Add a `sessions` table to `local-db.ts` schema (same place as users table).
- Session tokens: `crypto.randomBytes(32).toString("hex")` — 64 characters.
- Session cookie: `fye_session`, HTTP-only, SameSite=Lax, Path=/, Max-Age=30 days.
- The cookie is set by API routes using `cookies()` from `next/headers`.
- The cookie is read by server actions using `cookies()`.

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
```

### Functions:

```ts
import { cookies } from "next/headers";
import { getDb } from "./local-db";
import crypto from "crypto";

export const SESSION_COOKIE = "fye_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export function createSession(userId: string): string {
  // 1. Generate token: crypto.randomBytes(32).toString("hex")
  // 2. INSERT INTO sessions (id, user_id, created_at, expires_at)
  //    - expires_at = now + 30 days (ISO string)
  // 3. Set cookie via cookies().set(SESSION_COOKIE, token, { ... })
  // 4. Return token
}

export function getSessionUserId(): string | null {
  // 1. Read cookie: cookies().get(SESSION_COOKIE)
  // 2. If no cookie, return null
  // 3. SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')
  // 4. Return user_id or null
}

export function destroySession(): void {
  // 1. Read cookie
  // 2. DELETE FROM sessions WHERE id = ?
  // 3. cookies().delete(SESSION_COOKIE)
}

// Called periodically or on login to clean expired sessions
export function purgeExpiredSessions(): void {
  // DELETE FROM sessions WHERE expires_at <= datetime('now')
}
```

### ⚠️ TRAP: `cookies()` is async in Next.js 15

In Next.js 15, `cookies()` returns a promise. You MUST await it:

```ts
const cookieStore = await cookies();
cookieStore.set(SESSION_COOKIE, token, { ... });
```

### Verify Phase 3:
Not independently testable yet. Build must compile.

---

## PHASE 4 — API Routes

All routes go under `src/app/api/auth/`. Each is a Next.js Route Handler:
`export async function POST(request: Request) { ... }`

### 4a. `src/app/api/auth/register/route.ts`

```
POST /api/auth/register
Body: { username: string, password: string }
Response: { success: true, user: { id, username, display_name } }
Errors: 409 (username taken), 400 (invalid input)
```

**Logic:**
1. Parse JSON body
2. Validate username (3-20 chars, `^[a-zA-Z0-9_]+$`)
3. Validate password (min 4 chars — we're not a bank)
4. Call `createUser()` from `users.ts`
5. Call `createSession()` from `session.ts`
6. Return user (without password hash)

### 4b. `src/app/api/auth/login/route.ts`

```
POST /api/auth/login
Body: { username: string, password: string }
Response: { success: true, user: { id, username, display_name, wallet_address } }
Errors: 401 (bad credentials)
```

**Logic:**
1. Parse JSON body
2. Call `verifyLogin()` from `users.ts`
3. If null → 401
4. Call `createSession()` from `session.ts`
5. Return user

### 4c. `src/app/api/auth/logout/route.ts`

```
POST /api/auth/logout
Response: { success: true }
```

**Logic:**
1. Call `destroySession()` from `session.ts`
2. Return `{ success: true }`

### 4d. `src/app/api/auth/me/route.ts`

```
GET /api/auth/me
Response: { user: { id, username, display_name, wallet_address } | null }
```

**Logic:**
1. Call `getSessionUserId()` from `session.ts`
2. If null → `{ user: null }`
3. Call `getUserById()` from `users.ts`
4. Return user (without password hash)

### 4e. `src/app/api/auth/challenge/route.ts`

```
POST /api/auth/challenge
Body: {} (empty)
Response: { challenge: string, difficulty: number }
```

**Logic:**
1. Generate random challenge: `crypto.randomBytes(16).toString("hex")`
2. Difficulty starts at 4 (SHA256 must start with 4 zeros)
3. Store challenge in a new `pow_challenges` table with expiration (5 min)
4. Return challenge

```sql
CREATE TABLE IF NOT EXISTS pow_challenges (
  challenge TEXT PRIMARY KEY,
  difficulty INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT ''
);
```

### 4f. `src/app/api/auth/wallet-link/route.ts`

```
POST /api/auth/wallet-link
Body: { wallet_address: string, signature: string, message: string }
Response: { success: true }
Errors: 401 (not logged in), 400 (bad signature)
```

**Logic:**
1. Get current user from session
2. Verify the signature using `@solana/web3.js` `verifyMessage` or tweetnacl
3. Call `linkWalletAddress()` from `users.ts`

⚠️ **TRAP:** `@solana/web3.js` v1 uses `nacl.sign.detached.verify()` for message
verification. The message must be the exact bytes that were signed. Use:

```ts
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

// Verify signature
const publicKey = new PublicKey(walletAddress);
const messageBytes = new TextEncoder().encode(message);
const signatureBytes = bs58.decode(signature);
const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
```

But `tweetnacl` is not in your dependencies. Either install it (`npm i tweetnacl`) or
use the `verifyMessage` approach in `@solana/web3.js`. However, `@solana/web3.js` v1
doesn't have a built-in `verifyMessage`. In v2 it does. Since you're on v1, install
`tweetnacl` and `@types/tweetnacl`.

### ⚠️ TRAP: Route Handler exports

Must be:
```ts
export async function POST(request: Request) { ... }
export async function GET(request: Request) { ... }
```

NOT `export default function ...` — Next.js Route Handlers use named exports.

### ⚠️ TRAP: `cookies()` in route handlers

The same async rule applies: `const cookieStore = await cookies()`.

### Verify Phase 4:
Use curl to test:
```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test1234"}'

curl http://localhost:3002/api/auth/me
```

---

## PHASE 5 — Auth Context (Client-Side)

### File: `src/lib/auth-context.tsx` (NEW)

**Purpose:** React context that holds the current user state. All client components
read from this context instead of calling Appwrite directly.

**Rules:**
- The context provides: `user`, `loading`, `login()`, `register()`, `logout()`,
  `updateName()`, `linkWallet()`.
- On mount, it calls `GET /api/auth/me` to check if there's an existing session.
- The `login()` and `register()` functions call the API routes and update state.
- Do NOT use `useEffect` chains for auth state — single fetch on mount, manual
  updates on login/register/logout.

```ts
"use client";

interface AuthUser {
  id: string;
  username: string;
  display_name: string;
  wallet_address: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  linkWallet: (address: string, signature: string, message: string) => Promise<boolean>;
}
```

### ⚠️ TRAP: Don't re-fetch on every render

The `AuthProvider` should fetch `/api/auth/me` exactly once on mount. Use a `useRef`
to track if it already fetched. The user state only changes via explicit
`login()`/`register()`/`logout()` calls.

### ⚠️ TRAP: Display name updates

When `updateDisplayName()` is called, it should:
1. Call the API (you need a `PATCH /api/auth/me` route or just do it via server
   action — we'll add a simple `updateDisplayNameAction` server action for this)
2. Update the local state

Actually, simpler approach: add a server action in `src/app/actions/auth.ts`:

```ts
"use server";
import { getSessionUserId } from "@/lib/session";
import { updateDisplayName } from "@/lib/users";
import { revalidatePath } from "next/cache";

export async function updateDisplayNameAction(name: string) {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("Not logged in");
  updateDisplayName(userId, name.trim().slice(0, 30));
}
```

### Verify Phase 5:
Wrap the app in `<AuthProvider>` in `layout.tsx`. The app should load without errors.
Console.log the context value to verify it initializes.

---

## PHASE 6 — PoW (Proof of Work)

### File: `src/lib/pow.ts` (NEW)

**Purpose:** Shared PoW utilities. This file is used by BOTH client and server.
It MUST NOT import any Node.js-only modules.

**Rules:**
- `createChallenge()` — server-side only. Can import `crypto`.
- `solveChallenge(challenge, difficulty)` — client-side. Uses Web Crypto API
  (`crypto.subtle.digest`).
- `verifySolution(challenge, nonce, difficulty)` — both sides. Pure computation.

```ts
// ─── Types ───

export interface PowChallenge {
  challenge: string;  // hex
  difficulty: number; // number of leading zeros in hex
}

export interface PowSolution {
  challenge: string;
  nonce: string;      // hex
}

// ─── Server: Create Challenge ───

export function createChallenge(difficulty: number = 4): PowChallenge {
  // Only call this from server (uses Node crypto)
  const challenge = require("crypto").randomBytes(16).toString("hex");
  return { challenge, difficulty };
}

// ─── Client: Solve Challenge ───

export async function solveChallenge(
  challenge: string,
  difficulty: number,
  onProgress?: (attempts: number) => void
): Promise<PowSolution> {
  // Brute-force loop: try nonces until SHA256(challenge + nonce) starts with N zeros
  // Use Web Crypto API (works in browser)
  let nonce = 0;
  const prefix = "0".repeat(difficulty);

  while (true) {
    const nonceHex = nonce.toString(16);
    const input = challenge + nonceHex;
    const hash = await sha256(input);
    if (hash.startsWith(prefix)) {
      return { challenge, nonce: nonceHex };
    }
    nonce++;
    if (nonce % 10000 === 0 && onProgress) {
      onProgress(nonce);
      // Yield to the event loop so UI doesn't freeze
      await new Promise(r => setTimeout(r, 0));
    }
  }
}

// ─── Shared: Verify Solution ───

export async function verifySolution(
  challenge: string,
  nonce: string,
  difficulty: number
): Promise<boolean> {
  const input = challenge + nonce;
  const hash = await sha256(input);
  return hash.startsWith("0".repeat(difficulty));
}

// ─── Helper ───

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
```

### ⚠️ TRAP: `crypto.subtle` is only available in secure contexts

`crypto.subtle` works on `localhost` and HTTPS. It will NOT work on HTTP in production.
Since your nginx config probably terminates TLS, this should be fine. But during local
dev on `localhost:3002`, it works.

### ⚠️ TRAP: PoW on mobile

Difficulty 4 takes ~1-3 seconds on desktop, ~5-10 seconds on mobile. Start with
difficulty 3 and auto-tune. See Phase 6b.

### Phase 6b: Server-Side PoW Verification

The challenge endpoint (`/api/auth/challenge`) stores the challenge in the DB.
When a message is submitted:

1. Client includes `{ challenge, nonce }` in the form data
2. Server action verifies the solution against the stored challenge
3. Server deletes the challenge from DB (one-time use)
4. If valid, proceed. If not, reject.

### ⚠️ TRAP: Don't block the user during PoW

In `SubmitForm.tsx`, the PoW should run in the background while the user types.
Start solving as soon as the component mounts. Use `useRef` to store the solution.
By the time the user clicks submit, the PoW is likely already done.

### Verify Phase 6:
Create a standalone test page at `/test-pow` that lets you solve a challenge and see
the time. Then call `/api/auth/challenge` and verify the flow.

---

## PHASE 7 — Server Action Rewiring

This is the hardest phase. You are replacing the Appwrite JWT auth in `submit.ts`
and `feed.ts` with the session cookie.

### 7a: `src/app/actions/submit.ts` — Changes

**Current flow:**
```
FormData → extract jwt → getJwtClient(jwt) → userAccount.get() → authorId
```

**New flow:**
```
FormData → getSessionUserId() → authorId
```

**Changes to `submitFreeMessage()`:**

1. REMOVE all JWT-related code
2. Replace with: `const userId = await getSessionUserId()`
3. If `userId` is null → return error "You must be logged in."
4. Use `userId` as `author_id` instead of `user.$id`
5. Keep everything else the same (moderation, nomination, CHOP burn)

**Changes to `submitComment()`:**

Same as `submitFreeMessage()`.

**Changes to `submitPaidMessage()`:**

Paid messages already have `author_id: null`. They don't need auth. No changes needed
except... should we let paid messages optionally be attached to a logged-in user?
Decision: **Not yet.** Keep paid messages anonymous for now.

**ADD honeypot check** to ALL three submit functions:

```ts
// At the top of each submit function:
const honeypot = formData.get("website"); // the hidden field
if (honeypot && honeypot.toString().trim().length > 0) {
  // Bot detected — silently return success
  return { success: true };
}
```

**ADD PoW verification** to `submitFreeMessage()` and `submitComment()`:

```ts
const challenge = formData.get("pow_challenge")?.toString();
const nonce = formData.get("pow_nonce")?.toString();

if (!challenge || !nonce) {
  return { success: false, error: "Proof of work required." };
}

const valid = await verifySolution(challenge, nonce, /* difficulty */);
if (!valid) {
  return { success: false, error: "Proof of work invalid. Try again." };
}
```

**⚠️ BUT:** Wallet-linked users should skip PoW. Check if the user has a wallet:

```ts
const user = getUserById(userId);
if (!user?.wallet_address) {
  // Ghost user → require PoW
  // ... verify PoW ...
}
```

### 7b: `src/app/actions/feed.ts` — Changes

**`fetchOwnMessages()`:** Currently takes `authorId` as a parameter. This is fine —
it's called from the client, which knows the user ID from the auth context.

**`checkExistingFreeMessage()`:** Same — takes `authorId`, still works.

**No changes needed to `feed.ts`** except removing any unused Appwrite imports.

### 7c: `src/app/actions/auth.ts` (NEW)

```ts
"use server";

import { getSessionUserId } from "@/lib/session";
import { updateDisplayName, getUserById } from "@/lib/users";

export async function updateDisplayNameAction(name: string) {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("Not authenticated");
  updateDisplayName(userId, name.trim().slice(0, 30));
}

export async function getCurrentUserAction() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user) return null;
  return { id: user.id, username: user.username, display_name: user.display_name, wallet_address: user.wallet_address };
}
```

### ⚠️ TRAP: `getSessionUserId()` is NOT async in our design

We wrote it as: `export function getSessionUserId(): string | null`

But `cookies()` in Next.js 15 IS async. So this function must be:

```ts
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(token) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}
```

All server actions that call `getSessionUserId()` must `await` it.

### Verify Phase 7:
Full integration test:
1. Register a user via `/api/auth/register`
2. Submit a free message
3. Verify it appears in the feed
4. Submit a comment
5. Submit a paid message (wallet required)
6. Logout, verify messages are still visible but posting is blocked

---

## PHASE 8 — Client Component Rewiring

### 8a: `src/components/AuthButtons.tsx` — Full Rewrite

**Current state:** Uses `account.createAnonymousSession()` from Appwrite.

**New state:** Uses the `AuthContext`. Shows either the login form or the user info.

**UI states:**

| State | What to show |
|---|---|
| `loading` | Pulsing placeholder |
| Logged out | "Join the Resistance" button → opens login/register form |
| Logged in, no name set | Username display + edit button |
| Logged in, name set | Display name + edit button |
| Logged in, wallet linked | Wallet badge + display name |

**Login/Register form:** A simple inline form with username + password fields,
a submit button, and a toggle between "Login" and "Register" mode. No routing,
no page navigation — it swaps in place.

```tsx
// States to handle:
// 1. "idle" — showing the Join button
// 2. "form" — showing the login/register form
// 3. "logged-in" — showing user info

const [mode, setMode] = useState<"idle" | "form">("idle");
const [isRegister, setIsRegister] = useState(false);
```

### ⚠️ TRAP: Don't break the NavBar layout

`AuthButtons` is rendered in `NavBar`. The login form must not overflow the navbar.
Use `absolute` positioning for the form dropdown, or a modal.

Actually, simpler: render the login form INLINE where the "Join" button is. It replaces
the button. This keeps the navbar clean.

### 8b: `src/components/SubmitForm.tsx` — Partial Rewrite

**Changes needed:**

1. **Remove all Appwrite calls:**
   - Remove `import { account } from "../lib/appwrite"`
   - Remove the entire `initAuth()` useEffect that calls `account.get()` and
     `account.createAnonymousSession()`
   - Remove `sessionJwt` state

2. **Replace with AuthContext:**
   - `const { user, loading } = useAuth()`
   - `userStatus` logic:
     - `loading` → "loading"
     - `user === null` → "logged-out"
     - `user !== null` → check if already posted → "already-posted" or "logged-in"

3. **Add honeypot field:**
   ```tsx
   {/* Invisible honeypot — bots fill this */}
   <input
     type="text"
     name="website"
     tabIndex={-1}
     autoComplete="off"
     style={{
       position: "absolute",
       left: "-9999px",
       opacity: 0,
       height: 0,
       width: 0,
     }}
   />
   ```

4. **Add PoW flow:**
   - On mount, fetch a challenge from `/api/auth/challenge`
   - Solve it in the background using a Web Worker or async loop with `setTimeout(0)`
   - Store solution in a ref
   - Include `pow_challenge` and `pow_nonce` in the FormData on submit
   - Show a small indicator: "⚡ Proof of work ready" or "⏳ Computing..."

   **⚠️ CRITICAL UX:** For wallet-linked users, skip PoW entirely. Check `user.wallet_address`.

5. **Update free message submit:**
   - Remove `session_jwt` from FormData
   - Add `pow_challenge` and `pow_nonce` (for ghost users)
   - Add `website` (honeypot — always empty for humans)
   - Keep `author_name` (from `user.display_name`)

6. **Update paid message submit:** No changes needed — paid messages don't use auth.

7. **Remove `needsName` flow:** The name prompt should move to `AuthButtons` instead.
   Or keep it but read from AuthContext. Simpler: after registration, redirect the
   user to set their display name via `AuthButtons`.

### 8c: `src/app/layout.tsx` — Minor Change

Add `<AuthProvider>` around children:

```tsx
import { AuthProvider } from "../lib/auth-context";

// Inside the return:
<SolanaWalletProvider>
  <ExecutionProvider>
    <AuthProvider>
      <div className="flex-grow">{children}</div>
      {/* footer */}
    </AuthProvider>
  </ExecutionProvider>
</SolanaWalletProvider>
```

### Verify Phase 8:
The full app should work: register → login → post → comment → logout → everything
persists.

---

## PHASE 9 — Cleanup

### 9a: Mark Appwrite as Deprecated

In `src/lib/appwrite.ts`, add a comment at the top:

```ts
/**
 * @deprecated Appwrite auth is being replaced by local session-based auth.
 * This file is kept temporarily until Phase 9 cleanup is complete.
 * DO NOT add new Appwrite-dependent code.
 */
```

### 9b: Remove from `index.ts` barrel

Comment out the Appwrite exports from `src/lib/index.ts`:
```ts
// export { client, account, databases, ... } from "./appwrite"; // DEPRECATED
```

### 9c: Remove `node-appwrite` import from `submit.ts`

After Phase 7, the `getJwtClient()` function and `import { Client, Account } from
"node-appwrite"` should be removed from `submit.ts`.

### 9d: Check for stray imports

Grep the codebase for:
- `appwrite` (should only appear in deprecated comments)
- `createAnonymousSession`
- `createJWT`
- `session_jwt`

---

## PHASE 10 — Wallet Linking (Enhancement)

### 10a: `src/app/api/auth/wallet-link/route.ts`

As described in Phase 4f.

### 10b: UI in AuthButtons

Add a "Link Wallet" button. When clicked:
1. Use the existing wallet adapter to connect
2. Get the user to sign a message: `"Link wallet to FYE account: ${username}"`
3. Call `POST /api/auth/wallet-link` with the wallet address, signature, and message
4. Update the auth context

### 10c: Auto-login with wallet

If a user has a linked wallet and connects it, they should be able to log in without
a password. Flow:
1. User connects wallet
2. Client checks `GET /api/auth/me` — if already logged in, skip
3. Client calls `POST /api/auth/wallet-login` with a signed message
4. Server looks up user by wallet address, creates session, returns user
5. No password needed

This is a "nice to have" — implement after Phase 9 if time permits.

---

## SUMMARY — Files Created vs Modified

### New Files (8):

| # | File | Phase | Lines (est.) |
|---|---|---|---|
| 1 | `src/lib/users.ts` | 2 | ~80 |
| 2 | `src/lib/session.ts` | 3 | ~60 |
| 3 | `src/lib/auth-context.tsx` | 5 | ~90 |
| 4 | `src/lib/pow.ts` | 6 | ~70 |
| 5 | `src/app/api/auth/register/route.ts` | 4 | ~40 |
| 6 | `src/app/api/auth/login/route.ts` | 4 | ~35 |
| 7 | `src/app/api/auth/logout/route.ts` | 4 | ~15 |
| 8 | `src/app/api/auth/me/route.ts` | 4 | ~20 |
| 9 | `src/app/api/auth/challenge/route.ts` | 4 | ~35 |
| 10 | `src/app/api/auth/wallet-link/route.ts` | 10 | ~45 |
| 11 | `src/app/actions/auth.ts` | 5 | ~25 |

### Modified Files (7):

| # | File | Phase | Change Size |
|---|---|---|---|
| 1 | `src/lib/local-db.ts` | 1 | +35 lines (users + sessions + pow tables) |
| 2 | `src/lib/index.ts` | 9 | comment out Appwrite, add new exports |
| 3 | `src/components/AuthButtons.tsx` | 8 | ~full rewrite (~200 lines) |
| 4 | `src/components/SubmitForm.tsx` | 8 | ~60 lines changed |
| 5 | `src/app/actions/submit.ts` | 7 | ~50 lines changed |
| 6 | `src/app/actions/feed.ts` | 7 | ~5 lines changed |
| 7 | `src/app/layout.tsx` | 8 | +3 lines |

### Dependency Changes:

| Package | Type | Reason |
|---|---|---|
| `bcryptjs` | dependency | Password hashing |
| `@types/bcryptjs` | devDependency | TypeScript types |
| `tweetnacl` | dependency | Solana signature verification |
| `@types/tweetnacl` | devDependency | TypeScript types |

---

## DEBUGGING GUIDE (for the developer 6 months from now)

### "I can't log in"
1. Check the `sessions` table: `sqlite3 data/local.db "SELECT * FROM sessions;"`
2. Check the `users` table: `sqlite3 data/local.db "SELECT * FROM users;"`
3. Check browser DevTools → Application → Cookies → `fye_session` exists
4. Check that `bcryptjs` is installed: `npm ls bcryptjs`

### "Messages aren't posting"
1. Open DevTools Network tab, look for the server action call
2. Check the response — is it a session error?
3. Verify the session cookie is being sent with the request
4. Check the PoW: is the challenge expired? (5 min TTL)

### "PoW takes forever on mobile"
1. Reduce difficulty: change the default in `createChallenge()` from 4 to 3
2. Or check if the `setTimeout(0)` yield is actually yielding — on some browsers it
   doesn't. Use `await new Promise(r => setTimeout(r, 1))` instead.

### "Everything is broken after deploy"
1. Run `npm run build` — Next.js catches most issues
2. Check PM2 logs: `pm2 logs fuckyouelon`
3. Verify the SQLite file path: `data/local.db` must be writable by the PM2 process
4. Check that `.env.local` has no Appwrite variables that might confuse old code

### Flow to trace a request:
```
Browser: SubmitForm.tsx
  → fetch /api/auth/challenge (get PoW)
  → solveChallenge() in client
  → server action: submitFreeMessage(formData)
    → getSessionUserId() reads fye_session cookie
    → getUserById() from SQLite
    → check modation (OpenAI)
    → insert into messages table
    → burn 1 CHOP
    → return { success: true }
  → MessageFeed re-fetches
```
