import { config } from "./config";
import type { PiTrace } from "./pi";

export type ComfortAction =
  | "climate_on"
  | "climate_off"
  | "set_temperature"
  | "seat_heater"
  | "steering_wheel_heater";

export type ComfortRequest = {
  action: ComfortAction;
  celsius?: number;
  seat?: "front-left" | "front-right";
  level?: "off" | "low" | "medium" | "high";
  state?: "on" | "off";
};

export type MediaRequest = {
  action: "volume_up" | "volume_down" | "set_volume" | "next" | "previous" | "toggle_playback";
  volume?: number;
};

type Result = { ok: boolean; output: string; error?: string; mock?: boolean };
type Run = (args: string[], signal: AbortSignal) => Promise<{ code: number; stdout: string; stderr: string }>;

type Options = {
  enabled?: boolean;
  mock?: boolean;
  ready?: boolean;
  run?: Run;
  onTrace?: (event: PiTrace) => void;
};

export function createTeslaBle(options: Options = {}) {
  const enabled = options.enabled ?? config.teslaEnabled;
  const mock = options.mock ?? config.teslaMock;
  const ready = options.ready ?? Boolean(config.teslaVin && config.teslaKeyName);
  const run = options.run || runCommand;
  let active: AbortController | undefined;

  async function execute(toolName: "tesla_comfort" | "tesla_media", args: string[], output: string) {
    const controller = new AbortController();
    active?.abort();
    active = controller;
    const timer = setTimeout(() => controller.abort(), config.teslaTimeout);
    const id = crypto.randomUUID();
    options.onTrace?.({ type: "tool_execution_start", toolCallId: id, toolName, args });

    try {
      if (mock) {
        const text = `Simulated: ${output} Nothing was sent to a vehicle.`;
        finish(options.onTrace, id, toolName, true, text);
        return { ok: true, output: text, mock: true };
      }
      if (!enabled || !ready) throw new Error("Tesla BLE is not paired and enabled yet.");

      const result = await run(args, controller.signal);
      if (result.code !== 0) throw new Error(lastLine(result.stderr) || `Tesla exited with ${result.code}`);
      finish(options.onTrace, id, toolName, true, output);
      return { ok: true, output };
    } catch (error) {
      const text = controller.signal.aborted
        ? "Tesla BLE was interrupted. The outcome is uncertain, so Riff will not retry."
        : message(error);
      finish(options.onTrace, id, toolName, false, text);
      return { ok: false, output: "", error: text };
    } finally {
      clearTimeout(timer);
      if (active === controller) active = undefined;
    }
  }

  return {
    async comfort(request: ComfortRequest): Promise<Result> {
      let args: string[];
      try {
        args = comfortArgs(request);
      } catch (error) {
        return { ok: false, output: "", error: message(error) };
      }
      return await execute("tesla_comfort", args, comfortResult(request));
    },
    async media(request: MediaRequest): Promise<Result> {
      try {
        return await execute("tesla_media", mediaArgs(request), mediaResult(request));
      } catch (error) {
        return { ok: false, output: "", error: message(error) };
      }
    },
    interrupt() {
      active?.abort();
    },
  };
}

export function mediaArgs(request: MediaRequest) {
  if (request.action === "set_volume") {
    if (request.volume === undefined || !Number.isFinite(request.volume) || request.volume < 0 || request.volume > 10) {
      throw new Error("Tesla volume must be between 0 and 10.");
    }
    return ["-ble", "media-set-volume", String(request.volume)];
  }
  const commands = {
    volume_up: "media-volume-up",
    volume_down: "media-volume-down",
    next: "media-next-track",
    previous: "media-previous-track",
    toggle_playback: "media-toggle-playback",
  } as const;
  return ["-ble", commands[request.action]];
}

export function comfortArgs(request: ComfortRequest) {
  if (request.action === "climate_on") return ["-ble", "climate-on"];
  if (request.action === "climate_off") return ["-ble", "climate-off"];
  if (request.action === "set_temperature") {
    if (request.celsius === undefined || !Number.isFinite(request.celsius) || request.celsius < 15 || request.celsius > 28) {
      throw new Error("Temperature must be between 15 and 28°C.");
    }
    return ["-ble", "climate-set-temp", `${request.celsius}c`];
  }
  if (request.action === "seat_heater") {
    if (!request.seat || !request.level) throw new Error("Seat and heat level are required.");
    return ["-ble", "seat-heater", request.seat, request.level];
  }
  if (request.action === "steering_wheel_heater") {
    if (!request.state) throw new Error("Steering-wheel heater state is required.");
    return ["-ble", "steering-wheel-heater", request.state];
  }
  throw new Error("Unsupported Tesla comfort action.");
}

function comfortResult(request: ComfortRequest) {
  if (request.action === "climate_on") return "Tesla climate is on.";
  if (request.action === "climate_off") return "Tesla climate is off.";
  if (request.action === "set_temperature") return `Tesla cabin temperature is set to ${request.celsius}°C.`;
  if (request.action === "seat_heater") return `${label(request.seat || "seat")} heat is ${request.level}.`;
  return `Tesla steering-wheel heat is ${request.state}.`;
}

function mediaResult(request: MediaRequest) {
  if (request.action === "volume_up") return "Tesla volume is up one step.";
  if (request.action === "volume_down") return "Tesla volume is down one step.";
  if (request.action === "set_volume") return `Tesla volume is set to ${request.volume}.`;
  if (request.action === "next") return "Tesla skipped to the next track.";
  if (request.action === "previous") return "Tesla returned to the previous track.";
  return "Tesla media play/pause was toggled.";
}

async function runCommand(args: string[], signal: AbortSignal) {
  const proc = Bun.spawn([config.teslaControl, ...args], {
    signal,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      HOME: Bun.env.HOME,
      PATH: Bun.env.PATH,
      TMPDIR: Bun.env.TMPDIR,
      TESLA_CACHE_FILE: Bun.env.TESLA_CACHE_FILE,
      TESLA_KEY_NAME: config.teslaKeyName,
      TESLA_VIN: config.teslaVin,
    },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

function label(value: string) {
  return value.replace("front-left", "Driver seat").replace("front-right", "Passenger seat");
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function lastLine(value: string) {
  return value.trim().split("\n").at(-1) || "";
}

function finish(
  onTrace: Options["onTrace"],
  id: string,
  toolName: "tesla_comfort" | "tesla_media",
  ok: boolean,
  text: string,
) {
  onTrace?.({
    type: "tool_execution_end",
    toolCallId: id,
    toolName,
    isError: !ok,
    result: { content: [{ type: "text", text }] },
  });
}
