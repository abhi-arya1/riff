import { config } from "./config";

if (!config.piGatewayKey) {
  console.error("PI_AI_GATEWAY_API_KEY is required to run local memory.");
  process.exit(1);
}

await Bun.$`mkdir -p ${config.memoryData}`.quiet();

const child = Bun.spawn([
  "bunx",
  "supermemory",
  "local",
  "--port",
  String(config.memoryPort),
], {
  cwd: new URL("..", import.meta.url).pathname,
  env: {
    ...process.env,
    SUPERMEMORY_DATA_DIR: config.memoryData,
    OPENAI_BASE_URL: "https://ai-gateway.vercel.sh/v1",
    OPENAI_API_KEY: config.piGatewayKey,
    OPENAI_MODEL: config.memoryModel,
    OPENAI_FAST_MODEL: config.memoryModel,
    OPENAI_TEXT_MODEL: config.memoryModel,
  },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}

process.exitCode = await child.exited;
