(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const SESSION_KEY = "familyConnect.session";
  const NAME_KEY = "familyConnect.name";
  const SETTINGS_KEY = "familyConnect.settings";
  const EMOJIS = ["😀", "😂", "🥰", "😍", "🤗", "😊", "❤️", "💜", "🎉", "👍", "🙏", "👋", "✨", "☕", "🍰", "🌸", "🏡", "📸"];

  const elements = {
    loadingScreen: $("#loadingScreen"),
    welcomeView: $("#welcomeView"),
    callView: $("#callView"),
    serverStatus: $("#serverStatus"),
    permissionBadge: $("#permissionBadge"),
    previewVideo: $("#previewVideo"),
    previewPlaceholder: $("#previewPlaceholder"),
    previewAvatar: $("#previewAvatar"),
    previewVolume: $("#previewVolume"),
    previewMicButton: $("#previewMicButton"),
    previewCameraButton: $("#previewCameraButton"),
    joinForm: $("#joinForm"),
    nameInput: $("#nameInput"),
    tokenInput: $("#tokenInput"),
    showTokenButton: $("#showTokenButton"),
    joinButton: $("#joinButton"),
    joinError: $("#joinError"),
    quickRejoinButton: $("#quickRejoinButton"),
    quickName: $("#quickName"),
    quickAvatar: $("#quickAvatar"),
    videoGrid: $("#videoGrid"),
    sessionTimer: $("#sessionTimer"),
    latencyDisplay: $("#latencyDisplay"),
    networkBadge: $("#networkBadge"),
    participantCount: $("#participantCount"),
    peopleButton: $("#peopleButton"),
    sidePanel: $("#sidePanel"),
    panelBackdrop: $("#panelBackdrop"),
    closePanelButton: $("#closePanelButton"),
    chatButton: $("#chatButton"),
    panelTabs: $$(".panel-tab"),
    chatPanel: $("#chatPanel"),
    peoplePanel: $("#peoplePanel"),
    messageList: $("#messageList"),
    typingIndicator: $("#typingIndicator"),
    chatForm: $("#chatForm"),
    chatInput: $("#chatInput"),
    emojiButton: $("#emojiButton"),
    emojiTray: $("#emojiTray"),
    unreadBadge: $("#unreadBadge"),
    controlUnread: $("#controlUnread"),
    onlineList: $("#onlineList"),
    offlineList: $("#offlineList"),
    offlineSection: $("#offlineSection"),
    onlineCount: $("#onlineCount"),
    micButton: $("#micButton"),
    cameraButton: $("#cameraButton"),
    fullscreenButton: $("#fullscreenButton"),
    settingsButton: $("#settingsButton"),
    copyTokenButton: $("#copyTokenButton"),
    leaveButton: $("#leaveButton"),
    settingsDialog: $("#settingsDialog"),
    closeSettingsButton: $("#closeSettingsButton"),
    cameraSelect: $("#cameraSelect"),
    microphoneSelect: $("#microphoneSelect"),
    speakerSelect: $("#speakerSelect"),
    resolutionSelect: $("#resolutionSelect"),
    mirrorToggle: $("#mirrorToggle"),
    motionToggle: $("#motionToggle"),
    settingsTabs: $$(".settings-tab"),
    settingsPages: $$(".settings-page"),
    themeOptions: $$(".theme-option"),
    diagnosticConnection: $("#diagnosticConnection"),
    diagnosticLatency: $("#diagnosticLatency"),
    diagnosticDownlink: $("#diagnosticDownlink"),
    diagnosticPeers: $("#diagnosticPeers"),
    runDiagnosticButton: $("#runDiagnosticButton"),
    leaveDialog: $("#leaveDialog"),
    cancelLeaveButton: $("#cancelLeaveButton"),
    confirmLeaveButton: $("#confirmLeaveButton"),
    toastContainer: $("#toastContainer")
  };

  const state = {
    session: localStorage.getItem(SESSION_KEY) || "",
    name: localStorage.getItem(NAME_KEY) || "",
    familyToken: "",
    config: { iceServers: [], maximumParticipants: 4 },
    socket: null,
    localStream: null,
    previewActive: false,
    joined: false,
    audioEnabled: true,
    videoEnabled: true,
    peers: new Map(),
    participants: new Map(),
    pendingCandidates: new Map(),
    analyzers: new Map(),
    audioContext: null,
    speakingFrame: null,
    timerInterval: null,
    statsInterval: null,
    latencyInterval: null,
    sessionStartedAt: 0,
    unread: 0,
    typingMembers: new Map(),
    typingTimeout: null,
    selectedSpeaker: "",
    offlineMembers: [],
    settings: {
      resolution: "720",
      mirror: true,
      reduceMotion: false,
      theme: "midnight",
      ...readSettings()
    }
  };

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }

  function initials(name) {
    return String(name || "Family")
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  function avatarGradient(name) {
    const palettes = [
      ["#7367ff", "#38a7e8"],
      ["#dd5d91", "#f39461"],
      ["#25af99", "#5879e8"],
      ["#9b5fe0", "#e55f8c"],
      ["#4776e6", "#8e54e9"]
    ];
    const score = [...String(name)].reduce((total, character) => total + character.charCodeAt(0), 0);
    return palettes[score % palettes.length];
  }

  function setAvatar(element, name) {
    if (!element) return;
    const [first, second] = avatarGradient(name);
    element.textContent = initials(name);
    element.style.background = `linear-gradient(135deg, ${first}, ${second})`;
  }

  function toast(title, message, type = "info", duration = 3800) {
    const item = document.createElement("div");
    item.className = `toast ${type}`;

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = type === "error" ? "!" : type === "success" ? "✓" : "✦";

    const copy = document.createElement("div");
    const heading = document.createElement("strong");
    const body = document.createElement("p");
    heading.textContent = title;
    body.textContent = message;
    copy.append(heading, body);

    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";

    const remove = () => {
      item.classList.add("leaving");
      setTimeout(() => item.remove(), 260);
    };
    close.addEventListener("click", remove);
    item.append(icon, copy, close);
    elements.toastContainer.append(item);
    setTimeout(remove, duration);
  }

  function applyPreferences() {
    document.body.dataset.theme = state.settings.theme;
    document.body.classList.toggle("reduce-motion", Boolean(state.settings.reduceMotion));
    elements.resolutionSelect.value = state.settings.resolution;
    elements.mirrorToggle.checked = Boolean(state.settings.mirror);
    elements.motionToggle.checked = Boolean(state.settings.reduceMotion);
    elements.themeOptions.forEach((button) => button.classList.toggle("active", button.dataset.theme === state.settings.theme));
  }

  function mediaConstraints() {
    const heights = { "360": 360, "480": 480, "720": 720 };
    const height = heights[state.settings.resolution] || 720;
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      video: {
        width: { ideal: Math.round(height * 16 / 9) },
        height: { ideal: height },
        frameRate: { ideal: 30, max: 30 },
        facingMode: "user"
      }
    };
  }

  async function checkServer() {
    const started = performance.now();
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Server unavailable");
      const latency = Math.round(performance.now() - started);
      elements.serverStatus.className = "status-pill online";
      elements.serverStatus.lastElementChild.textContent = "Private room is ready";
      return latency;
    } catch {
      elements.serverStatus.className = "status-pill offline";
      elements.serverStatus.lastElementChild.textContent = "Server unavailable";
      return null;
    }
  }

  async function validateSavedSession() {
    if (!state.session) return false;
    try {
      const response = await fetch("/api/session", {
        headers: { Authorization: `Bearer ${state.session}` },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Session expired");
      const data = await response.json();
      state.name = data.name;
      localStorage.setItem(NAME_KEY, data.name);
      elements.quickName.textContent = data.name;
      setAvatar(elements.quickAvatar, data.name);
      elements.nameInput.value = data.name;
      elements.quickRejoinButton.classList.remove("hidden");
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  function clearSession() {
    state.session = "";
    localStorage.removeItem(SESSION_KEY);
  }

  async function ensureLocalMedia({ quiet = false } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState("denied", "Browser unsupported");
      if (!quiet) toast("Browser unsupported", "Use a current version of Chrome, Edge, Safari, or Firefox.", "error");
      throw new Error("This browser does not support camera and microphone access.");
    }

    if (state.localStream?.getTracks().some((track) => track.readyState === "live")) {
      return state.localStream;
    }

    setPermissionState("", "Requesting permission");
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints());
      state.previewActive = true;
      state.audioEnabled = true;
      state.videoEnabled = true;
      elements.previewVideo.srcObject = state.localStream;
      elements.previewPlaceholder.classList.add("hidden");
      setPermissionState("ready", "Devices ready");
      await populateDevices();
      setupAnalyzer("preview", state.localStream, elements.previewVolume);
      updatePreviewButtons();
      return state.localStream;
    } catch (error) {
      setPermissionState("denied", error.name === "NotAllowedError" ? "Permission denied" : "Devices unavailable");
      elements.previewPlaceholder.classList.remove("hidden");
      state.localStream = new MediaStream();
      state.audioEnabled = false;
      state.videoEnabled = false;
      updatePreviewButtons();
      if (!quiet) {
        const message = error.name === "NotAllowedError"
          ? "You can still join to listen and chat. Enable devices later in browser settings."
          : "No camera or microphone was found. You can still join to listen and chat.";
        toast("Joining without devices", message, "error", 5200);
      }
      return state.localStream;
    }
  }

  function setPermissionState(className, label) {
    elements.permissionBadge.className = `mini-pill ${className}`.trim();
    elements.permissionBadge.lastChild.textContent = ` ${label}`;
  }

  function updatePreviewButtons() {
    elements.previewMicButton.classList.toggle("off", !state.audioEnabled);
    elements.previewCameraButton.classList.toggle("off", !state.videoEnabled);
  }

  async function populateDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    fillDeviceSelect(elements.cameraSelect, devices.filter((device) => device.kind === "videoinput"), "Camera");
    fillDeviceSelect(elements.microphoneSelect, devices.filter((device) => device.kind === "audioinput"), "Microphone");
    fillDeviceSelect(elements.speakerSelect, devices.filter((device) => device.kind === "audiooutput"), "Speaker");
    elements.speakerSelect.disabled = typeof HTMLMediaElement.prototype.setSinkId !== "function";
  }

  function fillDeviceSelect(select, devices, fallback) {
    const previous = select.value;
    select.replaceChildren();
    devices.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `${fallback} ${index + 1}`;
      select.append(option);
    });
    if (devices.some((device) => device.deviceId === previous)) select.value = previous;
    if (!devices.length) {
      const option = document.createElement("option");
      option.textContent = `No ${fallback.toLowerCase()} found`;
      select.append(option);
    }
  }

  function setupAnalyzer(id, stream, volumeElement = null) {
    if (!stream?.getAudioTracks().length) return;
    try {
      state.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (state.audioContext.state === "suspended") state.audioContext.resume();
      const source = state.audioContext.createMediaStreamSource(stream);
      const analyzer = state.audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.72;
      source.connect(analyzer);
      state.analyzers.set(id, { analyzer, data: new Uint8Array(analyzer.frequencyBinCount), volumeElement });
      if (!state.speakingFrame) monitorSpeaking();
    } catch {
      // Audio metering is an enhancement; calls continue without it.
    }
  }

  function monitorSpeaking() {
    state.analyzers.forEach(({ analyzer, data, volumeElement }, id) => {
      analyzer.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      const level = Math.min(100, Math.max(0, (average - 4) * 2.2));
      if (volumeElement) volumeElement.style.width = `${level}%`;
      const tile = document.querySelector(`[data-participant-id="${CSS.escape(id === "preview" ? "local" : id)}"]`);
      if (tile) tile.classList.toggle("speaking", average > 19 && participantAudioEnabled(id));
    });
    state.speakingFrame = requestAnimationFrame(monitorSpeaking);
  }

  function participantAudioEnabled(id) {
    if (id === "local" || id === "preview") return state.audioEnabled;
    return state.participants.get(id)?.audioEnabled !== false;
  }

  async function authenticate(name, familyToken) {
    const response = await fetch("/api/auth/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, familyToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to join right now.");
    state.session = data.session;
    state.name = data.name;
    state.familyToken = familyToken;
    localStorage.setItem(SESSION_KEY, data.session);
    localStorage.setItem(NAME_KEY, data.name);
  }

  async function enterCall() {
    if (state.joined) return;
    elements.joinError.textContent = "";
    elements.joinButton.disabled = true;
    elements.joinButton.querySelector("span").textContent = "Opening your room…";

    try {
      await ensureLocalMedia();
      state.config = await fetch("/api/config", { cache: "no-store" }).then((response) => response.json());
      state.joined = true;
      state.sessionStartedAt = Date.now();
      elements.welcomeView.classList.add("hidden");
      elements.callView.classList.remove("hidden");
      createLocalTile();
      startTimers();
      connectSocket();
      window.history.replaceState({}, "", "/room");
    } catch (error) {
      elements.joinError.textContent = error.message || "Unable to open your room.";
    } finally {
      elements.joinButton.disabled = false;
      elements.joinButton.querySelector("span").textContent = "Join family room";
    }
  }

  function connectSocket() {
    if (typeof window.io !== "function") {
      toast("Connection unavailable", "The real-time client could not load. Refresh the page.", "error");
      return;
    }

    state.socket = window.io({
      auth: { session: state.session },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5000,
      timeout: 12000
    });

    state.socket.on("connect", () => {
      setNetworkQuality("good", "Connected");
      if (state.socket.recovered) toast("Welcome back", "Your connection recovered automatically.", "success");
    });

    state.socket.on("room:ready", ({ self, participants, history, presence }) => {
      resetRemotePeers();
      state.participants.clear();
      state.participants.set(self.id, { ...self, isSelf: true });
      participants.forEach((participant) => state.participants.set(participant.id, participant));
      renderPresence(presence);
      renderHistory(history);
      participants.forEach((participant) => {
        ensureRemoteTile(participant);
        createPeer(participant.id, true);
      });
      updateGrid();
      toast("You’re in", `Welcome to the family room, ${state.name}.`, "success");
    });

    state.socket.on("participant:joined", (participant) => {
      state.participants.set(participant.id, participant);
      ensureRemoteTile(participant);
      addSystemMessage(`${participant.name} joined the room`);
      updateGrid();
      toast("Family joined", `${participant.name} is here.`, "success");
    });

    state.socket.on("participant:left", (participant) => {
      removePeer(participant.id);
      state.participants.delete(participant.id);
      addSystemMessage(`${participant.name} left the room`);
      updateGrid();
      toast("Family left", `${participant.name} left the call.`);
    });

    state.socket.on("participant:updated", (participant) => {
      const existing = state.participants.get(participant.id) || {};
      state.participants.set(participant.id, { ...existing, ...participant });
      updateTileState(participant.id);
      renderPresence();
    });

    state.socket.on("presence:update", renderPresence);
    state.socket.on("signal:offer", handleOffer);
    state.socket.on("signal:answer", handleAnswer);
    state.socket.on("signal:ice", handleIce);
    state.socket.on("chat:message", receiveMessage);
    state.socket.on("chat:typing", handleTyping);

    state.socket.on("room:error", ({ message }) => {
      toast("Room unavailable", message, "error", 6000);
      setTimeout(() => leaveCall(false), 800);
    });

    state.socket.on("connect_error", (error) => {
      if (error.message === "AUTH_REQUIRED") {
        clearSession();
        toast("Session expired", "Please enter the family token again.", "error", 5000);
        leaveCall(false);
      } else {
        setNetworkQuality("poor", "Reconnecting");
      }
    });

    state.socket.on("disconnect", (reason) => {
      setNetworkQuality("poor", "Reconnecting");
      if (reason !== "io client disconnect") toast("Connection lost", "Trying to reconnect automatically…", "error");
    });
  }

  function createLocalTile() {
    const tile = buildTile({
      id: "local",
      name: state.name,
      joinedAt: new Date().toISOString(),
      isSelf: true,
      audioEnabled: state.audioEnabled,
      videoEnabled: state.videoEnabled,
      quality: "excellent"
    });
    const video = $("video", tile);
    video.muted = true;
    video.srcObject = state.localStream;
    video.classList.toggle("mirrored", state.settings.mirror);
    elements.videoGrid.append(tile);
    state.analyzers.delete("preview");
    setupAnalyzer("local", state.localStream);
    updateGrid();
  }

  function buildTile(participant) {
    const tile = document.createElement("article");
    tile.className = `video-tile${participant.isSelf ? " local" : ""}`;
    tile.dataset.participantId = participant.id;

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;

    const empty = document.createElement("div");
    empty.className = "tile-empty";
    const avatar = document.createElement("div");
    avatar.className = "participant-avatar";
    setAvatar(avatar, participant.name);
    const cameraMessage = document.createElement("p");
    cameraMessage.textContent = "Camera is off";
    empty.append(avatar, cameraMessage);

    const top = document.createElement("div");
    top.className = "tile-top";
    if (participant.isSelf) {
      const you = document.createElement("span");
      you.className = "tile-chip";
      you.textContent = "You";
      top.append(you);
    }

    const overlay = document.createElement("div");
    overlay.className = "tile-overlay";
    const info = document.createElement("div");
    info.className = "participant-info";
    const mic = document.createElement("span");
    mic.className = "mic-state";
    mic.textContent = "⌁";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    const joined = document.createElement("small");
    name.textContent = participant.name;
    joined.textContent = `Joined ${formatTime(participant.joinedAt)}`;
    details.append(name, joined);
    info.append(mic, details);

    const quality = document.createElement("div");
    quality.className = "tile-quality";
    const dot = document.createElement("i");
    dot.className = `quality-dot ${participant.quality || "connecting"}`;
    const qualityText = document.createElement("span");
    qualityText.textContent = participant.quality || "connecting";
    quality.append(dot, qualityText);
    overlay.append(info, quality);
    tile.append(video, empty, top, overlay);
    applyTileState(tile, participant);
    return tile;
  }

  function applyTileState(tile, participant) {
    const empty = $(".tile-empty", tile);
    const video = $("video", tile);
    const mic = $(".mic-state", tile);
    const qualityDot = $(".quality-dot", tile);
    const qualityText = $(".tile-quality span", tile);
    const videoEnabled = participant.isSelf ? state.videoEnabled : participant.videoEnabled !== false;
    const audioEnabled = participant.isSelf ? state.audioEnabled : participant.audioEnabled !== false;
    empty.classList.toggle("hidden", videoEnabled);
    video.classList.toggle("hidden", !videoEnabled);
    mic.classList.toggle("muted", !audioEnabled);
    mic.textContent = audioEnabled ? "⌁" : "×";
    const quality = participant.quality || "connecting";
    qualityDot.className = `quality-dot ${quality}`;
    qualityText.textContent = quality;
  }

  function updateTileState(id) {
    const tile = elements.videoGrid.querySelector(`[data-participant-id="${CSS.escape(id)}"]`);
    const participant = id === "local"
      ? { id, name: state.name, isSelf: true, audioEnabled: state.audioEnabled, videoEnabled: state.videoEnabled, quality: "excellent" }
      : state.participants.get(id);
    if (tile && participant) applyTileState(tile, participant);
  }

  function updateGrid() {
    const count = elements.videoGrid.children.length;
    elements.videoGrid.dataset.count = String(Math.max(1, Math.min(4, count)));
    elements.participantCount.textContent = String(Math.max(1, state.participants.size));
    elements.diagnosticPeers.textContent = String(state.peers.size);
    renderPresence();
  }

  function createPeer(participantId, shouldOffer = false) {
    removePeer(participantId);
    const connection = new RTCPeerConnection({ iceServers: state.config.iceServers });
    const peer = {
      connection,
      makingOffer: false,
      ignoreOffer: false,
      polite: state.socket.id > participantId,
      allowNegotiation: shouldOffer,
      restartAttempts: 0
    };
    state.peers.set(participantId, peer);

    state.localStream.getTracks().forEach((track) => connection.addTrack(track, state.localStream));

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) state.socket?.emit("signal:ice", { targetId: participantId, candidate });
    };

    connection.ontrack = ({ streams }) => {
      const stream = streams[0];
      attachRemoteStream(participantId, stream);
    };

    connection.onconnectionstatechange = () => {
      const status = connection.connectionState;
      if (status === "connected") {
        peer.restartAttempts = 0;
        updateParticipantQuality(participantId, "good");
      }
      if (status === "failed" && peer.restartAttempts < 2) {
        peer.restartAttempts += 1;
        restartPeer(participantId);
      }
      if (status === "closed") removePeer(participantId);
    };

    connection.onnegotiationneeded = async () => {
      if (!peer.allowNegotiation || connection.signalingState !== "stable") return;
      await makeOffer(participantId);
    };

    if (shouldOffer) queueMicrotask(() => makeOffer(participantId));
    return peer;
  }

  async function makeOffer(participantId, iceRestart = false) {
    const peer = state.peers.get(participantId);
    if (!peer || peer.makingOffer || peer.connection.signalingState === "closed") return;
    try {
      peer.makingOffer = true;
      const offer = await peer.connection.createOffer({ iceRestart });
      if (peer.connection.signalingState !== "stable") return;
      await peer.connection.setLocalDescription(offer);
      state.socket?.emit("signal:offer", {
        targetId: participantId,
        description: peer.connection.localDescription
      });
    } catch (error) {
      console.warn("Could not create WebRTC offer:", error);
    } finally {
      peer.makingOffer = false;
    }
  }

  async function handleOffer({ fromId, description }) {
    let peer = state.peers.get(fromId);
    if (!peer) peer = createPeer(fromId, false);
    const connection = peer.connection;
    const collision = peer.makingOffer || connection.signalingState !== "stable";
    peer.ignoreOffer = !peer.polite && collision;
    if (peer.ignoreOffer) return;

    try {
      if (collision) await connection.setLocalDescription({ type: "rollback" });
      await connection.setRemoteDescription(description);
      await flushCandidates(fromId);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      state.socket.emit("signal:answer", { targetId: fromId, description: connection.localDescription });
      peer.allowNegotiation = true;
    } catch (error) {
      console.warn("Could not handle WebRTC offer:", error);
    }
  }

  async function handleAnswer({ fromId, description }) {
    const peer = state.peers.get(fromId);
    if (!peer || peer.connection.signalingState !== "have-local-offer") return;
    try {
      await peer.connection.setRemoteDescription(description);
      await flushCandidates(fromId);
      peer.allowNegotiation = true;
    } catch (error) {
      console.warn("Could not handle WebRTC answer:", error);
    }
  }

  async function handleIce({ fromId, candidate }) {
    const peer = state.peers.get(fromId);
    if (!peer?.connection.remoteDescription) {
      const candidates = state.pendingCandidates.get(fromId) || [];
      candidates.push(candidate);
      state.pendingCandidates.set(fromId, candidates);
      return;
    }
    try {
      await peer.connection.addIceCandidate(candidate);
    } catch (error) {
      if (!peer.ignoreOffer) console.warn("Could not add ICE candidate:", error);
    }
  }

  async function flushCandidates(participantId) {
    const peer = state.peers.get(participantId);
    const candidates = state.pendingCandidates.get(participantId) || [];
    for (const candidate of candidates) {
      await peer.connection.addIceCandidate(candidate);
    }
    state.pendingCandidates.delete(participantId);
  }

  async function restartPeer(participantId) {
    updateParticipantQuality(participantId, "poor");
    await makeOffer(participantId, true);
  }

  function attachRemoteStream(participantId, stream) {
    const participant = state.participants.get(participantId) || {
      id: participantId,
      name: "Family member",
      joinedAt: new Date().toISOString(),
      audioEnabled: true,
      videoEnabled: true,
      quality: "connecting"
    };
    const tile = ensureRemoteTile(participant);
    const video = $("video", tile);
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      if (state.selectedSpeaker && typeof video.setSinkId === "function") video.setSinkId(state.selectedSpeaker).catch(() => {});
      state.analyzers.delete(participantId);
      setupAnalyzer(participantId, stream);
    }
    updateGrid();
  }

  function ensureRemoteTile(participant) {
    let tile = elements.videoGrid.querySelector(`[data-participant-id="${CSS.escape(participant.id)}"]`);
    if (!tile) {
      tile = buildTile(participant);
      elements.videoGrid.append(tile);
      updateGrid();
    }
    return tile;
  }

  function removePeer(participantId) {
    const peer = state.peers.get(participantId);
    if (peer) {
      peer.connection.ontrack = null;
      peer.connection.onicecandidate = null;
      peer.connection.close();
      state.peers.delete(participantId);
    }
    state.pendingCandidates.delete(participantId);
    state.analyzers.delete(participantId);
    elements.videoGrid.querySelector(`[data-participant-id="${CSS.escape(participantId)}"]`)?.remove();
    updateGrid();
  }

  function resetRemotePeers() {
    [...state.peers.keys()].forEach(removePeer);
    $$(".video-tile:not(.local)", elements.videoGrid).forEach((tile) => tile.remove());
  }

  function updateParticipantQuality(id, quality) {
    const participant = state.participants.get(id);
    if (participant) {
      participant.quality = quality;
      updateTileState(id);
    }
  }

  async function toggleAudio() {
    const track = state.localStream?.getAudioTracks()[0];
    if (!track) {
      toast("No microphone", "Connect a microphone and choose it in Settings.", "error");
      return;
    }
    state.audioEnabled = !state.audioEnabled;
    track.enabled = state.audioEnabled;
    elements.micButton.classList.toggle("off", !state.audioEnabled);
    elements.previewMicButton.classList.toggle("off", !state.audioEnabled);
    updateTileState("local");
    emitParticipantUpdate();
    toast(state.audioEnabled ? "Microphone on" : "Microphone muted", state.audioEnabled ? "Your family can hear you." : "Your microphone is muted.");
  }

  async function toggleVideo() {
    const track = state.localStream?.getVideoTracks()[0];
    if (!track) {
      toast("No camera", "Connect a camera and choose it in Settings.", "error");
      return;
    }
    state.videoEnabled = !state.videoEnabled;
    track.enabled = state.videoEnabled;
    elements.cameraButton.classList.toggle("off", !state.videoEnabled);
    elements.previewCameraButton.classList.toggle("off", !state.videoEnabled);
    elements.previewPlaceholder.classList.toggle("hidden", state.videoEnabled);
    updateTileState("local");
    emitParticipantUpdate();
    toast(state.videoEnabled ? "Camera on" : "Camera off", state.videoEnabled ? "Your family can see you." : "Your camera is disabled.");
  }

  function emitParticipantUpdate(quality) {
    state.socket?.emit("participant:update", {
      audioEnabled: state.audioEnabled,
      videoEnabled: state.videoEnabled,
      ...(quality ? { quality } : {})
    });
  }

  async function switchDevice(kind, deviceId) {
    if (!deviceId) return;
    const constraints = kind === "video"
      ? { video: { ...mediaConstraints().video, deviceId: { exact: deviceId } }, audio: false }
      : { audio: { ...mediaConstraints().audio, deviceId: { exact: deviceId } }, video: false };
    try {
      const replacement = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = kind === "video" ? replacement.getVideoTracks()[0] : replacement.getAudioTracks()[0];
      const oldTrack = kind === "video" ? state.localStream.getVideoTracks()[0] : state.localStream.getAudioTracks()[0];
      newTrack.enabled = kind === "video" ? state.videoEnabled : state.audioEnabled;
      if (oldTrack) state.localStream.removeTrack(oldTrack);
      state.localStream.addTrack(newTrack);
      state.peers.forEach((peer, participantId) => {
        const { connection } = peer;
        const sender = connection.getSenders().find(({ track }) => track?.kind === kind);
        if (sender) {
          sender.replaceTrack(newTrack);
        } else {
          peer.allowNegotiation = true;
          connection.addTrack(newTrack, state.localStream);
          makeOffer(participantId);
        }
      });
      if (oldTrack) {
        oldTrack.stop();
      }
      const localVideo = $(".video-tile.local video");
      if (localVideo) localVideo.srcObject = state.localStream;
      elements.previewVideo.srcObject = state.localStream;
      if (kind === "audio") {
        state.analyzers.delete("local");
        setupAnalyzer(state.joined ? "local" : "preview", state.localStream, state.joined ? null : elements.previewVolume);
      }
      toast("Device changed", `Your ${kind === "video" ? "camera" : "microphone"} is ready.`, "success");
    } catch {
      toast("Device unavailable", "That device could not be opened. It may be in use elsewhere.", "error");
    }
  }

  async function changeResolution() {
    state.settings.resolution = elements.resolutionSelect.value;
    saveSettings();
    const currentCamera = elements.cameraSelect.value;
    if (currentCamera) await switchDevice("video", currentCamera);
  }

  async function changeSpeaker(deviceId) {
    state.selectedSpeaker = deviceId;
    const videos = $$(".video-tile:not(.local) video");
    if (typeof HTMLMediaElement.prototype.setSinkId !== "function") {
      toast("Speaker selection unsupported", "Your browser uses the system’s default speaker.");
      return;
    }
    await Promise.all(videos.map((video) => video.setSinkId(deviceId).catch(() => {})));
    toast("Speaker changed", "Call audio is now using your selected speaker.", "success");
  }

  function renderHistory(history = []) {
    elements.messageList.replaceChildren();
    if (!history.length) renderChatEmpty();
    history.forEach(renderMessage);
    scrollMessages();
  }

  function renderChatEmpty() {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    const icon = document.createElement("i");
    icon.textContent = "♡";
    const title = document.createElement("h3");
    title.textContent = "Start a family moment";
    const text = document.createElement("p");
    text.textContent = "Messages shared here stay for this call session.";
    empty.append(icon, title, text);
    elements.messageList.append(empty);
  }

  function renderMessage(message) {
    $(".chat-empty", elements.messageList)?.remove();
    const isSelf = message.senderId === state.socket?.id || message.senderName === state.name && !state.participants.has(message.senderId);
    const wrapper = document.createElement("article");
    wrapper.className = `message${isSelf ? " self" : ""}`;
    if (!isSelf) {
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      setAvatar(avatar, message.senderName);
      wrapper.append(avatar);
    }
    const content = document.createElement("div");
    const meta = document.createElement("div");
    meta.className = "message-meta";
    const sender = document.createElement("strong");
    const time = document.createElement("time");
    sender.textContent = isSelf ? "You" : message.senderName;
    time.textContent = formatTime(message.sentAt);
    meta.append(sender, time);
    const bubble = document.createElement("p");
    bubble.className = "message-bubble";
    bubble.textContent = message.text;
    content.append(meta, bubble);
    wrapper.append(content);
    elements.messageList.append(wrapper);
  }

  function receiveMessage(message) {
    renderMessage(message);
    scrollMessages();
    const panelOpen = elements.sidePanel.classList.contains("open") && !elements.chatPanel.classList.contains("hidden");
    if (!panelOpen && message.senderId !== state.socket?.id) {
      state.unread += 1;
      updateUnread();
      toast("New message", `${message.senderName}: ${message.text.slice(0, 70)}`);
    }
  }

  function addSystemMessage(text) {
    $(".chat-empty", elements.messageList)?.remove();
    const message = document.createElement("div");
    message.className = "system-message";
    const span = document.createElement("span");
    span.textContent = text;
    message.append(span);
    elements.messageList.append(message);
    scrollMessages();
  }

  function scrollMessages() {
    requestAnimationFrame(() => {
      elements.messageList.scrollTop = elements.messageList.scrollHeight;
    });
  }

  function sendMessage(event) {
    event.preventDefault();
    const text = elements.chatInput.value.trim();
    if (!text || !state.socket?.connected) return;
    elements.socketTypingSent = false;
    state.socket.emit("chat:typing", false);
    state.socket.emit("chat:send", { text }, (result) => {
      if (!result?.ok) toast("Message not sent", result?.error || "Try again.", "error");
    });
    elements.chatInput.value = "";
    resizeChatInput();
  }

  function handleChatInput() {
    resizeChatInput();
    state.socket?.emit("chat:typing", Boolean(elements.chatInput.value.trim()));
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => state.socket?.emit("chat:typing", false), 1300);
  }

  function resizeChatInput() {
    elements.chatInput.style.height = "auto";
    elements.chatInput.style.height = `${Math.min(elements.chatInput.scrollHeight, 110)}px`;
  }

  function handleTyping({ participantId, name, isTyping }) {
    clearTimeout(state.typingMembers.get(participantId));
    if (!isTyping) {
      state.typingMembers.delete(participantId);
    } else {
      const timeout = setTimeout(() => {
        state.typingMembers.delete(participantId);
        renderTyping();
      }, 1800);
      state.typingMembers.set(participantId, { name, timeout });
    }
    renderTyping();
  }

  function renderTyping() {
    const names = [...state.typingMembers.values()].map(({ name }) => name);
    elements.typingIndicator.textContent = names.length ? `${names.join(", ")} ${names.length > 1 ? "are" : "is"} typing…` : "";
  }

  function updateUnread() {
    [elements.unreadBadge, elements.controlUnread].forEach((badge) => {
      badge.textContent = String(state.unread);
      badge.classList.toggle("hidden", state.unread === 0);
    });
  }

  function renderPresence(presence = null) {
    if (presence?.offline) state.offlineMembers = presence.offline;
    const online = presence?.online || [...state.participants.values()];
    const offline = presence?.offline || state.offlineMembers;
    elements.onlineList.replaceChildren();
    elements.offlineList.replaceChildren();
    elements.onlineCount.textContent = `${online.length || 1} online`;

    online.forEach((participant) => elements.onlineList.append(buildPerson(participant, false)));
    offline.forEach((name) => elements.offlineList.append(buildPerson({ name }, true)));
    elements.offlineSection.classList.toggle("hidden", offline.length === 0);
  }

  function buildPerson(participant, offline) {
    const row = document.createElement("div");
    row.className = `person${offline ? " offline" : ""}`;
    const avatar = document.createElement("div");
    avatar.className = "person-avatar";
    setAvatar(avatar, participant.name);
    const indicator = document.createElement("i");
    avatar.append(indicator);
    const info = document.createElement("div");
    info.className = "person-info";
    const name = document.createElement("strong");
    const status = document.createElement("small");
    const isSelf = participant.id === state.socket?.id || participant.isSelf;
    name.textContent = `${participant.name}${isSelf ? " (You)" : ""}`;
    status.textContent = offline ? "Offline" : participant.quality === "poor" ? "Weak connection" : "In the room";
    info.append(name, status);
    const icons = document.createElement("div");
    icons.className = "person-icons";
    if (!offline) {
      const mic = document.createElement("span");
      const camera = document.createElement("span");
      mic.textContent = "⌁";
      camera.textContent = "▣";
      mic.classList.toggle("disabled", participant.audioEnabled === false);
      camera.classList.toggle("disabled", participant.videoEnabled === false);
      icons.append(mic, camera);
    }
    row.append(avatar, info, icons);
    return row;
  }

  function openPanel(tab = "chat") {
    elements.sidePanel.classList.add("open");
    elements.sidePanel.setAttribute("aria-hidden", "false");
    elements.panelBackdrop.classList.remove("hidden");
    switchPanelTab(tab);
  }

  function closePanel() {
    elements.sidePanel.classList.remove("open");
    elements.sidePanel.setAttribute("aria-hidden", "true");
    elements.panelBackdrop.classList.add("hidden");
  }

  function switchPanelTab(tab) {
    elements.panelTabs.forEach((button) => button.classList.toggle("active", button.dataset.panelTab === tab));
    elements.chatPanel.classList.toggle("hidden", tab !== "chat");
    elements.peoplePanel.classList.toggle("hidden", tab !== "people");
    if (tab === "chat") {
      state.unread = 0;
      updateUnread();
      scrollMessages();
      setTimeout(() => elements.chatInput.focus(), 200);
    }
  }

  function startTimers() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remaining = seconds % 60;
      elements.sessionTimer.textContent = hours
        ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
    }, 1000);
    state.statsInterval = setInterval(collectStats, 5000);
    state.latencyInterval = setInterval(measureLatency, 10000);
    measureLatency();
  }

  async function measureLatency() {
    const started = performance.now();
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const latency = Math.round(performance.now() - started);
      elements.latencyDisplay.textContent = `${latency} ms`;
      elements.diagnosticLatency.textContent = `${latency} ms`;
      const quality = latency < 180 ? "excellent" : latency < 350 ? "good" : latency < 650 ? "fair" : "poor";
      setNetworkQuality(quality, quality === "excellent" ? "Excellent" : quality[0].toUpperCase() + quality.slice(1));
      emitParticipantUpdate(quality);
    } catch {
      setNetworkQuality("poor", "Offline");
      elements.diagnosticLatency.textContent = "Unavailable";
    }
  }

  async function collectStats() {
    let worstQuality = "excellent";
    const ranks = { excellent: 0, good: 1, fair: 2, poor: 3 };
    for (const [id, peer] of state.peers) {
      try {
        const reports = await peer.connection.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;
        let roundTripTime = 0;
        reports.forEach((report) => {
          if (report.type === "inbound-rtp" && !report.isRemote) {
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            roundTripTime = report.currentRoundTripTime || roundTripTime;
          }
        });
        const loss = packetsLost / Math.max(1, packetsReceived + packetsLost);
        const quality = loss > .12 || roundTripTime > .8 ? "poor"
          : loss > .06 || roundTripTime > .45 ? "fair"
          : loss > .02 || roundTripTime > .22 ? "good" : "excellent";
        updateParticipantQuality(id, quality);
        if (ranks[quality] > ranks[worstQuality]) worstQuality = quality;
        adaptSenderQuality(peer.connection, quality);
      } catch {
        updateParticipantQuality(id, "connecting");
      }
    }
    if (state.peers.size) setNetworkQuality(worstQuality, worstQuality[0].toUpperCase() + worstQuality.slice(1));
  }

  async function adaptSenderQuality(connection, quality) {
    const sender = connection.getSenders().find(({ track }) => track?.kind === "video");
    if (!sender?.getParameters || !sender.setParameters) return;
    const parameters = sender.getParameters();
    parameters.encodings ||= [{}];
    const bitrate = { excellent: 1_800_000, good: 1_200_000, fair: 650_000, poor: 300_000 }[quality];
    if (parameters.encodings[0].maxBitrate === bitrate) return;
    parameters.encodings[0].maxBitrate = bitrate;
    parameters.degradationPreference = "maintain-framerate";
    await sender.setParameters(parameters).catch(() => {});
  }

  function setNetworkQuality(quality, label) {
    elements.networkBadge.className = `network-badge quality-${quality}`;
    elements.networkBadge.lastElementChild.textContent = label;
    elements.diagnosticConnection.textContent = label;
    elements.diagnosticConnection.style.color = quality === "poor" ? "var(--danger)" : quality === "fair" ? "var(--warning)" : "var(--success)";
  }

  async function runDiagnostics() {
    elements.runDiagnosticButton.disabled = true;
    elements.runDiagnosticButton.textContent = "Testing…";
    const latency = await checkServer();
    const connection = navigator.connection;
    elements.diagnosticLatency.textContent = latency === null ? "Unavailable" : `${latency} ms`;
    elements.diagnosticDownlink.textContent = connection?.downlink ? `${connection.downlink} Mbps` : "Not reported";
    elements.diagnosticPeers.textContent = String(state.peers.size);
    elements.diagnosticConnection.textContent = navigator.onLine && latency !== null ? "Healthy" : "Offline";
    setTimeout(() => {
      elements.runDiagnosticButton.disabled = false;
      elements.runDiagnosticButton.textContent = "Run connection test";
    }, 700);
  }

  async function leaveCall(reload = true) {
    state.socket?.disconnect();
    state.socket = null;
    resetRemotePeers();
    state.localStream?.getTracks().forEach((track) => track.stop());
    state.localStream = null;
    state.joined = false;
    state.analyzers.clear();
    cancelAnimationFrame(state.speakingFrame);
    state.speakingFrame = null;
    clearInterval(state.timerInterval);
    clearInterval(state.statsInterval);
    clearInterval(state.latencyInterval);
    closePanel();
    if (elements.leaveDialog.open) elements.leaveDialog.close();
    if (reload) {
      window.location.assign("/");
    } else {
      elements.callView.classList.add("hidden");
      elements.welcomeView.classList.remove("hidden");
      elements.quickRejoinButton.classList.toggle("hidden", !state.session);
      window.history.replaceState({}, "", "/");
    }
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function bindEvents() {
    elements.joinForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      elements.joinError.textContent = "";
      const name = elements.nameInput.value.trim();
      const familyToken = elements.tokenInput.value;
      if (!name || !familyToken) {
        elements.joinError.textContent = "Please enter your name and family token.";
        return;
      }
      elements.joinButton.disabled = true;
      elements.joinButton.querySelector("span").textContent = "Checking your token…";
      try {
        await authenticate(name, familyToken);
        await enterCall();
      } catch (error) {
        elements.joinError.textContent = error.message;
        if (/token/i.test(error.message)) elements.tokenInput.focus();
      } finally {
        elements.joinButton.disabled = false;
        elements.joinButton.querySelector("span").textContent = "Join family room";
      }
    });

    elements.quickRejoinButton.addEventListener("click", enterCall);
    elements.showTokenButton.addEventListener("click", () => {
      const show = elements.tokenInput.type === "password";
      elements.tokenInput.type = show ? "text" : "password";
      elements.showTokenButton.textContent = show ? "◎" : "◉";
    });
    elements.nameInput.addEventListener("input", () => setAvatar(elements.previewAvatar, elements.nameInput.value || "Pathak Family"));

    elements.previewMicButton.addEventListener("click", async () => {
      if (!state.localStream) await ensureLocalMedia().catch(() => {});
      else toggleAudio();
    });
    elements.previewCameraButton.addEventListener("click", async () => {
      if (!state.localStream) await ensureLocalMedia().catch(() => {});
      else toggleVideo();
    });
    elements.micButton.addEventListener("click", toggleAudio);
    elements.cameraButton.addEventListener("click", toggleVideo);

    elements.chatButton.addEventListener("click", () => openPanel("chat"));
    elements.peopleButton.addEventListener("click", () => openPanel("people"));
    elements.closePanelButton.addEventListener("click", closePanel);
    elements.panelBackdrop.addEventListener("click", closePanel);
    elements.panelTabs.forEach((button) => button.addEventListener("click", () => switchPanelTab(button.dataset.panelTab)));
    elements.chatForm.addEventListener("submit", sendMessage);
    elements.chatInput.addEventListener("input", handleChatInput);
    elements.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) sendMessage(event);
    });

    EMOJIS.forEach((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = emoji;
      button.addEventListener("click", () => {
        elements.chatInput.value += emoji;
        elements.emojiTray.classList.add("hidden");
        elements.chatInput.focus();
        handleChatInput();
      });
      elements.emojiTray.append(button);
    });
    elements.emojiButton.addEventListener("click", () => elements.emojiTray.classList.toggle("hidden"));

    elements.fullscreenButton.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch {
        toast("Fullscreen unavailable", "Your browser did not allow fullscreen mode.");
      }
    });

    elements.settingsButton.addEventListener("click", () => {
      populateDevices();
      elements.settingsDialog.showModal();
    });
    elements.closeSettingsButton.addEventListener("click", () => elements.settingsDialog.close());
    elements.settingsTabs.forEach((button) => button.addEventListener("click", () => {
      elements.settingsTabs.forEach((item) => item.classList.toggle("active", item === button));
      elements.settingsPages.forEach((page) => page.classList.toggle("hidden", page.dataset.settingsPage !== button.dataset.settingsTab));
    }));
    elements.cameraSelect.addEventListener("change", () => switchDevice("video", elements.cameraSelect.value));
    elements.microphoneSelect.addEventListener("change", () => switchDevice("audio", elements.microphoneSelect.value));
    elements.speakerSelect.addEventListener("change", () => changeSpeaker(elements.speakerSelect.value));
    elements.resolutionSelect.addEventListener("change", changeResolution);
    elements.mirrorToggle.addEventListener("change", () => {
      state.settings.mirror = elements.mirrorToggle.checked;
      $(".video-tile.local video")?.classList.toggle("mirrored", state.settings.mirror);
      elements.previewVideo.style.transform = state.settings.mirror ? "scaleX(-1)" : "none";
      saveSettings();
    });
    elements.motionToggle.addEventListener("change", () => {
      state.settings.reduceMotion = elements.motionToggle.checked;
      applyPreferences();
      saveSettings();
    });
    elements.themeOptions.forEach((button) => button.addEventListener("click", () => {
      state.settings.theme = button.dataset.theme;
      applyPreferences();
      saveSettings();
    }));
    elements.runDiagnosticButton.addEventListener("click", runDiagnostics);

    elements.copyTokenButton.addEventListener("click", async () => {
      if (!state.familyToken) {
        toast("Token not stored", "For security, the token is only available after a fresh sign-in.");
        return;
      }
      try {
        await navigator.clipboard.writeText(state.familyToken);
        toast("Family token copied", "Share it privately with a family member.", "success");
      } catch {
        toast("Could not copy", "Your browser blocked clipboard access.", "error");
      }
    });

    elements.leaveButton.addEventListener("click", () => elements.leaveDialog.showModal());
    elements.cancelLeaveButton.addEventListener("click", () => elements.leaveDialog.close());
    elements.confirmLeaveButton.addEventListener("click", () => leaveCall());

    window.addEventListener("online", () => {
      toast("Back online", "Restoring your family call…", "success");
      state.socket?.connect();
    });
    window.addEventListener("offline", () => {
      setNetworkQuality("poor", "Offline");
      toast("Internet connection lost", "Your call will recover when you’re back online.", "error", 6000);
    });
    window.addEventListener("beforeunload", () => state.localStream?.getTracks().forEach((track) => track.stop()));
    navigator.mediaDevices?.addEventListener("devicechange", populateDevices);
  }

  async function initialize() {
    applyPreferences();
    bindEvents();
    setAvatar(elements.previewAvatar, state.name || "Pathak Family");
    await Promise.allSettled([checkServer(), validateSavedSession()]);
    elements.welcomeView.classList.remove("hidden");
    setTimeout(() => elements.loadingScreen.classList.add("done"), 450);
    setTimeout(() => ensureLocalMedia({ quiet: true }).catch(() => {}), 900);
  }

  initialize();
})();
