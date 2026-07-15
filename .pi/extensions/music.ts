import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";

const cli = process.env.SPOTIFY_CLI_PATH ||
  "/Applications/Studio by Spotify Labs.app/Contents/MacOS/spotify_cli";
const tesla = process.env.TESLA_CONTROL_PATH || "tesla-control";

export default function (pi: any) {
  const teslaMock = process.env.TESLA_MOCK === "true";
  if (process.env.PI_TRACE_ENABLED === "true") {
    pi.registerTool({
      name: "trace_note",
      label: "Trace Note",
      description: "Publish one brief user-visible note about the next operational step and why it is needed.",
      promptSnippet: "Explain the next operational step in one short sentence",
      promptGuidelines: [
        "Keep the note under 12 words.",
        "Do not use this tool for pause, resume, next, previous, now-playing, or volume.",
        "Describe only the immediate next step, not hidden reasoning or internal deliberation.",
      ],
      parameters: Type.Object({ note: Type.String({ maxLength: 120 }) }),
      async execute(_id: string, params: { note: string }) {
        return response({ code: 0, stdout: params.note, stderr: "" });
      },
    });
  }

  pi.registerTool({
    name: "spotify",
    label: "Spotify CLI",
    description: "Run the complete Spotify CLI, including every PLAYBACK, CONTENT, and LIBRARY command.",
    promptSnippet: "Use any Spotify playback, content, or library capability",
    promptGuidelines: [
      "Use spotify for all Spotify inspection and actions.",
      "PLAYBACK is fully available: play, pause, resume, next, previous, seek, shuffle, repeat, speed, volume, now-playing, devices, queue, and jam.",
      "CONTENT is fully available: search, lookup, taste, history, ask, websearch, and sts.",
      "LIBRARY is fully available: library, playlist, and folder.",
      "Assistant-facing SYSTEM tools are available: browser, tts, me, status, open, navigate, version, and notify.",
      "Use websearch before browser for read-only current information of any kind, including weather, sunrise or sunset, local facts, news, and music context. Use browser when websearch is incomplete or cannot handle the source.",
      "Use tts only when the user explicitly wants an MP3 generated or stitched; OpenAI Realtime owns the live voice response.",
      "Never change permissions or use ai or telemetry for an ordinary user request.",
      "The system prompt contains a guide for every top-level Spotify CLI command.",
      "Use ['--help'] only for nested syntax the guide explicitly leaves open.",
    ],
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: "Any arguments after spotify_cli, for example ['search', 'Radiohead', '--format', 'json'] or ['queue', 'add', 'spotify:track:...'].",
      }),
      stdin: Type.Optional(Type.String({
        description: "Optional stdin text. Use this for commands such as library batch that accept a JSON manifest from stdin.",
      })),
    }),
    async execute(
      _id: string,
      params: { args: string[]; stdin?: string },
      signal: AbortSignal | undefined,
    ) {
      const result = await run(cli, params.args, process.cwd(), signal, toolEnv(), params.stdin);
      return response(result);
    },
  });

  if (
    teslaMock || (
      process.env.TESLA_ENABLED === "true" &&
      process.env.TESLA_VIN &&
      process.env.TESLA_KEY_NAME
    )
  ) {
    pi.registerTool({
      name: "tesla_media",
      label: "Tesla Media",
      description: teslaMock
        ? "Simulate controlling the Tesla media player. No command is sent to a car."
        : "Control only the active media player in the nearby paired Tesla over BLE.",
      promptSnippet: "Control Tesla media playback or volume over BLE",
      promptGuidelines: [
        "Use only for media transport and volume, never for selecting Spotify content.",
        "Execute at most once. Never retry any failure or timeout because the outcome may be uncertain.",
        "If unavailable, report that briefly and do not ask a moving driver to troubleshoot.",
      ],
      parameters: Type.Object({
        action: Type.Union([
          Type.Literal("volume_up"),
          Type.Literal("volume_down"),
          Type.Literal("set_volume"),
          Type.Literal("next"),
          Type.Literal("previous"),
          Type.Literal("toggle_playback"),
        ]),
        volume: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
      }),
      async execute(
        _id: string,
        params: { action: TeslaAction; volume?: number },
        signal: AbortSignal | undefined,
      ) {
        let args: string[];
        try {
          args = teslaArgs(params.action, params.volume);
        } catch (error) {
          return response({ code: 1, stdout: "", stderr: String(error) });
        }

        const result = teslaMock
          ? mockTesla(params.action, params.volume, args)
          : await runTesla(tesla, args, signal);
        return response(result);
      },
    });
  }

  pi.registerTool({
    name: "shell",
    label: "Scratch Shell",
    description: "Run Bash-compatible commands in an isolated temporary directory without network access.",
    promptSnippet: "Calculate or transform temporary data in an isolated shell",
    promptGuidelines: [
      "Use shell only for calculations and transforming temporary data; it cannot access Spotify or user files.",
    ],
    parameters: Type.Object({ command: Type.String() }),
    async execute(
      _id: string,
      params: { command: string },
      signal: AbortSignal | undefined,
    ) {
      const dir = await mkdtemp(join(tmpdir(), "spotify-agent-"));
      const profile = sandbox(dir);
      const result = await run(
        "/usr/bin/sandbox-exec",
        ["-p", profile, "/bin/zsh", "-f", "-c", params.command],
        dir,
        signal,
        safeShellEnv(),
      );
      return response(result);
    },
  });
}

type Result = { code: number | null; stdout: string; stderr: string };

function run(
  command: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
  input?: string,
): Promise<Result> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      signal,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data) => stdout += data);
    child.stderr?.on("data", (data) => stderr += data);
    if (input !== undefined) child.stdin?.end(input);
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: String(error) }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

type TeslaAction =
  | "volume_up"
  | "volume_down"
  | "set_volume"
  | "next"
  | "previous"
  | "toggle_playback";

const teslaCommands: Record<Exclude<TeslaAction, "set_volume">, string> = {
  volume_up: "media-volume-up",
  volume_down: "media-volume-down",
  next: "media-next-track",
  previous: "media-previous-track",
  toggle_playback: "media-toggle-playback",
};

export function teslaArgs(action: TeslaAction, volume?: number) {
  if (action === "set_volume") {
    if (volume === undefined || !Number.isFinite(volume) || volume < 0 || volume > 10) {
      throw new Error("set_volume requires a volume from 0 to 10");
    }
    return ["-ble", "media-set-volume", String(volume)];
  }

  return ["-ble", teslaCommands[action]];
}

export function mockTesla(
  action: TeslaAction,
  volume: number | undefined,
  args = teslaArgs(action, volume),
): Result {
  return {
    code: 0,
    stdout: JSON.stringify({ mock: true, sent: false, action, volume, command: args }),
    stderr: "",
  };
}

async function runTesla(command: string, args: string[], signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const result = await run(command, args, process.cwd(), controller.signal, teslaEnv());
    if (controller.signal.aborted) {
      return {
        code: 1,
        stdout: result.stdout,
        stderr: "Tesla command timed out or was cancelled. Outcome uncertain; do not retry.",
      };
    }
    return result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function teslaEnv(): NodeJS.ProcessEnv {
  return {
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    TMPDIR: process.env.TMPDIR,
    TESLA_CACHE_FILE: process.env.TESLA_CACHE_FILE,
    TESLA_KEY_NAME: process.env.TESLA_KEY_NAME,
    TESLA_VIN: process.env.TESLA_VIN,
  };
}

function toolEnv(): NodeJS.ProcessEnv {
  return {
    HOME: process.env.HOME,
    LANG: process.env.LANG || "en_US.UTF-8",
    PATH: process.env.PATH,
    TMPDIR: process.env.TMPDIR,
  };
}

function safeShellEnv(): NodeJS.ProcessEnv {
  return {
    HOME: process.cwd(),
    LANG: process.env.LANG || "en_US.UTF-8",
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    TMPDIR: process.cwd(),
  };
}

function response(result: Result) {
  const text = [
    `exit: ${result.code}`,
    result.stdout.trim() && `stdout:\n${result.stdout.trim()}`,
    result.stderr.trim() && `stderr:\n${result.stderr.trim()}`,
  ].filter(Boolean).join("\n").slice(0, 60_000);

  return {
    content: [{ type: "text", text }],
    details: { code: result.code },
    isError: result.code !== 0,
  };
}

function sandbox(dir: string) {
  const path = dir.replaceAll('"', '\\"');
  return [
    "(version 1)",
    "(deny default)",
    "(allow process*)",
    "(allow sysctl-read)",
    "(allow file-read*",
    '  (subpath "/System")',
    '  (subpath "/usr")',
    '  (subpath "/bin")',
    '  (subpath "/sbin")',
    '  (subpath "/Library/Apple")',
    `  (subpath "${path}"))`,
    `(allow file-write* (subpath "${path}"))`,
  ].join("\n");
}
