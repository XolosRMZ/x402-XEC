import { canonicalHash } from "./canonicalize.js";
import { computeResourceHash, type ResourceRequest } from "./resource.js";
import { invoiceSchema, type Invoice, X402_VERSION, XEC_MAINNET, XEC_SCHEME } from "./schemas.js";

export interface CreateInvoiceInput {
  readonly request: ResourceRequest; readonly amountSats: bigint; readonly payTo: string;
  readonly nonce: string; readonly issuedAt: number; readonly expiresAt: number;
}
export function createInvoice(input: CreateInvoiceInput): Invoice {
  if (input.amountSats <= 0n) throw new RangeError("amountSats must be positive");
  return invoiceSchema.parse({
    x402Version: X402_VERSION, scheme: XEC_SCHEME, network: XEC_MAINNET,
    resourceHash: computeResourceHash(input.request), amountSats: input.amountSats.toString(10),
    payTo: input.payTo, nonce: input.nonce, issuedAt: input.issuedAt, expiresAt: input.expiresAt,
  });
}
export const computeInvoiceHash = (invoice: Invoice): string => canonicalHash(invoiceSchema.parse(invoice));
