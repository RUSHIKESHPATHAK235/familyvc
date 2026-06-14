"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSession, safeEqual, validateName, verifySession } = require("../src/auth");

const secret = "a-very-long-test-secret-that-is-over-thirty-two-characters";

test("validates family member names", () => {
  assert.equal(validateName("  Grandma   Jane  "), "Grandma Jane");
  assert.throws(() => validateName("<script>"), /valid name/);
});

test("compares secrets safely", () => {
  assert.equal(safeEqual("family", "family"), true);
  assert.equal(safeEqual("family", "stranger"), false);
});

test("creates and verifies a signed session", () => {
  const token = createSession({ name: "Rushi", secret, ttlMs: 1000, now: 100 });
  assert.equal(verifySession(token, secret, 500).name, "Rushi");
  assert.throws(() => verifySession(token, secret, 1100), /expired/);
  assert.throws(() => verifySession(`${token}x`, secret, 500), /Invalid/);
});
