import { config } from "./config";

export type SpotifyResult = {
  ok: boolean;
  output: unknown;
  error?: string;
};

export async function runSpotify(args: string[], signal?: AbortSignal): Promise<SpotifyResult> {
  const proc = Bun.spawn([config.spotifyCli, ...args, "--format", "json"], {
    signal,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  const text = stdout.trim();
  const error = stderr.trim();

  if (code !== 0) {
    return { ok: false, output: text, error: error || `Exited with ${code}` };
  }

  try {
    return { ok: true, output: JSON.parse(text) };
  } catch {
    return { ok: true, output: text };
  }
}
