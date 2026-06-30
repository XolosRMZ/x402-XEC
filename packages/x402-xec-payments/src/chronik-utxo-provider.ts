import { XEC_MAINNET } from "@x402-xec/core";
import type { FundingUtxo } from "@x402-xec/transactions";
import { ChronikClient } from "chronik-client";
import { Address } from "ecash-lib";
import type {
  UtxoProvider,
  UtxoProviderRequest,
} from "./index.js";

interface ChronikUtxo {
  readonly outpoint: {
    readonly txid: string;
    readonly outIdx: number;
  };
  readonly sats: bigint;
  readonly isCoinbase: boolean;
  readonly token?: unknown;
}

interface ChronikUtxoSet {
  readonly outputScript: string;
  readonly utxos: readonly ChronikUtxo[];
}

interface ChronikAddressEndpoint {
  utxos(): Promise<ChronikUtxoSet>;
}

/** Read-only Chronik client subset used by `ChronikUtxoProvider`. */
export interface ChronikUtxoReader {
  address(address: string): ChronikAddressEndpoint;
}

export interface ChronikUtxoProviderConfig {
  /** Explicit Chronik HTTP(S) endpoint. There is intentionally no default. */
  readonly endpoint: string;
  /** Explicit eCash mainnet address whose UTXOs may be read. */
  readonly address: string;
  /** Test seam for mocked Chronik responses; production callers should omit it. */
  readonly client?: ChronikUtxoReader;
}

export class ChronikUtxoProviderError extends Error {
  readonly code = "CHRONIK_UTXO_READ_FAILED";

  constructor(address: string, options?: ErrorOptions) {
    super(`Failed to read Chronik UTXOs for ${address}`, options);
    this.name = "ChronikUtxoProviderError";
  }
}

/**
 * Opt-in, read-only UTXO discovery for one explicitly configured eCash address.
 *
 * The provider filters all coinbase UTXOs because it cannot establish maturity
 * from the address UTXO response alone. Token metadata is retained so the
 * transaction builder can reject token-bearing UTXOs. No broadcast or key
 * custody capability is exposed.
 */
export class ChronikUtxoProvider implements UtxoProvider {
  readonly endpoint: string;
  readonly address: string;
  readonly #client: ChronikUtxoReader;

  constructor(config: ChronikUtxoProviderConfig) {
    this.endpoint = validateEndpoint(config.endpoint);
    this.address = validateAddress(config.address);
    this.#client = config.client ?? new ChronikClient([this.endpoint]);
  }

  async getUtxos(
    request: UtxoProviderRequest,
  ): Promise<readonly FundingUtxo[]> {
    if (request.network !== XEC_MAINNET) {
      throw new Error(`unsupported x402-XEC network: ${request.network}`);
    }
    if (request.payer !== this.address) {
      throw new Error(
        "UtxoProvider payer must match the configured Chronik address",
      );
    }

    try {
      const response = await this.#client.address(this.address).utxos();
      if (!Array.isArray(response.utxos)) {
        throw new TypeError("Chronik UTXO response must contain an array");
      }
      return response.utxos
        .filter((utxo) => {
          if (typeof utxo.isCoinbase !== "boolean") {
            throw new TypeError("Chronik UTXO isCoinbase must be boolean");
          }
          return !utxo.isCoinbase;
        })
        .map((utxo) => mapUtxo(utxo, response.outputScript));
    } catch (error) {
      if (error instanceof ChronikUtxoProviderError) throw error;
      throw new ChronikUtxoProviderError(this.address, { cause: error });
    }
  }
}

function mapUtxo(
  utxo: ChronikUtxo,
  outputScript: string,
): FundingUtxo {
  if (!/^[0-9a-f]{64}$/.test(utxo.outpoint.txid)) {
    throw new TypeError("Chronik UTXO txid must be 64 lowercase hex characters");
  }
  if (!Number.isSafeInteger(utxo.outpoint.outIdx) || utxo.outpoint.outIdx < 0) {
    throw new TypeError("Chronik UTXO outIdx must be a non-negative safe integer");
  }
  if (typeof utxo.sats !== "bigint" || utxo.sats <= 0n) {
    throw new TypeError("Chronik UTXO sats must be a positive bigint");
  }
  if (!/^(?:[0-9a-f]{2})+$/.test(outputScript)) {
    throw new TypeError(
      "Chronik UTXO outputScript must be non-empty lowercase hex",
    );
  }

  return {
    txid: utxo.outpoint.txid,
    outIdx: utxo.outpoint.outIdx,
    sats: utxo.sats.toString(10),
    outputScript,
    ...(utxo.token === undefined ? {} : { token: utxo.token }),
  };
}

function validateEndpoint(endpoint: string): string {
  if (endpoint.length === 0) throw new TypeError("Chronik endpoint is required");
  if (endpoint.endsWith("/")) {
    throw new TypeError("Chronik endpoint must not end with '/'");
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new TypeError("Chronik endpoint must be a valid HTTP(S) URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TypeError("Chronik endpoint must be a valid HTTP(S) URL");
  }
  return endpoint;
}

function validateAddress(address: string): string {
  if (address.length === 0) {
    throw new TypeError("Chronik eCash address is required");
  }

  let parsed: Address;
  try {
    parsed = Address.fromCashAddress(address);
  } catch {
    throw new TypeError("Chronik address must be a valid eCash cash address");
  }
  if (parsed.prefix !== "ecash") {
    throw new TypeError("Chronik address must use the ecash mainnet prefix");
  }
  return address;
}
