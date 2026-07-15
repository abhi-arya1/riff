import { join } from "node:path";

const defaultCli =
  "/Applications/Studio by Spotify Labs.app/Contents/MacOS/spotify_cli";
const defaultTesla = join(import.meta.dir, "..", ".data", "bin", "tesla-control");
const data = join(import.meta.dir, "..", ".data");
const memoryUrl = Bun.env.SUPERMEMORY_API_BASE_URL || "http://127.0.0.1:8787";

function gatewayModel(value: string) {
  return value.replace(/^vercel-ai-gateway\//, "");
}

export const config = {
  env: Bun.env.NODE_ENV || "development",
  openaiKey: Bun.env.OPENAI_API_KEY || Bun.env.PI_OPENAI_API_KEY || "",
  openaiModel: Bun.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2025-08-28",
  openaiVoice: Bun.env.OPENAI_VOICE || "marin",
  pi: Bun.env.PI_PATH || "pi",
  piOpenaiKey: Bun.env.PI_OPENAI_API_KEY || Bun.env.OPENAI_API_KEY || "",
  piGatewayKey: Bun.env.PI_AI_GATEWAY_API_KEY || Bun.env.AI_GATEWAY_API_KEY || "",
  piModel: Bun.env.PI_MODEL || "openai/gpt-5.6",
  piThinking: Bun.env.PI_THINKING || "low",
  piTimeout: Number(Bun.env.PI_TIMEOUT_MS || 60_000),
  memoryUrl,
  memoryKey: Bun.env.SUPERMEMORY_API_KEY || (memoryUrl.startsWith("http://127.0.0.1:") ? "local" : ""),
  memoryContainer: Bun.env.RIFF_MEMORY_CONTAINER || "riff",
  memoryData: Bun.env.SUPERMEMORY_DATA_DIR || join(data, "supermemory"),
  memoryPort: Number(Bun.env.SUPERMEMORY_PORT || 8787),
  memoryModel: Bun.env.SUPERMEMORY_MODEL || gatewayModel(Bun.env.PI_MODEL || "google/gemini-3.1-flash-lite"),
  port: Number(Bun.env.PORT || 3000),
  publicUrl: (Bun.env.PUBLIC_URL || "").replace(/\/$/, ""),
  spotifyCli: Bun.env.SPOTIFY_CLI_PATH || defaultCli,
  teslaEnabled: Bun.env.TESLA_ENABLED === "true",
  teslaMock: Bun.env.TESLA_MOCK === "true",
  teslaControl: Bun.env.TESLA_CONTROL_PATH || defaultTesla,
  teslaVin: Bun.env.TESLA_VIN || "",
  teslaKeyName: Bun.env.TESLA_KEY_NAME || "",
  teslaTimeout: Number(Bun.env.TESLA_TIMEOUT_MS || 20_000),
};
