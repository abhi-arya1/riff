import { expect, test } from "bun:test";
import { formatAnswer, formatTrace } from "./trace";

test("formats tool traces", () => {
  expect(formatTrace({
    type: "tool_execution_start",
    toolName: "spotify",
    args: { args: ["now-playing", "--format", "json"] },
  }, 1234)).toContain("▶ Spotify");

  expect(formatTrace({
    type: "tool_execution_end",
    toolName: "spotify",
    isError: false,
    result: { content: [{ type: "text", text: "exit: 0" }] },
  }, 2345)).toContain("Spotify completed");
});

test("formats public reasoning notes", () => {
  expect(formatTrace({
    type: "tool_execution_start",
    toolCallId: "note-1",
    toolName: "trace_note",
    args: { note: "Checking the active Spotify player first." },
  }, 500)).toContain("Checking the active Spotify player first.");
});

test("formats a Spotify-style result block", () => {
  expect(formatAnswer("Paused.")).toContain("RESULT");
  expect(formatAnswer("Paused.")).toContain("Paused.");
});

test("opens with the Spotify glyph instead of a text title", () => {
  const splash = formatTrace({ type: "agent_start" }, 0);
  expect(splash).toContain("⣿⣿⣿⣿");
  expect(splash).not.toContain("SPOTIFY COMPANION");
  expect(splash).not.toContain("ISOLATED MUSIC AGENT");
});

test("does not print message deltas or secrets", () => {
  expect(formatTrace({ type: "message_update", secret: "hidden reasoning" }, 1)).toBe("");
  expect(formatTrace({
    type: "tool_execution_start",
    toolName: "shell",
    args: { key: "sk-this-is-a-secret-key-value" },
  }, 1)).not.toContain("sk-this-is-a-secret-key-value");
});
