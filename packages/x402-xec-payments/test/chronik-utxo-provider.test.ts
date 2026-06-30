import assert from "node:assert/strict";
import test from "node:test";
import { XEC_MAINNET } from "@x402-xec/core";
import { Address } from "ecash-lib";
import {
  ChronikUtxoProvider,
  ChronikUtxoProviderError,
  StaticUtxoProvider,
  type ChronikUtxoReader,
} from "../src/index.js";

const ENDPOINT = "https://chronik.example";
const ADDRESS = Address.p2pkh("11".repeat(20)).toString();
const OUTPUT_SCRIPT = Address.fromCashAddress(ADDRESS).toScriptHex();
const REQUEST = {
  network: XEC_MAINNET,
  payer: ADDRESS,
  amountSats: "1000",
} as const;

function reader(
  response: unknown,
): { readonly client: ChronikUtxoReader; readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    client: {
      address(address: string) {
        calls.push(address);
        return {
          async utxos() {
            if (response instanceof Error) throw response;
            return response as {
              outputScript: string;
              utxos: Array<{
                outpoint: { txid: string; outIdx: number };
                sats: bigint;
                isCoinbase: boolean;
                token?: unknown;
              }>;
            };
          },
        };
      },
    },
  };
}

function provider(client: ChronikUtxoReader): ChronikUtxoProvider {
  return new ChronikUtxoProvider({ endpoint: ENDPOINT, address: ADDRESS, client });
}

test("maps mocked Chronik UTXOs without number conversion", async () => {
  const mock = reader({
    outputScript: OUTPUT_SCRIPT,
    utxos: [{
      outpoint: { txid: "22".repeat(32), outIdx: 3 },
      sats: 9_007_199_254_740_993_123_456n,
      isCoinbase: false,
    }],
  });

  assert.deepEqual(await provider(mock.client).getUtxos(REQUEST), [{
    txid: "22".repeat(32),
    outIdx: 3,
    sats: "9007199254740993123456",
    outputScript: OUTPUT_SCRIPT,
  }]);
  assert.deepEqual(mock.calls, [ADDRESS]);
});

test("preserves token metadata for transaction-builder rejection", async () => {
  const token = {
    tokenId: "33".repeat(32),
    tokenType: { protocol: "SLP", type: "SLP_TOKEN_TYPE_FUNGIBLE", number: 1 },
    atoms: 25n,
    isMintBaton: false,
  };
  const mock = reader({
    outputScript: OUTPUT_SCRIPT,
    utxos: [{
      outpoint: { txid: "44".repeat(32), outIdx: 0 },
      sats: 546n,
      isCoinbase: false,
      token,
    }],
  });

  const [utxo] = await provider(mock.client).getUtxos(REQUEST);
  assert.strictEqual(utxo?.token, token);
});

test("returns an empty UTXO set", async () => {
  const mock = reader({ outputScript: OUTPUT_SCRIPT, utxos: [] });
  assert.deepEqual(await provider(mock.client).getUtxos(REQUEST), []);
});

test("wraps Chronik errors with a stable provider error", async () => {
  const cause = new Error("Chronik unavailable");
  const mock = reader(cause);

  await assert.rejects(provider(mock.client).getUtxos(REQUEST), (error: unknown) => {
    assert.ok(error instanceof ChronikUtxoProviderError);
    assert.equal(error.code, "CHRONIK_UTXO_READ_FAILED");
    assert.equal(error.cause, cause);
    assert.match(error.message, /Failed to read Chronik UTXOs/);
    return true;
  });
});

test("does not read Chronik during construction or static-provider use", () => {
  const mock = reader({ outputScript: OUTPUT_SCRIPT, utxos: [] });
  new ChronikUtxoProvider({ endpoint: ENDPOINT, address: ADDRESS, client: mock.client });
  new StaticUtxoProvider([]).getUtxos();
  assert.deepEqual(mock.calls, []);
});

test("filters coinbase UTXOs because maturity cannot be established", async () => {
  const mock = reader({
    outputScript: OUTPUT_SCRIPT,
    utxos: [{
      outpoint: { txid: "55".repeat(32), outIdx: 1 },
      sats: 5_000_000_000n,
      isCoinbase: true,
    }],
  });

  assert.deepEqual(await provider(mock.client).getUtxos(REQUEST), []);
});

test("requires explicit endpoint and matching eCash address configuration", async () => {
  const mock = reader({ outputScript: OUTPUT_SCRIPT, utxos: [] });
  assert.throws(
    () => new ChronikUtxoProvider({ endpoint: "", address: ADDRESS, client: mock.client }),
    /Chronik endpoint is required/,
  );
  assert.throws(
    () => new ChronikUtxoProvider({ endpoint: ENDPOINT, address: "", client: mock.client }),
    /Chronik eCash address is required/,
  );
  await assert.rejects(
    provider(mock.client).getUtxos({ ...REQUEST, payer: Address.p2pkh("22".repeat(20)).toString() }),
    /payer must match the configured Chronik address/,
  );
  assert.deepEqual(mock.calls, []);
});
