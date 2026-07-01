# Browser E2E dry-run result

- Date: 2026-07-01
- Commit tested: `21f20d48c428013dd1c6479e9f58f9d64def0a02`
- Example: `browser-e2e`
- Route: `/api/weather`

## Successful flow

1. Received `402`.
2. Approval requested.
3. Mock approval accepted.
4. Mock signature returned.
5. Retry sent with `PAYMENT-SIGNATURE`.
6. Protected resource returned.
7. Reported `broadcasted: false` — **DRY RUN ONLY**.

No real mnemonic, WIF, private key, Chronik, or broadcast was used.
