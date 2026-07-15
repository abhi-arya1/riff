import { expect, test } from "bun:test";
import { createRealtimeMemory, formatMemories, unsafeMemory } from "./realtime-memory";

test("rejects sensitive, precise, and routine memories", () => {
  expect(unsafeMemory("My API key is abc123")).toContain("secrets");
  expect(unsafeMemory("My precise location is 37.7749, -122.4194")).toContain("location");
  expect(unsafeMemory("My home address is 1 Main Street")).toContain("location");
  expect(unsafeMemory("Play more Clairo")).toContain("Routine playback");
  expect(unsafeMemory("I prefer upbeat indie on long drives")).toBe("");
});

test("recalls narrow context from the local memory API", async () => {
  let body: any;
  const memory = createRealtimeMemory({
    ensure: async () => true,
    fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ results: [{ content: "The user prefers upbeat indie on long drives." }] });
    }) as typeof fetch,
  });

  const result = await memory.recall("driving music preferences");
  expect(result.ok).toBe(true);
  expect(result.output).toContain("upbeat indie");
  expect(body).toMatchObject({ q: "driving music preferences", containerTag: "riff", limit: 5 });
});

test("saves one concise durable fact", async () => {
  let body: any;
  const memory = createRealtimeMemory({
    ensure: async () => true,
    fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ ok: true });
    }) as typeof fetch,
  });

  const result = await memory.save("The user calls their late-night driving mix Night Glass.");
  expect(result.ok).toBe(true);
  expect(body.memories[0].content).toBe("The user calls their late-night driving mix Night Glass.");
  expect(body.memories[0].metadata.type).toBe("durable_preference");
});

test("formats empty and populated memory results for Realtime", () => {
  expect(formatMemories({ results: [] })).toBe("No relevant personal memory was found.");
  expect(formatMemories({ data: [{ text: "Likes deeper pulls." }] })).toContain("Likes deeper pulls.");
  expect(formatMemories({ results: [{ content: "User: Sunset mode means mellow psych.\nAssistant: Got it." }] })).not.toContain("Assistant:");
});
