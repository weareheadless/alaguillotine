# Blind Executioner Workflow

The Blind Executioner manually executes treasury transfers after each epoch
resolution. This is intentionally manual — no smart contracts, no automated
transfers. The community has 60 minutes to verify the proposed transactions
before they execute.

---

## Workflow

### 1. Epoch Resolution

`finalizeEpoch()` runs (via cron or manual trigger) → winner determined.
The winning proposal's percentage allocations are now locked.

### 2. Calculate CHOP Amounts

The Executioner calculates exact CHOP amounts from the winner's percentages:

```
treasury_balance = fetch on-chain CHOP balance
burn_amount     = treasury_balance × burn_pct / 100
bounty_amount   = treasury_balance × bounty_pct / 100
infra_amount    = treasury_balance × infra_pct / 100
marketing_amount = treasury_balance × marketing_pct / 100
```

### 3. Pre-publish Transaction Plan

The Executioner publishes a transaction plan on the site for community review:

```
⚠️ EXECUTION PENDING — VERIFY
Epoch 4 — SCORCHED EARTH COMMITTEE won (312 of 646 votes)
Burn: 7,000 CHOP → burn address
Bounty: 1,500 CHOP → treasury reserve
Infra: 1,500 CHOP → dev wallet (EXECUTIONER_WALLET_ADDRESS)
Marketing: 0 CHOP → n/a

[EXECUTING IN 60 MINUTES]
Transaction plan hash: sha256(...)
```

### 4. 60-Minute Verification Window

Community members can:
- Verify the percentages match the winning proposal
- Verify the treasury balance is correct
- Verify the destination addresses
- Object via the site if something is wrong

### 5. Execute Transfers

After the 60-minute window:
- Executioner signs + broadcasts Solana SPL token transfers
- All transactions use the treasury wallet (`NEXT_PUBLIC_SOLANA_RECEIVER_WALLET`)
- Burn: send to a known burn address or `TokenBurn` instruction
- Bounty/Infra/Marketing: send to specified wallets

### 6. Publish Tx Signatures

After execution, the Executioner publishes:
```
✅ EXECUTED
Epoch 4 — SCORCHED EARTH COMMITTEE
Burn tx: <solscan link>
Bounty tx: <solscan link>
Infra tx: <solscan link>
```

---

## Environment Variables

```bash
EXECUTIONER_PREPUBLISH_MINUTES=60  # Verification window duration
EXECUTIONER_WALLET_ADDRESS=        # Public dev wallet for infra/marketing
```

---

## Emergency Override

If the Executioner is compromised or unavailable:

1. Any community member can run `finalizeEpoch()` to resolve the epoch
2. The 60-minute pre-publish window gives the community time to object
3. The treasury is a single-key wallet — if the key is compromised, all funds are at risk
4. Future phases may introduce multisig for the treasury

---

## Notes

- The Executioner must have the private key for `NEXT_PUBLIC_SOLANA_RECEIVER_WALLET`
- All transfers are standard SPL Token transfers
- Burn is performed by sending tokens to a verifiably unspendable address
- Marketing funds may be held in treasury until specific bounties are claimed
