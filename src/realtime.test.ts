import { expect, test } from "bun:test";
import { realtimeInstructions, realtimeSession, runRealtimeTool } from "./realtime";

test("keeps Realtime generation under explicit interruption control", () => {
  const update = realtimeSession() as any;
  expect(update.session.audio.input.turn_detection).toEqual({
    type: "semantic_vad",
    create_response: true,
    interrupt_response: false,
  });
});

test("shares Riff's personality with the voice layer", () => {
  expect(realtimeInstructions()).toContain("deep pull");
  expect(realtimeInstructions()).toContain("Use spotify_playback for now-playing");
  expect(realtimeInstructions()).toContain("music friend");
});

test("uses a compact humanlike spoken prompt structure", () => {
  const instructions = realtimeInstructions();
  expect(instructions).toContain("rules:");
  expect(instructions).toContain("one or two spoken sentences");
  expect(instructions).toContain("Write for the ear");
  expect(instructions).toContain("Do not end with a generic yes-or-no question");
  expect(instructions).toContain("working aloud:");
  expect(instructions).toContain("say one brief natural progress thought");
  expect(instructions).toContain("Never narrate spotify_playback");
  expect(instructions).toContain("never promise an unconfirmed answer, track, artist");
  expect(instructions).toContain("The agent owns the research or choice");
  expect(instructions).toContain("follow its actual result");
  expect(instructions).toContain("Ignore isolated Korean, Chinese, or Japanese characters");
});

test("gives Realtime a dedicated low-latency playback tool", () => {
  const update = realtimeSession("web") as any;
  expect(update.session.tools[0].name).toBe("spotify_playback");
  expect(update.session.tools[0].parameters.properties.action.enum).toContain("now_playing");
});

test("gives dynamic music work to one adaptive agent", () => {
  const update = realtimeSession("web") as any;
  expect(update.session.tools.map((tool: { name: string }) => tool.name)).toEqual([
    "spotify_playback",
    "personal_memory",
    "car_media",
    "car_comfort",
    "riff_agent",
  ]);
  expect(realtimeInstructions()).toContain("Use riff_agent for every request that needs deeper reasoning");
  expect(realtimeInstructions()).toContain("live websearch and a browser");
});

test("makes contextual musical initiative optional instead of hardcoded", () => {
  const instructions = realtimeInstructions();
  expect(instructions).toContain("musical initiative:");
  expect(instructions).toContain("inspiration, not rules");
  expect(instructions).toContain("do it sparingly");
  expect(instructions).not.toContain("Life Is a Highway");
  expect(instructions).not.toContain("Le Festin");
});

test("recalls memory lazily and saves only durable explicit context", () => {
  const instructions = realtimeInstructions();
  expect(instructions).toContain("Do not preload a profile");
  expect(instructions).toContain("explicit durable preference");
  expect(instructions).toContain("Never save inferred taste");
});

test("exposes only narrow BLE comfort controls to Realtime", () => {
  const update = realtimeSession("web") as any;
  const tool = update.session.tools.find((item: { name: string }) => item.name === "car_comfort");
  expect(tool.parameters.properties.action.enum).toEqual([
    "climate_on",
    "climate_off",
    "set_temperature",
    "seat_heater",
    "steering_wheel_heater",
  ]);
  expect(realtimeInstructions()).toContain("It cannot control locks, doors, trunk");
});

test("routes car volume directly to Tesla instead of Spotify", async () => {
  const update = realtimeSession("web") as any;
  const tool = update.session.tools.find((item: { name: string }) => item.name === "car_media");
  expect(tool.parameters.properties.action.enum).toContain("volume_up");
  expect(realtimeInstructions()).toContain("an unqualified 'turn it up'");
  expect(realtimeInstructions()).toContain("Never claim Tesla volume is unavailable");

  const calls: unknown[] = [];
  const tesla = {
    media: async (request: unknown) => {
      calls.push(request);
      return { ok: true, output: "Tesla volume is up one step." };
    },
  };
  const result = await runRealtimeTool("car_media", { action: "volume_up" }, {} as any, tesla as any);
  expect(result.ok).toBe(true);
  expect(calls).toEqual([{ action: "volume_up" }]);
});


test("lets WebRTC own browser audio and native interruption", () => {
  const update = realtimeSession("web") as any;
  expect(update.session.model).toBeTruthy();
  expect(update.session.audio.input.format).toBeUndefined();
  expect(update.session.audio.output.format).toBeUndefined();
  expect(update.session.audio.input.turn_detection.interrupt_response).toBe(true);
  expect(update.session.audio.input.turn_detection.threshold).toBe(0.65);
  expect(update.session.audio.input.turn_detection.eagerness).toBeUndefined();
});

test("keeps recommendation constraints across corrections", () => {
  const instructions = realtimeInstructions();
  expect(instructions).toContain("Corrections add or sharpen constraints");
  expect(instructions).toContain("never discards taste, mood, energy");
});

test("grounds lyric fragments and interrupted work in live state", () => {
  const instructions = realtimeInstructions();
  expect(instructions).toContain("Trusted live Spotify state");
  expect(instructions).toContain("sing-along, not automatically a command");
  expect(instructions).toContain("previous action was cancelled");
  expect(instructions).toContain("Never say it is still loading");
});

test("keeps CLI details inside Pi and hands off outcomes", () => {
  const instructions = realtimeInstructions();
  expect(instructions).toContain("Do not choose CLI commands");
  expect(instructions).toContain("Hand Pi the user's desired outcome");
  expect(instructions).toContain("answer, an action, or both");
  expect(instructions).not.toContain("--format json");
});

test("hands the complete musical outcome to the same agent", async () => {
  const requests: string[] = [];
  const agent = {
    ask: async (request: string) => {
      requests.push(request);
      return { ok: true, output: "Played a confirmed fit." };
    },
    interrupt() {},
  };
  const request = "Use my recent listening, keep it genuinely upbeat, avoid repeats, choose one track, and play it.";
  const result = await runRealtimeTool("riff_agent", { request }, agent as any);
  expect(result.ok).toBe(true);
  expect(requests).toEqual([request]);
});
