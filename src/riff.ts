import { createInterface } from "node:readline";
import { createMusicAgent } from "./pi";
import { createTracePrinter, formatAnswer, splash } from "./trace";

const trace = Bun.argv.includes("--trace");
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const agent = createMusicAgent({
  onTrace: trace ? createTracePrinter(Date.now(), { showSplash: false }) : undefined,
});

console.log(splash());
console.log("\nRIFF · your solo aux\n");
terminal.setPrompt("riff › ");
terminal.prompt();

let busy = false;
let latest = 0;

terminal.on("line", async (line) => {
  const request = line.trim();
  if (!request) return terminal.prompt();
  if (["/quit", "/exit"].includes(request)) return terminal.close();

  if (busy) {
    agent.interrupt();
    console.log("\n↳ interrupted");
  }

  busy = true;
  const turn = ++latest;
  const result = await agent.ask(request);
  if (turn !== latest) return;
  busy = false;
  if (result.ok) console.log(trace ? formatAnswer(result.output) : `\n${result.output}`);
  else console.error(`\n${result.error || "Riff failed"}`);
  console.log();
  terminal.prompt();
});

terminal.on("SIGINT", () => {
  if (busy) {
    latest++;
    busy = false;
    agent.interrupt();
    console.log("\n↳ interrupted\n");
    terminal.prompt();
    return;
  }
  terminal.close();
});

terminal.on("close", () => console.log("\nLater."));
