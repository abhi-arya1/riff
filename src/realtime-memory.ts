import { config } from "./config";
import { ensureMemory } from "./memory";
import type { PiTrace } from "./pi";

type Result = { ok: boolean; output: string; error?: string };

type Options = {
  fetch?: typeof fetch;
  ensure?: () => Promise<boolean>;
  onTrace?: (event: PiTrace) => void;
};

export function createRealtimeMemory(options: Options = {}) {
  const request = options.fetch || fetch;
  const ready = options.ensure || ensureMemory;
  let active: AbortController | undefined;

  async function run(kind: "recall" | "save", value: string): Promise<Result> {
    const text = value.trim();
    if (!text) return { ok: false, output: "", error: kind === "recall" ? "A memory query is required." : "A memory is required." };
    if (text.length > 600) return { ok: false, output: "", error: "Memory input is too long." };
    if (kind === "save") {
      const unsafe = unsafeMemory(text);
      if (unsafe) return { ok: false, output: "", error: unsafe };
    }

    const controller = new AbortController();
    active?.abort();
    active = controller;
    const timer = setTimeout(() => controller.abort(), 8_000);
    const id = crypto.randomUUID();
    options.onTrace?.({
      type: "tool_execution_start",
      toolCallId: id,
      toolName: kind === "recall" ? "memory_recall" : "memory_save",
      args: kind === "recall" ? { query: text } : { memory: text },
    });

    try {
      if (!await ready()) throw new Error("Riff memory is unavailable.");
      const response = kind === "recall"
        ? await request(`${config.memoryUrl}/v4/search`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
              q: text,
              containerTag: config.memoryContainer,
              limit: 5,
              searchMode: "hybrid",
            }),
            signal: controller.signal,
          })
        : await request(`${config.memoryUrl}/v4/memories`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
              containerTag: config.memoryContainer,
              memories: [{
                content: text,
                isStatic: false,
                metadata: {
                  source: "riff-realtime",
                  type: "durable_preference",
                  captured_at: new Date().toISOString(),
                },
              }],
            }),
            signal: controller.signal,
          });
      const data = await readJson(response);
      if (!response.ok) throw new Error(`Riff memory returned ${response.status}.`);

      const output = kind === "recall" ? formatMemories(data) : "That preference is saved for future sessions.";
      finish(options.onTrace, id, true, output, kind);
      return { ok: true, output };
    } catch (error) {
      const message = controller.signal.aborted ? "Riff memory was interrupted." : errorText(error);
      finish(options.onTrace, id, false, message, kind);
      return { ok: false, output: "", error: message };
    } finally {
      clearTimeout(timer);
      if (active === controller) active = undefined;
    }
  }

  return {
    recall(query: string) {
      return run("recall", query);
    },
    save(memory: string) {
      return run("save", memory);
    },
    interrupt() {
      active?.abort();
    },
  };
}

export function unsafeMemory(value: string) {
  if (/\b(?:password|passcode|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|private[ _-]?key|seed phrase)\b/i.test(value)) {
    return "Riff will not store secrets in personal memory.";
  }
  if (/\b(?:gps|latitude|longitude|precise location|exact address|home address|street address)\b/i.test(value) || /-?\d{1,3}\.\d{4,}\s*[,/]\s*-?\d{1,3}\.\d{4,}/.test(value)) {
    return "Riff will not store precise location data in personal memory.";
  }
  if (/^(?:play|pause|resume|skip|next|previous|set volume)\b/i.test(value.trim())) {
    return "Routine playback commands are not durable memories.";
  }
  return "";
}

export function formatMemories(value: unknown) {
  const items = memoryItems(value)
    .map(cleanMemory)
    .filter(Boolean)
    .filter((item) => !unsafeMemory(item))
    .slice(0, 5);
  if (!items.length) return "No relevant personal memory was found.";
  return `Relevant personal memory:\n${items.map((item) => `- ${item.slice(0, 700)}`).join("\n")}`;
}

function cleanMemory(value: string) {
  return value
    .replace(/^Pi coding-agent turn\s*/i, "")
    .replace(/^User:\s*/i, "")
    .replace(/\nAssistant:[\s\S]*$/i, "")
    .trim();
}

function memoryItems(value: unknown): string[] {
  if (typeof value === "string") return [];
  if (Array.isArray(value)) return value.flatMap(memoryItems);
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  const direct = [item.content, item.text].find((part) => typeof part === "string");
  if (typeof direct === "string") return [direct];
  for (const key of ["memory", "document"]) {
    if (typeof item[key] === "string") return [item[key] as string];
    const nested = memoryItems(item[key]);
    if (nested.length) return nested;
  }
  for (const key of ["results", "memories", "documents", "data"]) {
    const nested = memoryItems(item[key]);
    if (nested.length) return nested;
  }
  return [];
}

function headers() {
  return {
    Authorization: `Bearer ${config.memoryKey}`,
    "content-type": "application/json",
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function finish(onTrace: Options["onTrace"], id: string, ok: boolean, text: string, kind: "recall" | "save") {
  onTrace?.({
    type: "tool_execution_end",
    toolCallId: id,
    toolName: kind === "recall" ? "memory_recall" : "memory_save",
    isError: !ok,
    result: { content: [{ type: "text", text }] },
  });
}
