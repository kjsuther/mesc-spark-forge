import assert from "node:assert/strict";
import test from "node:test";

import { applySecurityHeaders, SECURITY_HEADERS } from "./security-headers.ts";

test("adds reputation-oriented security headers without changing the response", async () => {
  const original = new Response("trail ready", {
    status: 202,
    statusText: "Accepted",
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain",
    },
  });

  const secured = applySecurityHeaders(original);

  assert.equal(secured.status, 202);
  assert.equal(secured.statusText, "Accepted");
  assert.equal(secured.headers.get("cache-control"), "no-store");
  assert.equal(secured.headers.get("content-type"), "text/plain");
  assert.equal(await secured.text(), "trail ready");

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(secured.headers.get(name), value);
  }
});

test("allows the same-origin poster iframe while blocking unknown frames", () => {
  const policy = SECURITY_HEADERS["Content-Security-Policy"];
  assert.match(policy, /frame-ancestors 'self'/);
  assert.match(policy, /frame-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.equal(SECURITY_HEADERS["X-Frame-Options"], "SAMEORIGIN");
});
