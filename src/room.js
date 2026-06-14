"use strict";

const crypto = require("crypto");

function createRoomState({ maximumParticipants = 4, historyLimit = 100, familyMembers = [] } = {}) {
  const participants = new Map();
  const history = [];

  function publicParticipant(participant) {
    return {
      id: participant.id,
      name: participant.name,
      joinedAt: participant.joinedAt,
      audioEnabled: participant.audioEnabled,
      videoEnabled: participant.videoEnabled,
      quality: participant.quality || "connecting"
    };
  }

  function listParticipants() {
    return [...participants.values()].map(publicParticipant);
  }

  function presence() {
    const onlineNames = new Set([...participants.values()].map(({ name }) => name.toLocaleLowerCase()));
    return {
      online: listParticipants(),
      offline: familyMembers.filter((name) => !onlineNames.has(name.toLocaleLowerCase()))
    };
  }

  function join({ id, name }) {
    if (participants.size >= maximumParticipants) {
      throw new Error(`The family room is full (${maximumParticipants} participants maximum).`);
    }
    const participant = {
      id,
      name,
      joinedAt: new Date().toISOString(),
      audioEnabled: true,
      videoEnabled: true,
      quality: "connecting"
    };
    participants.set(id, participant);
    return publicParticipant(participant);
  }

  function leave(id) {
    const participant = participants.get(id);
    participants.delete(id);
    return participant ? publicParticipant(participant) : null;
  }

  function update(id, patch) {
    const participant = participants.get(id);
    if (!participant) return null;
    if (typeof patch.audioEnabled === "boolean") participant.audioEnabled = patch.audioEnabled;
    if (typeof patch.videoEnabled === "boolean") participant.videoEnabled = patch.videoEnabled;
    if (["excellent", "good", "fair", "poor", "connecting"].includes(patch.quality)) {
      participant.quality = patch.quality;
    }
    return publicParticipant(participant);
  }

  function addMessage({ senderId, senderName, text }) {
    const message = {
      id: crypto.randomUUID(),
      senderId,
      senderName,
      text,
      sentAt: new Date().toISOString()
    };
    history.push(message);
    if (history.length > historyLimit) history.shift();
    return message;
  }

  return {
    addMessage,
    history,
    join,
    leave,
    listParticipants,
    maximumParticipants,
    participants,
    presence,
    update
  };
}

module.exports = { createRoomState };

