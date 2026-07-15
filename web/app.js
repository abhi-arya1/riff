const start = document.querySelector("#start");
const state = document.querySelector("#state");
const dot = document.querySelector("#dot");
const activity = document.querySelector("#activity");
const transcript = document.querySelector("#transcript");
const playbackState = document.querySelector("#playback-state");
const track = document.querySelector("#track");
const artist = document.querySelector("#artist");
const audio = document.querySelector("#audio");
const hint = document.querySelector("#hint");
const playToggle = document.querySelector("#play-toggle");
const activityLog = document.querySelector("#activity-log");
const modeButtons = document.querySelectorAll("[data-input-mode]");

const id = crypto.randomUUID();
let connection;
let channel;
let microphone;
let connected = false;
let turn = 0;
let riffText = "";
let playbackTimer;
let isPlaying = false;
let activeResponse = "";
let activeTool = "";
let interrupting = false;
let playbackContext = "";
let sentPlaybackContext = "";
let inputMode = localStorage.getItem("riff-input-mode") === "manual" ? "manual" : "auto";
let holdingSpace = false;
const lines = [];
const activities = [];

start.addEventListener("click", () => connected ? stop() : connect());
playToggle.addEventListener("click", togglePlayback);
for (const button of modeButtons) {
  button.addEventListener("click", () => setInputMode(button.dataset.inputMode));
}
window.addEventListener("keydown", startManualInput);
window.addEventListener("keyup", stopManualInput);
window.addEventListener("blur", stopManualInput);
window.addEventListener("beforeunload", endAgent);
setInputMode(inputMode);
void refreshPlayback();

async function connect() {
  start.disabled = true;
  setState("Connecting", "busy");
  hint.textContent = "Allow microphone access when your browser asks.";

  try {
    connection = new RTCPeerConnection();
    microphone = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    microphone.getAudioTracks()[0].enabled = inputMode === "auto";
    connection.addTrack(microphone.getAudioTracks()[0]);
    connection.ontrack = (event) => {
      audio.srcObject = event.streams[0];
      void audio.play();
    };
    connection.onconnectionstatechange = () => {
      if (["failed", "disconnected"].includes(connection.connectionState)) fail("Connection lost");
    };

    channel = connection.createDataChannel("oai-events");
    channel.addEventListener("message", onEvent);

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    const response = await fetch(`/api/realtime/session?id=${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "content-type": "application/sdp" },
      body: offer.sdp,
    });
    if (!response.ok) throw new Error(await response.text());
    await connection.setRemoteDescription({ type: "answer", sdp: await response.text() });
    await waitForChannel();
    await refreshPlayback();

    connected = true;
    start.disabled = false;
    start.textContent = "End session";
    start.classList.add("connected");
    showAudioStatus();
    setState(inputMode === "manual" ? "Hold Space to talk" : "Listening", inputMode === "manual" ? "" : "live");
    playbackTimer = setInterval(refreshPlayback, 5000);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    stop(false);
  }
}

function onEvent(raw) {
  const event = JSON.parse(raw.data);

  if (event.type === "input_audio_buffer.speech_started") {
    const cutOff = Boolean(activeResponse);
    const interruptedTool = activeTool;
    turn++;
    riffText = "";
    activeTool = "";
    activity.textContent = "";
    interrupting = true;
    audio.muted = true;
    if (activeResponse && channel?.readyState === "open") {
      channel.send(JSON.stringify({ type: "response.cancel", response_id: activeResponse }));
    }
    if (interruptedTool && channel?.readyState === "open") {
      sendToolOutput(interruptedTool, {
        ok: false,
        output: "",
        error: "Interrupted by the user. This action was cancelled and is no longer running.",
      }, false);
    }
    if (cutOff || interruptedTool) addActivity("Interrupted", "Cancelled the last response · listening now");
    setState("Listening", "live");
    void fetch("/api/interrupt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  if (event.type === "input_audio_buffer.speech_stopped") {
    audio.muted = false;
    void audio.play();
    setTimeout(() => { interrupting = false; }, 300);
  }

  if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
    addLine("you", event.transcript);
  }

  if (event.type === "response.created") {
    activeResponse = event.response?.id || "";
    setState("Thinking", "busy");
  }

  if (event.type === "response.output_audio_transcript.delta" && event.delta) {
    riffText += event.delta;
    setState("Speaking", "busy");
    showDraft(riffText);
  }

  if (event.type === "response.output_audio_transcript.done") {
    const text = (event.transcript || riffText).trim();
    if (text) addLine("riff", text);
    riffText = "";
  }

  if (event.type === "response.function_call_arguments.done") void runTool(event);
  if (event.type === "response.done" || event.type === "response.cancelled") {
    if (!event.response?.id || event.response.id === activeResponse) activeResponse = "";
    if (!activity.textContent) {
      setState(inputMode === "manual" && !holdingSpace ? "Hold Space to talk" : "Listening", inputMode === "manual" && !holdingSpace ? "" : "live");
    }
  }
  if (event.type === "error") {
    const message = event.error?.message || "Realtime error";
    if (interrupting && /cancel|active response/i.test(message)) return;
    fail(message);
  }
}

async function runTool(event) {
  if (!event.name || !event.call_id) return;
  let args = {};
  try { args = JSON.parse(event.arguments || "{}"); } catch {}
  const callTurn = turn;
  activeTool = event.call_id;
  const label = event.name === "spotify_playback"
    ? `SPOTIFY · ${String(args.action || "PLAYBACK").replaceAll("_", " ").toUpperCase()}`
    : event.name === "personal_memory"
        ? `RIFF · ${args.action === "save" ? "REMEMBERING" : "RECALLING"}`
      : event.name === "car_comfort"
        ? "TESLA · ADJUSTING COMFORT"
      : "RIFF AGENT";
  activity.textContent = label;
  if (event.name === "music_agent") {
    addActivity("Considering", args.request || "Your music request");
    setState("Thinking it through", "busy");
  } else {
    addActivity("Acting", label.replace(" · ", " "));
    setState("Acting", "busy");
  }

  try {
    const response = await fetch("/api/tool", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, name: event.name, args }),
    });
    const result = await response.json();
    if (callTurn !== turn || channel?.readyState !== "open") return;
    for (const step of result.steps || []) addActivity("Checked", step);
    addActivity(result.ok ? "Done" : "Couldn’t finish", result.ok ? result.output : result.error);
    if (activeTool === event.call_id) activeTool = "";
    activity.textContent = "";
    await refreshPlayback();
    sendToolOutput(event.call_id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (callTurn === turn && channel?.readyState === "open") {
      if (activeTool === event.call_id) activeTool = "";
      activity.textContent = "";
      sendToolOutput(event.call_id, { ok: false, output: "", error: message });
    }
    fail(message);
  } finally {
    if (activeTool === event.call_id) {
      activeTool = "";
      activity.textContent = "";
    }
  }
}

function sendToolOutput(callId, result, respond = true) {
  channel.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(result),
    },
  }));
  if (respond) channel.send(JSON.stringify({ type: "response.create" }));
}

async function togglePlayback() {
  const action = isPlaying ? "pause" : "resume";
  playToggle.disabled = true;
  try {
    const response = await fetch("/api/tool", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, name: "spotify_playback", args: { action } }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Spotify control failed");
    await refreshPlayback();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    playToggle.disabled = false;
  }
}

async function refreshPlayback() {
  try {
    const response = await fetch("/api/playback");
    const result = await response.json();
    const current = result.output?.currently_playing;
    if (!result.ok || !current?.description) {
      playbackState.textContent = "NOT PLAYING";
      playbackState.classList.remove("live");
      track.textContent = "—";
      track.removeAttribute("title");
      artist.textContent = "Open Spotify on this Mac";
      playToggle.disabled = true;
      syncPlaybackContext({ is_playing: false, description: "nothing is currently playing" });
      return;
    }

    const [title, name] = current.description.split(" — ");
    track.textContent = title || current.description;
    track.title = title || current.description;
    artist.textContent = name || current.context_description || "Spotify";
    playbackState.textContent = current.is_playing ? "PLAYING" : "PAUSED";
    playbackState.classList.toggle("live", Boolean(current.is_playing));
    isPlaying = Boolean(current.is_playing);
    playToggle.disabled = false;
    playToggle.classList.toggle("paused", !isPlaying);
    playToggle.setAttribute("aria-label", isPlaying ? "Pause Spotify" : "Play Spotify");
    syncPlaybackContext(current);
  } catch {
    playbackState.textContent = "SPOTIFY UNAVAILABLE";
    playbackState.classList.remove("live");
    playToggle.disabled = true;
    syncPlaybackContext({ is_playing: false, description: "Spotify state is unavailable" });
  }
}

function syncPlaybackContext(current) {
  playbackContext = [
    `Trusted live Spotify state: ${current.is_playing ? "playing" : "paused"} ${current.description}.`,
    current.context_description ? `Playback context: ${current.context_description}.` : "",
    "A short fragment from the user may be a reference to the current song, not a new instruction.",
  ].filter(Boolean).join(" ");
  if (!playbackContext || playbackContext === sentPlaybackContext || channel?.readyState !== "open") return;
  channel.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [{ type: "input_text", text: playbackContext }],
    },
  }));
  sentPlaybackContext = playbackContext;
}

function addLine(who, text) {
  const clean = cleanSpeech(text);
  if (!clean) return;
  lines.push({ who, text: clean });
  if (lines.length > 3) lines.shift();
  renderLines();
}

function showDraft(text) {
  const clean = cleanSpeech(text);
  if (clean) renderLines({ who: "riff", text: clean });
}

function addActivity(label, detail) {
  const clean = cleanSpeech(String(detail || ""));
  if (!clean) return;
  activities.push({ label, detail: clean });
  if (activities.length > 5) activities.shift();
  activityLog.hidden = false;
  activityLog.replaceChildren(...activities.map((item) => {
    const row = document.createElement("div");
    row.className = "activity-entry";
    const title = document.createElement("strong");
    const text = document.createElement("span");
    title.textContent = item.label;
    text.textContent = item.detail;
    row.append(title, text);
    return row;
  }));
}

function cleanSpeech(value) {
  return String(value || "")
    .replace(/[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\u3040-\u30ff]/g, " ")
    .replace(/[\u200b-\u200f\ufeff�]/g, "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderLines(draft) {
  const visible = draft ? [...lines, draft] : lines;
  transcript.replaceChildren(...visible.map((line) => {
    const row = document.createElement("p");
    const label = document.createElement("b");
    label.textContent = `${line.who} › `;
    row.append(label, document.createTextNode(line.text));
    return row;
  }));
}

function setState(text, kind = "") {
  state.textContent = text;
  dot.className = kind;
}

function setInputMode(mode) {
  inputMode = mode === "manual" ? "manual" : "auto";
  localStorage.setItem("riff-input-mode", inputMode);
  for (const button of modeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.inputMode === inputMode));
  }
  const input = microphone?.getAudioTracks()[0];
  if (input?.readyState === "live") input.enabled = inputMode === "auto";
  if (connected) {
    setState(inputMode === "manual" ? "Hold Space to talk" : "Listening", inputMode === "manual" ? "" : "live");
    showAudioStatus();
  } else {
    hint.textContent = inputMode === "manual"
      ? "Start Riff, then hold Space to talk."
      : "";
  }
}

function startManualInput(event) {
  if (event.code !== "Space" || event.repeat || inputMode !== "manual" || !connected || isInteractive(event.target)) return;
  event.preventDefault();
  holdingSpace = true;
  const input = microphone?.getAudioTracks()[0];
  if (input) input.enabled = true;

  const cutOff = Boolean(activeResponse || activeTool);
  if (cutOff) {
    turn++;
    if (activeResponse && channel?.readyState === "open") {
      channel.send(JSON.stringify({ type: "response.cancel", response_id: activeResponse }));
    }
    activeResponse = "";
    activeTool = "";
    activity.textContent = "";
    audio.muted = true;
    addActivity("Interrupted", "Spacebar opened the microphone");
    void fetch("/api/interrupt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }
  setState("Listening", "live");
}

function stopManualInput(event) {
  if (event?.type === "keyup" && event.code !== "Space") return;
  if (!holdingSpace) return;
  if (event?.preventDefault) event.preventDefault();
  holdingSpace = false;
  const input = microphone?.getAudioTracks()[0];
  if (input) input.enabled = false;
  audio.muted = false;
  void audio.play();
  if (!activeResponse && !activity.textContent) setState("Hold Space to talk");
}

function isInteractive(target) {
  return target instanceof Element && Boolean(target.closest("button, input, textarea, select, a, [contenteditable]"));
}

function showAudioStatus() {
  if (inputMode === "manual") {
    hint.textContent = "Hold Space to talk · release to mute.";
    return;
  }
  hint.textContent = "";
}

function fail(message) {
  setState("Error", "error");
  hint.textContent = message;
}

function waitForChannel() {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Realtime connection timed out")), 10000);
    channel.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function stop(reset = true) {
  clearInterval(playbackTimer);
  microphone?.getTracks().forEach((track) => track.stop());
  connection?.close();
  activeResponse = "";
  activeTool = "";
  sentPlaybackContext = "";
  interrupting = false;
  holdingSpace = false;
  audio.muted = false;
  audio.srcObject = null;
  endAgent();
  connected = false;
  start.disabled = false;
  start.textContent = "Start Riff";
  start.classList.remove("connected");
  if (reset) {
    setState("Ready");
    hint.textContent = inputMode === "manual"
      ? "Start Riff, then hold Space to talk."
      : "";
  }
}

function endAgent() {
  void fetch("/api/end", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
    keepalive: true,
  });
}
