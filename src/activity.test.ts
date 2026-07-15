import { expect, test } from "bun:test";
import { activityStep, trackOptions } from "./activity";

test("turns agent tool traces into a car-friendly activity log", () => {
  expect(activityStep({
    type: "tool_execution_start",
    toolName: "spotify",
    args: { args: ["history", "recent", "--limit", "10"] },
  })).toBe("Checked your recent rotation");
  expect(activityStep({
    type: "tool_execution_start",
    toolName: "spotify",
    args: { args: ["search", "upbeat indie for the drive"] },
  })).toBe("Searched Spotify for upbeat indie for the drive");
  expect(activityStep({
    type: "tool_execution_start",
    toolName: "trace_note",
    args: { note: "Comparing recent favorites against the energy request" },
  })).toBe("Comparing recent favorites against the energy request");
  expect(activityStep({
    type: "tool_execution_start",
    toolName: "spotify",
    args: { args: ["playlist", "get", "spotify:playlist:mine"] },
  })).toBe("Inspected one of your playlists");
  expect(activityStep({
    type: "tool_execution_start",
    toolName: "spotify",
    args: { args: ["websearch", "sunset today in Los Angeles"] },
  })).toBe("Checked current sources");
});

test("does not expose raw unrelated tool traces", () => {
  expect(activityStep({ type: "tool_execution_end", toolName: "spotify" })).toBe("");
  expect(activityStep({ type: "tool_execution_start", toolName: "shell", args: {} })).toBe("");
});

test("surfaces a few search options without dumping raw Spotify output", () => {
  const output = "exit: 0\nstdout:\nTracks: Supercut by Lorde spotify:track:one Pretty by Mk.gee spotify:track:two 4EVER by Clairo spotify:track:three Bags by Clairo spotify:track:four";
  expect(trackOptions(output)).toEqual([
    "Supercut — Lorde",
    "Pretty — Mk.gee",
    "4EVER — Clairo",
  ]);
  expect(activityStep({
    type: "tool_execution_end",
    toolName: "spotify",
    result: { content: [{ type: "text", text: output }] },
  })).toContain("Considered Supercut — Lorde");
});
