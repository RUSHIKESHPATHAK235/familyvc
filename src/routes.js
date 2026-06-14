"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { createSession, safeEqual, validateName, verifySession } = require("./auth");

function createApiRouter({ config, room }) {
  const router = express.Router();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many join attempts. Please wait and try again." }
  });

  router.post("/auth/join", authLimiter, (request, response) => {
    try {
      if (!safeEqual(request.body?.familyToken, config.familyToken)) {
        return response.status(401).json({ error: "That family token is not valid." });
      }
      const name = validateName(request.body?.name);
      const session = createSession({
        name,
        secret: config.sessionSecret,
        ttlMs: config.sessionTtlMs
      });
      return response.json({ session, name });
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }
  });

  router.get("/session", (request, response) => {
    try {
      const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const session = verifySession(token, config.sessionSecret);
      return response.json({ valid: true, name: session.name });
    } catch {
      return response.status(401).json({ valid: false });
    }
  });

  router.get("/config", (_request, response) => {
    const iceServers = [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
    ];
    if (config.turn) iceServers.push(config.turn);
    response.set("Cache-Control", "no-store").json({
      iceServers,
      maximumParticipants: room.maximumParticipants
    });
  });

  router.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      participants: room.participants.size
    });
  });

  return router;
}

module.exports = { createApiRouter };
