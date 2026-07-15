import { expect, test } from "bun:test";
import { matchFast } from "./fast";

test("routes exact playback controls without Pi", () => {
  expect(matchFast("pause")?.args).toEqual(["pause"]);
  expect(matchFast("What am I listening to?")?.args).toEqual(["now-playing"]);
  expect(matchFast("Hey Riff, could you pause it please?")?.args).toEqual(["pause"]);
  expect(matchFast("set the volume to 35 percent")?.args).toEqual(["volume", "0.35"]);
});

test("does not fast-route requests that need interpretation", () => {
  expect(matchFast("play Radiohead")).toBeUndefined();
  expect(matchFast("skip songs like this in the future")).toBeUndefined();
  expect(matchFast("stop playing Drake")).toBeUndefined();
});

test("formats now-playing without a second model pass", () => {
  const fast = matchFast("what song is this");
  expect(fast?.answer({
    ok: true,
    output: { currently_playing: { description: "Choo Lo — The Local Train", is_playing: true } },
  })).toBe("You've got Choo Lo — The Local Train on.");
});
