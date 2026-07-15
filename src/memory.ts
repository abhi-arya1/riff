import { join } from "node:path";
import { config } from "./config";

const root = join(import.meta.dir, "..");
let server: ReturnType<typeof Bun.spawn> | undefined;

export async function ensureMemory() {
  if (await online()) return true;
  if (!config.piGatewayKey) return false;

  server ||= Bun.spawn(["bun", "src/memory-server.ts"], {
    cwd: root,
    env: process.env,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });

  for (let attempt = 0; attempt < 120; attempt++) {
    if (await online()) return true;
    if (server.exitCode !== null) return false;
    await Bun.sleep(500);
  }

  return false;
}

async function online() {
  try {
    const response = await fetch(config.memoryUrl, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

process.on("exit", () => server?.kill());
