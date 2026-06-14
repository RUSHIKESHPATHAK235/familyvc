"use strict";

const { validateName, verifySession } = require("./auth");

const ROOM_ID = "family-room";

function cleanMessage(value) {
  const text = String(value || "").normalize("NFKC").trim();
  if (!text || text.length > 1000) {
    throw new Error("Messages must contain 1–1000 characters.");
  }
  return text;
}

function registerSocketHandlers(io, { room, config }) {
  io.use((socket, next) => {
    try {
      const session = verifySession(socket.handshake.auth?.session, config.sessionSecret);
      socket.data.name = validateName(session.name);
      next();
    } catch {
      next(new Error("AUTH_REQUIRED"));
    }
  });

  io.on("connection", (socket) => {
    try {
      const participant = room.join({ id: socket.id, name: socket.data.name });
      socket.join(ROOM_ID);
      socket.emit("room:ready", {
        self: participant,
        participants: room.listParticipants().filter(({ id }) => id !== socket.id),
        history: room.history,
        presence: room.presence()
      });
      socket.to(ROOM_ID).emit("participant:joined", participant);
      io.to(ROOM_ID).emit("presence:update", room.presence());
    } catch (error) {
      socket.emit("room:error", { message: error.message });
      socket.disconnect(true);
      return;
    }

    socket.on("signal:offer", ({ targetId, description } = {}) => {
      if (room.participants.has(targetId) && description?.type === "offer") {
        io.to(targetId).emit("signal:offer", { fromId: socket.id, description });
      }
    });

    socket.on("signal:answer", ({ targetId, description } = {}) => {
      if (room.participants.has(targetId) && description?.type === "answer") {
        io.to(targetId).emit("signal:answer", { fromId: socket.id, description });
      }
    });

    socket.on("signal:ice", ({ targetId, candidate } = {}) => {
      if (room.participants.has(targetId) && candidate) {
        io.to(targetId).emit("signal:ice", { fromId: socket.id, candidate });
      }
    });

    socket.on("participant:update", (patch = {}) => {
      const participant = room.update(socket.id, patch);
      if (participant) io.to(ROOM_ID).emit("participant:updated", participant);
    });

    socket.on("chat:send", (payload = {}, acknowledge = () => {}) => {
      try {
        const message = room.addMessage({
          senderId: socket.id,
          senderName: socket.data.name,
          text: cleanMessage(payload.text)
        });
        io.to(ROOM_ID).emit("chat:message", message);
        acknowledge({ ok: true, messageId: message.id });
      } catch (error) {
        acknowledge({ ok: false, error: error.message });
      }
    });

    socket.on("chat:typing", (isTyping) => {
      socket.to(ROOM_ID).emit("chat:typing", {
        participantId: socket.id,
        name: socket.data.name,
        isTyping: Boolean(isTyping)
      });
    });

    socket.on("disconnect", () => {
      const participant = room.leave(socket.id);
      if (!participant) return;
      socket.to(ROOM_ID).emit("participant:left", participant);
      io.to(ROOM_ID).emit("presence:update", room.presence());
    });
  });
}

module.exports = { cleanMessage, registerSocketHandlers };

