import { expect, test } from "bun:test";
import musicExtension, { mockTesla, teslaArgs } from "../.pi/extensions/music";

test("maps Tesla media actions to fixed BLE commands", () => {
  expect(teslaArgs("next")).toEqual(["-ble", "media-next-track"]);
  expect(teslaArgs("previous")).toEqual(["-ble", "media-previous-track"]);
  expect(teslaArgs("volume_up")).toEqual(["-ble", "media-volume-up"]);
  expect(teslaArgs("volume_down")).toEqual(["-ble", "media-volume-down"]);
  expect(teslaArgs("toggle_playback")).toEqual(["-ble", "media-toggle-playback"]);
  expect(teslaArgs("set_volume", 4)).toEqual(["-ble", "media-set-volume", "4"]);
});

test("rejects missing or unsafe absolute volume", () => {
  expect(() => teslaArgs("set_volume")).toThrow();
  expect(() => teslaArgs("set_volume", -1)).toThrow();
  expect(() => teslaArgs("set_volume", 11)).toThrow();
});

test("mocks Tesla media calls without running a vehicle command", () => {
  expect(mockTesla("next", undefined)).toEqual({
    code: 0,
    stdout: JSON.stringify({
      mock: true,
      sent: false,
      action: "next",
      command: ["-ble", "media-next-track"],
    }),
    stderr: "",
  });
});

test("exposes Tesla only when explicitly enabled and configured", () => {
  const old = {
    enabled: process.env.TESLA_ENABLED,
    vin: process.env.TESLA_VIN,
    key: process.env.TESLA_KEY_NAME,
    mock: process.env.TESLA_MOCK,
  };

  try {
    process.env.TESLA_ENABLED = "true";
    process.env.TESLA_VIN = "TESTVIN";
    process.env.TESLA_KEY_NAME = "test-key";
    delete process.env.TESLA_MOCK;
    const names: string[] = [];
    musicExtension({ registerTool: (tool: { name: string }) => names.push(tool.name) });
    expect(names).toEqual(["spotify", "tesla_media", "shell"]);
  } finally {
    setEnv("TESLA_ENABLED", old.enabled);
    setEnv("TESLA_VIN", old.vin);
    setEnv("TESLA_KEY_NAME", old.key);
    setEnv("TESLA_MOCK", old.mock);
  }
});

test("exposes a mock Tesla tool without a VIN or key", () => {
  const old = {
    enabled: process.env.TESLA_ENABLED,
    vin: process.env.TESLA_VIN,
    key: process.env.TESLA_KEY_NAME,
    mock: process.env.TESLA_MOCK,
  };

  try {
    process.env.TESLA_ENABLED = "false";
    process.env.TESLA_MOCK = "true";
    delete process.env.TESLA_VIN;
    delete process.env.TESLA_KEY_NAME;
    const names: string[] = [];
    musicExtension({ registerTool: (tool: { name: string }) => names.push(tool.name) });
    expect(names).toEqual(["spotify", "tesla_media", "shell"]);
  } finally {
    setEnv("TESLA_ENABLED", old.enabled);
    setEnv("TESLA_VIN", old.vin);
    setEnv("TESLA_KEY_NAME", old.key);
    setEnv("TESLA_MOCK", old.mock);
  }
});

test("lets Spotify batch commands receive stdin manifests", () => {
  let spotify: any;
  musicExtension({
    registerTool: (tool: { name: string }) => {
      if (tool.name === "spotify") spotify = tool;
    },
  });
  expect(spotify.parameters.properties.stdin).toBeTruthy();
});

function setEnv(name: string, value?: string) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
