import type { PiTrace } from "./pi";
import { runSpotify, type SpotifyResult } from "./spotify";

export type FastAction = {
  args: string[];
  answer: (result: SpotifyResult) => string;
};

export type PlaybackAction = "now_playing" | "pause" | "resume" | "next" | "previous" | "volume";

export function matchFast(input: string): FastAction | undefined {
  const text = input.toLowerCase()
    .replace(/[?.!,'’]/g, "")
    .replace(/\bplease\b/g, "")
    .replace(/\bdont change playback\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(?:hey )?riff /, "")
    .replace(/^(?:can|could|would) you /, "")
    .trim();

  if (/^(pause|pause it|pause this|pause the music|pause music|stop|stop the music|stop music)$/.test(text)) {
    return action(["pause"], "Paused.");
  }
  if (/^(resume|resume the music|resume music|continue|continue the music|play|play the music)$/.test(text)) {
    return action(["resume"], "Back on.");
  }
  if (/^(next|next song|next track|go to the next song|go to the next track|skip|skip it|skip this|skip this song|skip this track)$/.test(text)) {
    return action(["next"], "Skipped.");
  }
  if (/^(previous|previous song|previous track|go to the previous song|go to the previous track|go back|run that back)$/.test(text)) {
    return action(["previous"], "Running it back.");
  }
  if (/^(what am i listening to|what am i listening to right now|whats playing|what is playing|what song is this|whats this song|now playing)$/.test(text)) {
    return { args: ["now-playing"], answer: nowPlaying };
  }

  const volume = text.match(/^(?:set )?(?:the )?volume (?:to )?(\d{1,3})(?: percent|%)?$/);
  if (volume) {
    const percent = Number(volume[1]);
    if (percent >= 0 && percent <= 100) {
      return action(["volume", String(percent / 100)], `Volume's at ${percent}%.`);
    }
  }
}

export async function runFast(
  request: string,
  signal?: AbortSignal,
  onTrace?: (event: PiTrace) => void,
) {
  const fast = matchFast(request);
  if (!fast) return;

  const id = crypto.randomUUID();
  onTrace?.({ type: "agent_start" });
  onTrace?.({ type: "turn_start" });
  onTrace?.({ type: "tool_execution_start", toolCallId: id, toolName: "spotify", args: { args: [...fast.args, "--format", "json"] } });
  let result: SpotifyResult;
  try {
    result = await runSpotify(fast.args, signal);
  } catch (error) {
    result = { ok: false, output: "", error: signal?.aborted ? "Interrupted." : String(error) };
  }
  onTrace?.({
    type: "tool_execution_end",
    toolCallId: id,
    toolName: "spotify",
    isError: !result.ok,
    result: { content: [{ type: "text", text: JSON.stringify(result.output) }] },
  });
  onTrace?.({ type: "agent_end" });

  return {
    ok: result.ok,
    output: result.ok ? fast.answer(result) : "",
    error: result.error,
  };
}

export async function runPlayback(
  action: PlaybackAction,
  percent?: number,
  signal?: AbortSignal,
  onTrace?: (event: PiTrace) => void,
) {
  const request = action === "now_playing" ? "what am I listening to"
    : action === "next" ? "next"
    : action === "previous" ? "previous"
    : action === "volume" && Number.isFinite(percent) ? `volume ${percent}`
    : action;
  return await runFast(request, signal, onTrace) || {
    ok: false,
    output: "",
    error: "Invalid playback request",
  };
}

function action(args: string[], answer: string): FastAction {
  return { args, answer: () => answer };
}

function nowPlaying(result: SpotifyResult) {
  const output = result.output as {
    currently_playing?: { description?: unknown; is_playing?: unknown };
  } | undefined;
  const current = output?.currently_playing;
  const description = typeof current?.description === "string" ? current.description : "";
  if (!description) return "Nothing's playing right now.";
  if (current?.is_playing === false) return `${description} is paused.`;
  return `You've got ${description} on.`;
}
