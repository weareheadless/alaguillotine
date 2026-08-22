# Bug: Wallet Balance Shows 0 CHOP Despite Having Tokens

## Symptom
On the paid message form, the "Wallet Balance" displays `0 $CHOP` even though the connected wallet holds CHOP tokens (including the treasury).

## What's Been Verified/ Fixed

### Token identity (✅ confirmed)
- CHOP mint: `6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump`
- Token program: **Token-2022** (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) — verified on-chain via `getAccountInfo`
- All default mint addresses cleaned up in: `SubmitForm.tsx`, `submit.ts`, `epoch.ts`, `watcher.cjs`, `.env.local.example`

### Code fix applied
`/FYE/src/components/SubmitForm.tsx` — balance fetch at ~line 55:

```ts
// BEFORE (broken)
const ataAddress = getAssociatedTokenAddressSync(mint, pk, false, TOKEN_2022_PROGRAM_ID);
const ata = await getAccount(connection, ataAddress);

// AFTER (should work)
const ataAddress = getAssociatedTokenAddressSync(mint, pk, false, TOKEN_2022_PROGRAM_ID);
const ata = await getAccount(connection, ataAddress, undefined, TOKEN_2022_PROGRAM_ID);
```

**Root cause:** `getAccount(connection, address)` defaults to `TOKEN_PROGRAM_ID` internally for deserialization. Since CHOP is Token-2022, the account data structure is different, so `getAccount` throws a deserialization error. The catch block silently sets balance to 0.

All 4 `getAccount` calls in SubmitForm.tsx were updated to pass `TOKEN_2022_PROGRAM_ID` as the 4th argument. Same fix applied to the ATA existence checks and post-transfer balance refresh in the paid submit flow.

### Other verified
- `.env.local` has correct `NEXT_PUBLIC_CHOP_MINT=6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump`
- `submit.ts` (server-side) already correctly passes `TOKEN_2022_PROGRAM_ID` everywhere
- Build succeeds with no TypeScript errors

## Still Failing After Rebuild+Restart
The balance still shows 0 after `npm run build && pm2 restart fuckyouelon`.

## Possible Next Steps
1. **Check browser console** for the `[CHOP balance] fetch error:` log added in the latest commit — this will tell you if it's a deserialization error, RPC error, or something else.
2. **Verify the built JS** actually has the fix — check `.next/static/chunks/` for the SubmitForm code with `TOKEN_2022_PROGRAM_ID` in the `getAccount` call.
3. **RPC endpoint**: `NEXT_PUBLIC_SOLANA_RPC_URL` defaults to `https://api.mainnet-beta.solana.com` which may rate-limit. A paid RPC (Helius, QuickNode) might be needed.
4. **Wallet adapter issue**: The `useWallet()` hook from `@solana/wallet-adapter-react` might be returning a publicKey that doesn't match the wallet the user thinks is connected. Log `publicKey.toBase58()` to confirm.
5. **Cache**: Try a hard refresh (Ctrl+Shift+R) or clear `.next` cache before rebuilding.

## Files Involved
- `/FYE/src/components/SubmitForm.tsx` — main fix location
- `/FYE/src/app/actions/submit.ts` — server-side (already correct)
- `/FYE/.env.local` — env vars
