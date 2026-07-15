import { expect, test } from "bun:test";
import { spotifyGuide } from "./spotify-guide";

test("covers the complete top-level Spotify CLI", () => {
  const commands = [
    "play", "pause", "resume", "next", "previous", "seek", "shuffle",
    "repeat", "speed", "volume", "now-playing", "devices", "queue", "jam",
    "search", "lookup", "taste", "history", "ask", "websearch", "sts",
    "chat", "pairing", "agent", "library", "playlist", "folder", "ai",
    "telemetry", "tts", "browser", "me", "status", "open", "navigate",
    "version", "permissions", "notify",
  ];

  for (const command of commands) {
    expect(spotifyGuide).toContain(`- ${command}`);
  }
});

test("guides personalized discovery through the rich Spotify tools", () => {
  expect(spotifyGuide).toContain("history recent");
  expect(spotifyGuide).toContain("history top");
  expect(spotifyGuide).toContain("--fields duration");
  expect(spotifyGuide).toContain("bpm and genres");
  expect(spotifyGuide).toContain("Ask is for taste-aware judgment");
});

test("explicitly exposes every playback, content, and library command", () => {
  expect(spotifyGuide).toContain("PLAYBACK: play, pause, resume, next, previous, seek, shuffle, repeat, speed, volume, now-playing, devices, queue, jam");
  expect(spotifyGuide).toContain("CONTENT: search, lookup, taste, history, ask, websearch, sts");
  expect(spotifyGuide).toContain("LIBRARY: library, playlist, folder");
});

test("exposes useful system tools with voice and safety boundaries", () => {
  expect(spotifyGuide).toContain("ASSISTANT SYSTEM: browser, tts, me, status, open, navigate, version, notify");
  expect(spotifyGuide).toContain("tts synthesize --text <text>");
  expect(spotifyGuide).toContain("browser <id> snapshot");
  expect(spotifyGuide).toContain("me: read the current Spotify account identity");
  expect(spotifyGuide).toContain("OpenAI Realtime owns Riff's live voice");
  expect(spotifyGuide).toContain("weather, sunrise or sunset");
  expect(spotifyGuide).toContain("current information of any kind");
});

test("contains exact help-derived command shapes", () => {
  expect(spotifyGuide).toContain("seek <milliseconds> [--relative]");
  expect(spotifyGuide).toContain("jam permissions [--queue-only on|off] [--volume-control on|off]");
  expect(spotifyGuide).toContain("queue move <from-position> <to-position>");
  expect(spotifyGuide).toContain("playlist remove <playlist-uri> --positions");
  expect(spotifyGuide).toContain("Prefer a strong personal match over a public playlist");
  expect(spotifyGuide).toContain("folder remove <folder-uri> [--keep-contents]");
  expect(spotifyGuide).toContain("library batch [--stop-on-error]");
  expect(spotifyGuide).toContain("sts timeline set --episode-id <id> --from-file <path>");
});
