"use strict";

const crypto = require("crypto");

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseMembers(value) {
  return [...new Set(
    String(value || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 30)
  )];
}

function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const familyToken = env.FAMILY_TOKEN || (isProduction ? "" : "family-demo");
  const sessionSecret =
    env.SESSION_SECRET ||
    (isProduction ? "" : crypto.createHash("sha256").update("family-connect-development").digest("hex"));

  if (!familyToken) {
    throw new Error("FAMILY_TOKEN is required in production.");
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return {
    nodeEnv: env.NODE_ENV || "development",
    isProduction,
    port: Number.parseInt(env.PORT || "3000", 10),
    trustProxy: Number.parseInt(env.TRUST_PROXY || "1", 10),
    familyToken,
    sessionSecret,
    sessionTtlMs: Number.parseInt(env.SESSION_TTL_HOURS || "168", 10) * 60 * 60 * 1000,
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    familyMembers: parseMembers(env.FAMILY_MEMBERS),
    turn: env.TURN_URL
      ? {
          urls: env.TURN_URL.split(",").map((url) => url.trim()).filter(Boolean),
          username: env.TURN_USERNAME || "",
          credential: env.TURN_CREDENTIAL || ""
        }
      : null
  };
}

module.exports = { loadConfig, parseMembers, parseOrigins };

