import { expect, test } from "bun:test";
import { agentPrompt } from "./pi";

test("lets one music agent choose a dynamic Spotify approach", () => {
  expect(agentPrompt).toContain("There is no fixed recommendation recipe");
  expect(agentPrompt).toContain("Ask only when its broader taste or cultural judgment materially helps");
  expect(agentPrompt).toContain("report the evidence behind the decision");
  expect(agentPrompt).toContain("bias toward their playlists before public playlists");
  expect(agentPrompt).toContain("never force a weak one");
  expect(agentPrompt).toContain("Broad discovery, surprise, and exploration requests may roam across Spotify");
  expect(agentPrompt).toContain("Current playlist and current queue are different");
  expect(agentPrompt).toContain("Do not substitute queue results");
  expect(agentPrompt).not.toContain("use Spotify Ask with one self-contained request");
});

test("uses live research for ordinary current questions", () => {
  expect(agentPrompt).toContain("You are not music-only");
  expect(agentPrompt).toContain("weather, sunrise or sunset");
  expect(agentPrompt).toContain("Never say you cannot access current information without trying");
  expect(agentPrompt).toContain("asking only for the city or ZIP");
});
