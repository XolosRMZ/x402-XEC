import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, computeResourceHash, parseAmountSats, type ResourceRequest } from "../src/index.js";

test("canonicalization recursively sorts object keys", () => {
  assert.equal(canonicalize({ z: [3, { b: true, a: null }], a: "first" }), '{"a":"first","z":[3,{"a":null,"b":true}]}');
});
test("query ordering and normalized origin/method are deterministic", () => {
  const first: ResourceRequest = { serverOrigin: "https://API.EXAMPLE.COM:443", method: "get", path: "/resource", query: [["b", "2"], ["a", "1"]] };
  const second: ResourceRequest = { serverOrigin: "https://api.example.com", method: "GET", path: "/resource", query: [["a", "1"], ["b", "2"]] };
  assert.equal(computeResourceHash(first), computeResourceHash(second));
});
test("amount parser rejects unsafe wire forms and returns bigint", () => {
  assert.equal(parseAmountSats("900719925474099312345"), 900719925474099312345n);
  for (const invalid of ["0", "01", "-1", "1.0", "1e3", " 1"]) assert.throws(() => parseAmountSats(invalid));
});
