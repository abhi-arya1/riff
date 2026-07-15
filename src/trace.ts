import type { PiTrace } from "./pi";

const color = process.stderr.isTTY;
const rgb = (r: number, g: number, b: number, text: string) =>
  color ? `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m` : text;
const bg = (r: number, g: number, b: number, text: string) =>
  color ? `\x1b[48;2;${r};${g};${b}m${text}\x1b[0m` : text;
const bold = (text: string) => color ? `\x1b[1m${text}\x1b[0m` : text;
const dim = (text: string) => rgb(179, 179, 179, text);
const white = (text: string) => rgb(255, 255, 255, text);
const green = (text: string) => rgb(30, 215, 96, text);
const red = (text: string) => rgb(243, 114, 127, text);
const orange = (text: string) => rgb(255, 164, 43, text);
const blue = (text: string) => rgb(83, 157, 245, text);
const pill = (text: string) => bold(color ? bg(30, 215, 96, `  ${text}  `) : text);

const spotifyLogo = [
  "⠀⠀⠀⠀⠀⠀⠀⢀⣠⣤⣤⣶⣶⣶⣶⣤⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⢀⣤⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣤⡀⠀⠀⠀⠀",
  "⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⠀⠀⠀",
  "⠀⢀⣾⣿⡿⠿⠛⠛⠛⠉⠉⠉⠉⠛⠛⠛⠿⠿⣿⣿⣿⣿⣿⣷⡀⠀",
  "⠀⣾⣿⣿⣇⠀⣀⣀⣠⣤⣤⣤⣤⣤⣀⣀⠀⠀⠀⠈⠙⠻⣿⣿⣷⠀",
  "⢠⣿⣿⣿⣿⡿⠿⠟⠛⠛⠛⠛⠛⠛⠻⠿⢿⣿⣶⣤⣀⣠⣿⣿⣿⡄",
  "⢸⣿⣿⣿⣿⣇⣀⣀⣤⣤⣤⣤⣤⣄⣀⣀⠀⠀⠉⠛⢿⣿⣿⣿⣿⡇",
  "⠘⣿⣿⣿⣿⣿⠿⠿⠛⠛⠛⠛⠛⠛⠿⠿⣿⣶⣦⣤⣾⣿⣿⣿⣿⠃",
  "⠀⢿⣿⣿⣿⣿⣤⣤⣤⣤⣶⣶⣦⣤⣤⣄⡀⠈⠙⣿⣿⣿⣿⣿⡿⠀",
  "⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣾⣿⣿⣿⣿⡿⠁⠀",
  "⠀⠀⠀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠀⠀⠀",
  "⠀⠀⠀⠀⠈⠛⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⠁⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠈⠙⠛⠛⠿⠿⠿⠿⠛⠛⠋⠁⠀⠀⠀⠀⠀⠀⠀",
].map(green).join("\n");

export function splash() {
  return spotifyLogo;
}

export function createTracePrinter(
  started = Date.now(),
  options: { showSplash?: boolean } = {},
) {
  const tools = new Map<string, number>();
  let turnStarted = started;
  let showedThinking = false;

  return (event: PiTrace) => {
    if (event.type === "agent_start") {
      turnStarted = Date.now();
      showedThinking = false;
      tools.clear();
    }
    if (event.type === "turn_start") {
      if (showedThinking) return;
      showedThinking = true;
    }
    const elapsed = Date.now() - turnStarted;
    if (event.type === "agent_start" && options.showSplash === false) return;
    const line = formatTrace(event, elapsed, tools);
    if (line) console.error(line);
  };
}

export function formatTrace(
  event: PiTrace,
  elapsed: number,
  tools = new Map<string, number>(),
) {
  const time = dim(`${(elapsed / 1000).toFixed(1)}s`.padStart(6));
  const id = String(event.toolCallId || "");

  if (event.type === "agent_start") {
    return `${spotifyLogo}\n\n${dim("        ┃")}`;
  }
  if (event.type === "turn_start") return `${time}  ${dim("┃")} ${green("●")} ${white("Listening")}`;
  if (event.type === "agent_end") return `${dim("        ┃")}\n${green("        ●")} ${bold(white("Ready"))} ${dim(`· ${(elapsed / 1000).toFixed(1)}s`)}`;

  if (event.type === "tool_execution_start") {
    tools.set(id, elapsed);
    if (event.toolName === "trace_note") {
      const note = (event.args as { note?: unknown } | undefined)?.note;
      return `${time}  ${dim("┃")} ${blue("◆")} ${white(redact(String(note || "Working…")))}`;
    }
    return `${time}  ${dim("┃")} ${green("▶")} ${bold(white(toolName(event.toolName)))} ${toolArgs(event.toolName, event.args)}`.trimEnd();
  }

  if (event.type === "tool_execution_end") {
    if (event.toolName === "trace_note") return "";
    const took = elapsed - (tools.get(id) ?? elapsed);
    tools.delete(id);
    const mark = event.isError ? red("✗") : green("✓");
    const status = event.isError ? "failed" : "completed";
    const result = resultText(event.result);
    return `${time}  ${dim("┃")} ${mark} ${white(toolName(event.toolName))} ${status} ${dim(`· ${(took / 1000).toFixed(1)}s`)}${result ? `\n${dim("        ┃")} ${dim(result)}` : ""}`;
  }

  if (event.type === "auto_retry_start") {
    return `${time}  ${dim("┃")} ${orange("↻")} Retry ${String(event.attempt)}/${String(event.maxAttempts)}`;
  }

  if (event.type === "compaction_start") return `${time}  ${dim("┃")} ${blue("◫")} Compacting context`;
  return "";
}

export function formatAnswer(value: string) {
  return `\n${pill("RESULT")}\n${bold(white(value))}`;
}

function toolName(value: unknown) {
  const names: Record<string, string> = {
    spotify: "Spotify",
    tesla_media: "Tesla",
    tesla_comfort: "Tesla comfort",
    shell: "Scratch",
    supermemory_search: "Memory",
    supermemory_save: "Remember",
    supermemory_status: "Memory status",
    memory_recall: "Memory recall",
    memory_save: "Memory save",
  };
  return names[String(value)] || String(value);
}

function toolArgs(name: unknown, value: unknown) {
  const args = value as { args?: unknown; action?: unknown; volume?: unknown; command?: unknown } | undefined;
  if (name === "spotify" && Array.isArray(args?.args)) return dim(redact(args.args.join(" ")));
  if (name === "tesla_media") {
    return dim([args?.action, args?.volume].filter((part) => part !== undefined).join(" "));
  }
  if (name === "shell") return dim(redact(String(args?.command || ""))).slice(0, 300);
  if (name === "supermemory_search") {
    return dim(redact(String((value as { query?: unknown })?.query || "")));
  }
  if (name === "supermemory_save") return dim("durable preference");
  return dim(redact(JSON.stringify(value) || "").slice(0, 300));
}

function resultText(value: unknown) {
  const result = value as { content?: Array<{ type?: string; text?: string }> } | undefined;
  const text = result?.content
    ?.filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n");
  if (!text) return "";

  const clean = redact(text)
    .replace(/^exit: 0\s*/m, "")
    .replace(/^stdout:\s*/m, "")
    .replaceAll("\n", " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 320 ? `${clean.slice(0, 317)}…` : clean;
}

function redact(value: string) {
  return value
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[redacted-key]")
    .replace(/(OPENAI_API_KEY|PI_OPENAI_API_KEY|SUPERMEMORY_API_KEY)\s*[=:]\s*[^\s,}]+/gi, "$1=[redacted]");
}
