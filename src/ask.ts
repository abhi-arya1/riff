import { createMusicAgent } from "./pi";
import { createTracePrinter, formatAnswer } from "./trace";

const args = Bun.argv.slice(2);
const trace = args.includes("--trace");
const request = args.filter((arg) => arg !== "--trace").join(" ").trim();

if (!request) {
  console.error('Usage: bun run agent -- [--trace] "What is playing?"');
  process.exit(1);
}

const started = Date.now();
const printTrace = createTracePrinter(started);
const result = await createMusicAgent({
  onTrace: trace
    ? printTrace
    : undefined,
}).ask(request);

if (result.ok) {
  console.log(trace ? formatAnswer(result.output) : result.output);
} else {
  console.error(result.error || "Music agent failed");
  process.exitCode = 1;
}
