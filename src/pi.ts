import { $ } from "bun";
import { join } from "node:path";
import { config } from "./config";
import { ensureMemory } from "./memory";
import { runFast } from "./fast";
import { personality } from "./personality";
import { spotifyGuide } from "./spotify-guide";

type AgentResult = {
  ok: boolean;
  output: string;
  error?: string;
};

export type PiTrace = {
  type: string;
  [key: string]: unknown;
};

type AgentOptions = {
  onTrace?: (event: PiTrace) => void;
};

type Trace = (event: PiTrace) => void;

const root = join(import.meta.dir, "..");
const extension = join(root, ".pi", "extensions", "music.ts");
const memoryExtension = join(root, ".pi", "extensions", "memory.ts");
const data = join(root, ".data", "pi");
const sessions = join(data, "sessions");
const work = join(data, "work");

export const agentPrompt = [
  "You are Riff, the user's persistent solo-aux companion.",
  personality,
  "CASUAL MUSIC CHAT FAST LANE\n- Answer casual opinions, artist conversation, genre discussion, and music-cultural banter directly when you already know enough.\n- Do not call Spotify search, lookup, taste, history, Ask, or websearch merely to support a vibe check or subjective take.\n- Inspect Spotify only when the user asks for exact catalog data, current or personal listening evidence, a recommendation grounded in their taste, or an action.",
  "Be conversational, playful, concise, and useful. Answer ordinary questions directly from your own knowledge. Use tools only when the request needs an action, live Spotify state, current information, calculation, or durable memory.",
  "GENERAL LIVE RESEARCH\n- You are not music-only. For current facts such as weather, sunrise or sunset, nearby places, opening hours, news, events, sports, or anything else that may have changed, research before answering.\n- Use Spotify websearch first for read-only live research. If it is too culturally scoped, incomplete, or cannot answer, use the browser to search and read a reliable source.\n- Never say you cannot access current information without trying the available research tools. Never tell the user to check another app when you can research it.\n- Location-dependent facts require a city, region, ZIP, or coordinates. Use location included in the request, but never invent or infer a precise location. If it is missing, return one short clarification asking only for the city or ZIP.\n- Give the concise answer with the relevant local date or time zone when that prevents ambiguity.",
  "For music actions, use the spotify and tesla_media tools available to you.",
  "Use spotify to choose, search, and start content. Use tesla_media only for media transport and volume in the car.",
  spotifyGuide,
  "SPOTIFY CAPABILITY ROUTING\n- Do not load taste or history preemptively. Decide what evidence the request actually needs, then use the smallest useful combination of capabilities.\n- Recommendation constraints accumulate across turns. A correction adds or sharpens a constraint unless the user explicitly replaces one.\n- Random, surprise me, choose, or something means the user delegated the choice. Never ask them to pick and never discard their taste, mood, energy, situation, novelty, or earlier constraints.\n- There is no fixed recommendation recipe. Use search for literal catalog retrieval, lookup for exact metadata, taste for musical identity, history recent for immediate context, history top for longer-term affinity, library for familiarity, and Ask only when its broader taste or cultural judgment materially helps. Combine them when the request genuinely needs it.\n- For a recommendation-and-play request, inspect enough real evidence to make a defensible choice, choose one track that satisfies every hard constraint, play it, and report the evidence behind the decision. Never invent an artist, track, genre, or rationale before a tool confirms it.\n- Use queue for sequencing, devices for Spotify Connect, Jam for shared listening, chat for explicit social messaging, and playlist or folder only for explicit organization requests.\n- Use browser only for explicit web interaction or when websearch cannot handle a page. Keep it voice-first: never ask a moving driver to inspect the browser. Never purchase, send, publish, enter credentials, or change an account without explicit authorization.\n- Use tts only for an explicit MP3 generation or stitching request, never for the live Riff response. Use me for Spotify account identity, status for connection diagnosis, navigate for opening a known Spotify URI, and notify only for an explicit useful notification.\n- Do not use generic genre search alone for a personalized request, and do not blindly play the first search result.\n- When energy or upbeatness is material, verify promising tracks with lookup --fields bpm,genres when that metadata would reduce uncertainty; tempo alone never proves mood or energy.\n- Telemetry and ai are internal infrastructure, not sources of listener knowledge. Never change permissions unless the user explicitly asks while parked.",
  "PERSONAL PLAYLIST BIAS\n- When a specific mood, activity, genre blend, era, or situation could plausibly match the user's own curation, bias toward their playlists before public playlists. Inspect library list --type playlist or folder list --recursive, then use playlist get on only the most relevant candidates.\n- Prefer a strong owned or saved playlist match, but never force a weak one. If the collection does not satisfy every hard constraint, widen to Spotify's catalog and public playlists. Exact song or artist requests still take priority.\n- Broad discovery, surprise, and exploration requests may roam across Spotify without checking the user's playlists first unless personal curation is clearly relevant. Playlist and folder reads are safe recommendation evidence. Any earlier playlist restriction applies to writes; writes still require explicit intent.",
  "CURRENT PLAYBACK CONTEXT\n- Current playlist and current queue are different. If the user asks what is in the current playlist or asks for an artist or track from it, inspect now-playing to identify its playback context, then use playlist get when that context is a playlist. Do not substitute queue results.\n- Use queue only for what is lined up next or explicit queue work. When playing something from the current playlist, choose and play the exact matching track URI from that playlist.",
  "MEMORY GUIDE\n- Relevant memories are recalled automatically. Use them naturally without announcing that memory was searched.\n- Save a memory when the user explicitly says to remember something, defines a personal phrase or ritual, corrects a durable preference, or states a stable musical preference likely to matter later.\n- Save a short, self-contained fact with useful artist, track, playlist, mood, situation, and Spotify URI details when known.\n- Do not save routine commands, transient playback state, generic facts, or entire conversations.\n- Never invent a memory. If recalled context conflicts with the current request, follow the current request.\n- Use supermemory_search only when automatic recall is insufficient for an explicit question about prior sessions. Use supermemory_save only for durable information under these rules.",
  "For multi-step music work, inspect, act, verify only when verification adds value, then stop.",
  "Use shell only for small calculations or transforming data in the isolated scratch directory.",
  "When trace_note is available, use it once before a genuinely multi-step or ambiguous task. Never use it for a fast-path command. Add another note only if the plan materially changes.",
  "Never claim an action succeeded unless a tool result confirms it.",
  config.teslaMock
    ? "Tesla mock mode is active. Clearly say the requested car action was simulated and was not sent to a vehicle."
    : "",
  "Never retry a failed or timed-out Tesla command. Its outcome may be uncertain.",
  "Never ask the driver to look at, touch, or troubleshoot the laptop while driving.",
  "Do not perform destructive library or playlist changes unless the user's request clearly asks for them.",
  "If a material choice is genuinely missing and the user did not delegate it, return one short clarification question. Words like random, surprise me, choose, or something explicitly delegate the choice.",
  "Finish with a concise result suitable for another voice model to say aloud. For a recommendation, state what relevant evidence you used, the decisive user constraint, what you chose, and whether playback was confirmed. Keep it to two or three natural spoken sentences.",
].join("\n\n");

export function createMusicAgent(options: AgentOptions = {}) {
  const session = crypto.randomUUID();
  let queue = Promise.resolve<AgentResult>({ ok: true, output: "" });
  let active: AbortController | undefined;
  const recent: string[] = [];

  return {
    ask(request: string, onTrace?: Trace) {
      queue = queue.then(async () => {
        const trace = combineTrace(options.onTrace, onTrace);
        const controller = new AbortController();
        active = controller;
        const fast = await runFast(request, controller.signal, trace);
        if (fast) {
          if (fast.ok) {
            recent.push(`${request} → ${fast.output}`);
            if (recent.length > 5) recent.shift();
          }
          return fast;
        }
        const context = [
          recent.length ? `Recent deterministic Riff actions:\n${recent.join("\n")}` : "",
          `Current request:\n${request}`,
        ].filter(Boolean).join("\n\n");
        const result = await run(context, session, trace, (next) => {
          active = next;
        });
        if (result.ok) recent.length = 0;
        return result;
      }).finally(() => {
        active = undefined;
      });
      return queue;
    },
    interrupt() {
      active?.abort();
    },
  };
}

function combineTrace(first?: Trace, second?: Trace) {
  if (!first) return second;
  if (!second || first === second) return first;
  return (event: PiTrace) => {
    first(event);
    second(event);
  };
}

async function run(
  request: string,
  session: string,
  onTrace?: (event: PiTrace) => void,
  onActive?: (controller: AbortController) => void,
): Promise<AgentResult> {
  const memory = await ensureMemory();
  await $`mkdir -p ${sessions} ${work}`.quiet();

  const controller = new AbortController();
  let timedOut = false;
  onActive?.(controller);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.piTimeout);
  const args = [
    config.pi,
    "--print",
    "--mode", onTrace ? "json" : "text",
    "--model", config.piModel,
    "--thinking", config.piThinking,
    "--session-id", session,
    "--session-dir", sessions,
    "--system-prompt", agentPrompt,
    "--no-builtin-tools",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-context-files",
    "--extension", extension,
    "--extension", memoryExtension,
    request,
  ];

  try {
    const proc = Bun.spawn(args, {
      cwd: work,
      env: {
        HOME: Bun.env.HOME,
        LANG: Bun.env.LANG || "en_US.UTF-8",
        PATH: Bun.env.PATH,
        SHELL: Bun.env.SHELL,
        TMPDIR: Bun.env.TMPDIR,
        USER: Bun.env.USER,
        OPENAI_API_KEY: config.piOpenaiKey,
        AI_GATEWAY_API_KEY: config.piGatewayKey,
        PI_TRACE_ENABLED: String(Boolean(onTrace)),
        PI_CODING_AGENT_DIR: join(data, "config"),
        PI_CODING_AGENT_SESSION_DIR: sessions,
        SUPERMEMORY_API_KEY: config.memoryKey,
        SUPERMEMORY_API_BASE_URL: config.memoryUrl,
        RIFF_MEMORY_CONTAINER: config.memoryContainer,
        PI_SUPERMEMORY_ENABLED: String(memory),
        SPOTIFY_CLI_PATH: config.spotifyCli,
        TESLA_ENABLED: String(config.teslaEnabled),
        TESLA_MOCK: String(config.teslaMock),
        TESLA_CONTROL_PATH: config.teslaControl,
        TESLA_VIN: config.teslaVin,
        TESLA_KEY_NAME: config.teslaKeyName,
        TESLA_CACHE_FILE: join(data, "tesla-cache.json"),
      },
      signal: controller.signal,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, code] = await Promise.all([
      onTrace
        ? readTrace(proc.stdout, onTrace)
        : new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (code !== 0) {
      return {
        ok: false,
        output: stdout.trim(),
        error: stderr.trim() || `Pi exited with ${code}`,
      };
    }

    return { ok: true, output: stdout.trim() };
  } catch (error) {
    const message = controller.signal.aborted
      ? timedOut ? `Riff timed out after ${config.piTimeout}ms` : "Interrupted."
      : String(error);
    return { ok: false, output: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function readTrace(
  stream: ReadableStream<Uint8Array>,
  onTrace: (event: PiTrace) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const event = parseTrace(line);
      if (!event) continue;
      onTrace(event);
      output = finalText(event) || output;
    }

    if (done) break;
  }

  const event = parseTrace(buffer);
  if (event) {
    onTrace(event);
    output = finalText(event) || output;
  }

  return output;
}

function parseTrace(line: string): PiTrace | undefined {
  if (!line.trim()) return;
  try {
    return JSON.parse(line) as PiTrace;
  } catch {
    return;
  }
}

function finalText(event: PiTrace) {
  if (event.type !== "message_end") return "";
  const message = event.message as {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  } | undefined;
  if (message?.role !== "assistant" || !Array.isArray(message.content)) return "";
  return message.content
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("")
    .trim();
}
