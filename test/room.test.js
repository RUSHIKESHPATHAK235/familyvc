"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRoomState } = require("../src/room");

test("enforces room capacity and tracks presence", () => {
  const room = createRoomState({ maximumParticipants: 2, familyMembers: ["Mom", "Dad"] });
  room.join({ id: "one", name: "Mom" });
  room.join({ id: "two", name: "Aunt" });
  assert.equal(room.presence().online.length, 2);
  assert.deepEqual(room.presence().offline, ["Dad"]);
  assert.throws(() => room.join({ id: "three", name: "Uncle" }), /full/);
});

test("keeps bounded session chat history", () => {
  const room = createRoomState({ historyLimit: 2 });
  room.addMessage({ senderId: "1", senderName: "Mom", text: "One" });
  room.addMessage({ senderId: "1", senderName: "Mom", text: "Two" });
  room.addMessage({ senderId: "1", senderName: "Mom", text: "Three" });
  assert.equal(room.history.length, 2);
  assert.equal(room.history[0].text, "Two");
});
