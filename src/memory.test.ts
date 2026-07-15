import { expect, test } from "bun:test";

test("filters arbitrary file ingestion from the memory extension", async () => {
  const source = await Bun.file(new URL("../.pi/extensions/memory.ts", import.meta.url)).text();
  expect(source).toContain('tool.name !== "supermemory_save_file"');
  expect(source).toContain('name === "registerCommand"');
});
