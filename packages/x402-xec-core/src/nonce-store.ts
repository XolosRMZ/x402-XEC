export interface NonceStore {
  /** Atomically returns true and records an unused nonce; distributed implementations must use compare-and-set. */
  consume(nonce: string, expiresAt: number, now: number): Promise<boolean>;
}
export class InMemoryNonceStore implements NonceStore {
  readonly #consumed = new Map<string, number>();
  async consume(nonce: string, expiresAt: number, now: number): Promise<boolean> {
    for (const [key, expiry] of this.#consumed) if (expiry <= now) this.#consumed.delete(key);
    if (this.#consumed.has(nonce)) return false;
    this.#consumed.set(nonce, expiresAt);
    return true;
  }
}
