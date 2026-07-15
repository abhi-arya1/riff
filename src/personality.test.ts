import { expect, test } from "bun:test";
import { personality } from "./personality";

test("gives Riff an original restrained music-friend voice", () => {
  expect(personality).toContain("deep pull");
  expect(personality).toContain("bet—let me try something");
  expect(personality).toContain("at most one in a response");
  expect(personality).toContain("transcription noise");
  expect(personality).toContain("Do not imitate");
});
