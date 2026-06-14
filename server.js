"use strict";

require("dotenv").config();

const path = require("path");
const http = require("http");
const compression = require("compression");
const express = require("express");
const helmet = require("helmet");
const { Server } = require("socket.io");
const { loadConfig } = require("./src/config");
const { createApiRouter } = require("./src/routes");
const { createRoomState } = require("./src/room");
const { registerSocketHandlers } = require("./src/socket");

const config = loadConfig();
const app = express();
const server = http.createServer(app);
const publicDirectory = path.join(__dirname, "public");
const room = createRoomState({ maximumParticipants: 4, familyMembers: config.familyMembers });

app.set("trust proxy", config.trustProxy);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: "10kb" }));

function originAllowed(origin) {
  if (!origin || !config.isProduction || config.allowedOrigins.length === 0) return true;
  return config.allowedOrigins.includes(origin);
}

app.use("/api", createApiRouter({ config, room }));

app.use(express.static(publicDirectory, {
  etag: true,
  maxAge: config.isProduction ? "1h" : 0,
  setHeaders(response, filePath) {
    if (filePath.endsWith("index.html")) response.setHeader("Cache-Control", "no-cache");
  }
}));

app.get("*", (_request, response) => response.sendFile(path.join(publicDirectory, "index.html")));

const io = new Server(server, {
  serveClient: true,
  maxHttpBufferSize: 50_000,
  pingInterval: 15_000,
  pingTimeout: 20_000,
  cors: {
    origin(origin, callback) {
      callback(originAllowed(origin) ? null : new Error("Origin not allowed"), originAllowed(origin));
    },
    methods: ["GET", "POST"]
  }
});

registerSocketHandlers(io, { room, config });

server.listen(config.port, () => {
  console.log(`Pathak Family is running on port ${config.port} (${config.nodeEnv}).`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing Pathak Family.`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = { app, server };
