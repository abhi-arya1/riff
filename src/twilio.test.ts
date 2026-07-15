import { expect, test } from "bun:test";
import { twiml } from "./twilio";

test("creates bidirectional stream TwiML", () => {
  expect(twiml("wss://example.com/twilio/media")).toContain(
    '<Connect><Stream url="wss://example.com/twilio/media" /></Connect>',
  );
});
