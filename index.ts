import { Hono } from "hono";
import { upgradeWebSocket, websocket } from "hono/bun";
import { join } from "node:path";
import { config } from "./src/config";
import { createMusicAgent } from "./src/pi";
import { createTeslaBle } from "./src/tesla-ble";
import { createRealtimeMemory } from "./src/realtime-memory";
import { ensureMemory } from "./src/memory";
import { createBridge, realtimeConfig, runRealtimeTool } from "./src/realtime";
import { runSpotify } from "./src/spotify";
import { createTracePrinter } from "./src/trace";
import { twiml } from "./src/twilio";
import { activityStep } from "./src/activity";

const app = new Hono();
const web = join(import.meta.dir, "web");
type Companion = {
  agent: ReturnType<typeof createMusicAgent>;
  tesla: ReturnType<typeof createTeslaBle>;
  memory: ReturnType<typeof createRealtimeMemory>;
  interrupt: () => void;
};

const companions = new Map<string, Companion>();

app.get("/", () => new Response(Bun.file(join(web, "index.html"))));
app.get("/app.js", () => new Response(Bun.file(join(web, "app.js")), {
  headers: { "content-type": "text/javascript; charset=utf-8" },
}));
app.get("/style.css", () => new Response(Bun.file(join(web, "style.css")), {
  headers: { "content-type": "text/css; charset=utf-8" },
}));

app.get("/health", async (c) => {
  const result = await runSpotify(["status"]);
  return c.json({ ok: result.ok, spotify: result });
});

app.get("/api/playback", async (c) => {
  const result = await runSpotify(["now-playing"]);
  return c.json(result);
});

app.post("/api/realtime/session", async (c) => {
  if (!config.openaiKey) return c.text("PI_OPENAI_API_KEY or OPENAI_API_KEY is required", 500);
  const id = c.req.query("id");
  if (!id) return c.text("Missing session id", 400);
  getCompanion(id);

  const form = new FormData();
  form.set("sdp", await c.req.text());
  form.set("session", JSON.stringify(realtimeConfig("web")));
  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.openaiKey}` },
    body: form,
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/sdp" },
  });
});

app.post("/api/tool", async (c) => {
  const input = await c.req.json<{
    id?: unknown;
    name?: unknown;
    args?: unknown;
  }>();
  if (typeof input.id !== "string" || typeof input.name !== "string") {
    return c.json({ ok: false, output: "", error: "Invalid tool request" }, 400);
  }
  const companion = getCompanion(input.id);
  const steps: string[] = [];
  const result = await runRealtimeTool(
    input.name,
    input.args,
    companion.agent,
    companion.tesla,
    companion.memory,
    undefined,
    (event) => {
      const step = activityStep(event);
      if (step && steps.at(-1) !== step) steps.push(step);
    },
  );
  return c.json({ ...result, steps: steps.slice(-6) });
});

app.post("/api/interrupt", async (c) => {
  const input = await c.req.json<{ id?: unknown }>();
  if (typeof input.id === "string") companions.get(input.id)?.interrupt();
  return c.json({ ok: true });
});

app.post("/api/end", async (c) => {
  const input = await c.req.json<{ id?: unknown }>();
  if (typeof input.id === "string") {
    companions.get(input.id)?.interrupt();
    companions.delete(input.id);
  }
  return c.json({ ok: true });
});

app.post("/twilio/voice", (c) => {
  const host = config.publicUrl || new URL(c.req.url).origin;
  const socketUrl = host.replace(/^http/, "ws") + "/twilio/media";
  return c.body(twiml(socketUrl), 200, { "content-type": "text/xml" });
});

app.get(
  "/twilio/media",
  upgradeWebSocket(() => {
    let bridge: ReturnType<typeof createBridge> | undefined;

    return {
      onOpen(_, ws) {
        bridge = createBridge((message) => ws.send(message));
      },
      onMessage(event) {
        bridge?.fromTwilio(String(event.data));
      },
      onClose() {
        bridge?.close();
      },
      onError(error) {
        console.error("Twilio socket error", error);
        bridge?.close();
      },
    };
  }),
);

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
  websocket,
  development: config.env !== "production",
});

console.log(`Riff listening on ${server.url}`);
void ensureMemory();

function getCompanion(id: string) {
  let companion = companions.get(id);
  if (!companion) {
    const trace = createTracePrinter(Date.now(), { showSplash: false });
    const agent = createMusicAgent({ onTrace: trace });
    const tesla = createTeslaBle({ onTrace: trace });
    const memory = createRealtimeMemory({ onTrace: trace });
    companion = {
      agent,
      tesla,
      memory,
      interrupt() {
        agent.interrupt();
        tesla.interrupt();
        memory.interrupt();
      },
    };
    companions.set(id, companion);
  }
  return companion;
}
