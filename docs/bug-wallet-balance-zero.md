# Bug: Wallet Balance Shows 0 CHOP Despite Having Tokens

## Status: FIXED (2026-07-29 round 2)

## Symptom
On the paid message form, the "Wallet Balance" displays `0 $CHOP` even though the connected wallet holds CHOP tokens.

## Root Cause (Two Issues)

### Issue 1: `getAccount` defaulted to wrong token program (FIXED in round 1)
`getAccount(connection, address)` defaults to `TOKEN_PROGRAM_ID` for deserialization. Since CHOP is Token-2022, the account data structure differs, causing a deserialization error. The catch block silently set balance to 0.

✅ Fixed by passing `TOKEN_2022_PROGRAM_ID` as the 4th argument everywhere.

### Issue 2: Public RPC rate-limiting (FIXED in round 2)
`getAccount` internally calls `connection.getAccountInfo(address)` which hits the Solana RPC directly from the browser. The public endpoint `https://api.mainnet-beta.solana.com` frequently returns **503 Service Unavailable** or network errors. When this happens, the catch block silently sets balance to 0 — AND it's indistinguishable from a real "no tokens" situation.

Additionally, the PM2 daemon had stale/zombie socket files, meaning `pm2 restart` may not have actually restarted the app after the round 1 fix.

## Round 2 Fix (2026-07-29)

### Approach: Use `getTokenAccountBalance` instead of `getAccount`

Instead of fetching full account data and deserializing client-side (which requires the correct program ID and is vulnerable to RPC failures), we now use the RPC's `getTokenAccountBalance` method, which:
- Handles Token-2022 parsing server-side (no program ID needed)
- Returns only the balance (lighter call)
- Is less susceptible to deserialization errors

### Changes in `/FYE/src/components/SubmitForm.tsx`:

1. **Balance fetch** (~line 46): Replaced `getAccount()` with `connection.getTokenAccountBalance(ataAddress)`
2. **Added retry logic**: Up to 3 retries with 1s/2s backoff on RPC failures
3. **Added error state**: `chopBalanceError` state shows RPC errors in the UI instead of silently showing 0
4. **Preserves previous balance**: On RPC failure, keeps the last known balance instead of resetting to 0
5. **Post-transfer refresh**: Also switched to `getTokenAccountBalance`
6. **Error indicator**: Red warning bar appears below the balance if RPC is unreachable
