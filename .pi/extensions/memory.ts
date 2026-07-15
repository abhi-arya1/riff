import { createSupermemoryExtension } from "../npm/node_modules/@ramarivera/pi-supermemory/src/index.ts";

export default function (pi: any) {
  const safePi = new Proxy(pi, {
    get(target, name) {
      if (name === "registerTool") {
        return (tool: { name?: string }) => {
          if (tool.name !== "supermemory_save_file") target.registerTool(tool);
        };
      }

      if (name === "registerCommand") return () => {};

      const value = Reflect.get(target, name);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  createSupermemoryExtension({
    containerTag: process.env.RIFF_MEMORY_CONTAINER || "riff",
    autoRecall: true,
    autoCapture: true,
    captureMode: "signal",
    maxRecall: 5,
  }).register(safePi);
}
