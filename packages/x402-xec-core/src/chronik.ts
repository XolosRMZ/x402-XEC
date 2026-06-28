export interface ChronikTransactionOutput { readonly outputIndex: number; readonly valueSats: bigint; readonly lockingScriptHex: string; }
export interface ChronikTransaction { readonly txid: string; readonly outputs: readonly ChronikTransactionOutput[]; readonly blockHeight: number | null; readonly isCoinbase: boolean; }
/** Read-only boundary only: no implementation, endpoint configuration, or broadcast method is supplied. */
export interface ChronikClient { getTransaction(txid: string): Promise<ChronikTransaction | null>; }
