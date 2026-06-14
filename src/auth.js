"use strict";

const crypto = require("crypto");

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._'’-]{0,39}$/u;

function normalizeName(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function validateName(value) {
  const name = normalizeName(value);
  if (!NAME_PATTERN.test(name)) {
    throw new Error("Enter a valid name using 1–40 letters, numbers, spaces, apostrophes, dots, or hyphens.");
  }
  return name;
}

function safeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left || "")).digest();
  const rightHash = crypto.createHash("sha256").update(String(right || "")).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(encodedPayload, secret) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function createSession({ name, secret, ttlMs, now = Date.now() }) {
  const payload = encode(JSON.stringify({
    name: validateName(name),
    issuedAt: now,
    expiresAt: now + ttlMs,
    nonce: crypto.randomBytes(12).toString("base64url")
  }));
  return `${payload}.${sign(payload, secret)}`;
}

function verifySession(token, secret, now = Date.now()) {
  const [payload, signature, extra] = String(token || "").split(".");
  if (!payload || !signature || extra || !safeEqual(signature, sign(payload, secret))) {
    throw new Error("Invalid session.");
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid session.");
  }

  if (!data.expiresAt || now >= data.expiresAt) {
    throw new Error("Session expired.");
  }
  data.name = validateName(data.name);
  return data;
}

module.exports = { createSession, normalizeName, safeEqual, validateName, verifySession };

