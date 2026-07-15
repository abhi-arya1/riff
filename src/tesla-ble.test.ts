import { expect, test } from "bun:test";
import { comfortArgs, createTeslaBle, mediaArgs } from "./tesla-ble";

test("maps safe comfort actions to fixed BLE commands", () => {
  expect(comfortArgs({ action: "climate_on" })).toEqual(["-ble", "climate-on"]);
  expect(comfortArgs({ action: "climate_off" })).toEqual(["-ble", "climate-off"]);
  expect(comfortArgs({ action: "set_temperature", celsius: 21 })).toEqual(["-ble", "climate-set-temp", "21c"]);
  expect(comfortArgs({ action: "seat_heater", seat: "front-left", level: "high" })).toEqual([
    "-ble", "seat-heater", "front-left", "high",
  ]);
  expect(comfortArgs({ action: "steering_wheel_heater", state: "on" })).toEqual([
    "-ble", "steering-wheel-heater", "on",
  ]);
});

test("rejects incomplete or extreme comfort requests", () => {
  expect(() => comfortArgs({ action: "set_temperature", celsius: 40 })).toThrow();
  expect(() => comfortArgs({ action: "seat_heater", seat: "front-left" })).toThrow();
  expect(() => comfortArgs({ action: "steering_wheel_heater" })).toThrow();
});

test("maps safe Tesla media actions to fixed BLE commands", () => {
  expect(mediaArgs({ action: "volume_up" })).toEqual(["-ble", "media-volume-up"]);
  expect(mediaArgs({ action: "volume_down" })).toEqual(["-ble", "media-volume-down"]);
  expect(mediaArgs({ action: "set_volume", volume: 4 })).toEqual(["-ble", "media-set-volume", "4"]);
  expect(() => mediaArgs({ action: "set_volume", volume: 11 })).toThrow();
});

test("mocks BLE comfort without touching the car", async () => {
  let ran = false;
  const tesla = createTeslaBle({
    mock: true,
    run: async () => {
      ran = true;
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const result = await tesla.comfort({ action: "seat_heater", seat: "front-left", level: "medium" });
  expect(result).toEqual({
    ok: true,
    output: "Simulated: Driver seat heat is medium. Nothing was sent to a vehicle.",
    mock: true,
  });
  expect(ran).toBe(false);
});

test("runs each real BLE comfort command once", async () => {
  const calls: string[][] = [];
  const tesla = createTeslaBle({
    enabled: true,
    mock: false,
    ready: true,
    run: async (args) => {
      calls.push(args);
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const result = await tesla.comfort({ action: "set_temperature", celsius: 20 });
  expect(result).toEqual({ ok: true, output: "Tesla cabin temperature is set to 20°C." });
  expect(calls).toEqual([["-ble", "climate-set-temp", "20c"]]);
});
