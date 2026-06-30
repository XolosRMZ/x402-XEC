# @x402-xec/payments

Payment preparation for x402-XEC.

`OfflinePaymentPreparer` validates invoice and resource metadata from an HTTP 402
response, enforces a caller-provided payment limit, obtains an ordered UTXO
snapshot through `UtxoProvider`, builds a signed funding transaction through
`@x402-xec/transactions`, and signs the invoice-bound authorization through the
message-only `SignatureProvider` boundary. The result includes a base64url JSON
value ready for the `PAYMENT-SIGNATURE` request header.

```ts
const result = await preparer.prepare({ invoice, resource });
request.headers.set("PAYMENT-SIGNATURE", result.paymentSignature);
```

## UTXO providers

`StaticUtxoProvider` is the deterministic default for tests, fixtures, and the
local E2E demo. It performs no network calls.

`ChronikUtxoProvider` is an opt-in, read-only bridge toward controlled mainnet
testing. Both the Chronik endpoint and eCash mainnet address are required; there
is no default endpoint or address. Constructing the provider does not make a
request. Chronik is read only when `OfflinePaymentPreparer.prepare()` calls
`getUtxos()`.

```ts
import {
  ChronikUtxoProvider,
  OfflinePaymentPreparer,
} from "@x402-xec/payments";

const address = "ecash:...";
const preparer = new OfflinePaymentPreparer({
  utxoProvider: new ChronikUtxoProvider({
    endpoint: "https://chronik.example",
    address,
  }),
  payer: address,
  // signatureProvider, changeAddress, signatoryForUtxo, maxPaymentSats...
});
```

The configured address must match the preparer's payer. Chronik satoshi `bigint`
values are converted directly to canonical decimal strings without a JavaScript
`number` conversion. Token metadata is retained so the transaction builder
rejects token-bearing inputs. All coinbase UTXOs are filtered because the
address UTXO response alone cannot establish coinbase maturity. The address
endpoint supports standard address UTXOs; malformed Chronik responses fail
closed.

## Security and scope

Payment preparation constructs and signs `rawTx` in memory, but neither provider
nor the preparer broadcasts it. `ChronikUtxoProvider` only reads UTXOs and has no
broadcast method. It does not accept, derive, or store private keys and does not
provide wallet custody. Transaction-input signatories and the message-only
authorization signer remain in caller-controlled code.

The Chronik provider is disabled by default and is not an automatic mainnet
payment flow. Static fixtures remain the deterministic default. Tonalli Wallet,
RMZ, and Teyolia are not integrated.

A facilitator can verify the candidate funding outpoint only when its configured
fixture or `TxProvider` knows the generated transaction. Broadcasting remains a
separate, future explicit boundary.
