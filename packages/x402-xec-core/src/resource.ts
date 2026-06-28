import { canonicalHash, type CanonicalValue } from "./canonicalize.js";

export type QueryPair = readonly [key: string, value: string];
export interface ResourceRequest {
  readonly serverOrigin: string;
  readonly method: string;
  readonly path: string;
  readonly query?: readonly QueryPair[];
  readonly body?: CanonicalValue;
}
const HTTP_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function normalizeServerOrigin(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new TypeError("serverOrigin must be an absolute URL"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new TypeError("serverOrigin must use http or https");
  if (url.username || url.password) throw new TypeError("serverOrigin must not contain credentials");
  if (url.pathname !== "/" || url.search || url.hash) throw new TypeError("serverOrigin must not contain a path, query, or fragment");
  return url.origin;
}
export function normalizeMethod(method: string): string {
  if (!HTTP_TOKEN.test(method)) throw new TypeError("method must be a valid HTTP token");
  return method.toUpperCase();
}
export function validatePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#")) throw new TypeError("path must be origin-form without query or fragment");
  return path;
}
export function canonicalQuery(query: readonly QueryPair[] = []): readonly QueryPair[] {
  return query.map(([k, v]) => [k, v] as const).sort(([ak, av], [bk, bv]) => ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : (ak < bk ? -1 : 1));
}
export function computeBodyAndQueryHash(request: ResourceRequest): string {
  return canonicalHash({ body: request.body ?? null, query: canonicalQuery(request.query) });
}
export function computeResourceHash(request: ResourceRequest): string {
  return canonicalHash({
    bodyAndQueryHash: computeBodyAndQueryHash(request),
    method: normalizeMethod(request.method),
    path: validatePath(request.path),
    serverOrigin: normalizeServerOrigin(request.serverOrigin),
  });
}
