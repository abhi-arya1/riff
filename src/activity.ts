import type { PiTrace } from "./pi";

export function activityStep(event: PiTrace) {
  const name = String(event.toolName || "");
  if (event.type === "tool_execution_end" && name === "spotify") {
    const options = trackOptions(traceText(event.result));
    return options.length ? `Considered ${options.join(" · ")}` : "";
  }
  if (event.type !== "tool_execution_start") return "";
  const args = event.args as Record<string, unknown> | undefined;

  if (name === "trace_note" && typeof args?.note === "string") return args.note;
  if (name !== "spotify" || !Array.isArray(args?.args)) return "";

  const command = args.args.map(String);
  const [top, next] = command;
  if (top === "taste") return "Checked your taste profile";
  if (top === "history") return next === "recent" ? "Checked your recent rotation" : "Checked your listening history";
  if (top === "search") return `Searched Spotify for ${short(command[1])}`;
  if (top === "lookup") return "Verified the track details";
  if (top === "ask") return "Asked Spotify to weigh the musical fit";
  if (top === "websearch") return "Checked current sources";
  if (top === "browser") return "Checked the web";
  if (top === "library") return "Checked your saved music";
  if (top === "playlist") return next === "get" ? "Inspected one of your playlists" : "Updated the playlist";
  if (top === "folder") return "Checked your playlist folders";
  if (top === "queue") return "Updated the queue";
  if (top === "play") return "Started the selected track";
  return "";
}

export function trackOptions(value: string) {
  if (!value.includes("Tracks:")) return [];
  return value
    .split(/spotify:track:[A-Za-z0-9]+/)
    .flatMap((part, index) => {
      let text = part.replace(/[\r\n]+/g, " ").replace(/^.*Tracks:\s*/, "").trim();
      if (index > 0) text = text.replace(/^.*?\s{2,}/, "").trim();
      const at = text.lastIndexOf(" by ");
      if (at < 1) return [];
      const title = text.slice(0, at).trim().slice(-70);
      const artist = text.slice(at + 4).trim().slice(0, 50);
      return title && artist ? [`${title} — ${artist}`] : [];
    })
    .slice(0, 3);
}

function traceText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const content = (value as { content?: Array<{ text?: unknown }> }).content;
  return Array.isArray(content)
    ? content.map((item) => typeof item.text === "string" ? item.text : "").join("\n")
    : "";
}

function short(value: unknown) {
  const text = String(value || "").replaceAll('"', "").trim();
  return text.length > 52 ? `${text.slice(0, 49)}…` : text || "a matching track";
}
