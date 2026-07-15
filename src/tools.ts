export const tools = [
  {
    type: "function",
    name: "spotify_playback",
    description: "Use this low-latency tool for exact Spotify playback state and controls. Never use riff_agent for these commands.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["now_playing", "pause", "resume", "next", "previous", "volume"],
          description: "The exact playback operation.",
        },
        percent: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "Required only when action is volume.",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "personal_memory",
    description: "Recall personal context from prior sessions only when it is relevant, or save an explicit durable preference, correction, named ritual, or user request to remember. Never save routine actions, inferred taste, raw conversation, secrets, or precise location.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["recall", "save"] },
        query: { type: "string", description: "Required for recall. A narrow description of the prior context needed now." },
        memory: { type: "string", description: "Required for save. One concise, self-contained durable fact explicitly supported by the user." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "car_media",
    description: "Control the nearby Tesla's active media player directly over BLE. Use for Tesla, car, cabin, speaker, or unqualified in-car volume and media transport. This is distinct from Spotify playback volume.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["volume_up", "volume_down", "set_volume", "next", "previous", "toggle_playback"],
        },
        volume: {
          type: "number",
          minimum: 0,
          maximum: 10,
          description: "Required only for set_volume. Tesla volume uses levels 0 through 10.",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "car_comfort",
    description: "Control only hands-free Tesla cabin comfort over local BLE: climate, cabin temperature, front-seat heat, and steering-wheel heat. Use for an explicit request or clear discomfort. Never use for locks, closures, charging, driving, navigation, or security settings.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["climate_on", "climate_off", "set_temperature", "seat_heater", "steering_wheel_heater"],
        },
        celsius: { type: "number", minimum: 15, maximum: 28 },
        seat: { type: "string", enum: ["front-left", "front-right"] },
        level: { type: "string", enum: ["off", "low", "medium", "high"] },
        state: { type: "string", enum: ["on", "off"] },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "riff_agent",
    description: [
      "Delegate any task that needs deeper reasoning, live research, or multi-step action. This includes general current facts, web research, recommendations, discovery, taste, history, playlists, queues, library work, browser work, Spotify TTS-file, and Tesla-media work.",
      "Pi can reason, remember preferences, search the live web, use a browser, choose its approach dynamically, and perform the whole task with every Spotify PLAYBACK, CONTENT, LIBRARY, and assistant-facing SYSTEM capability.",
      "Send one complete desired outcome. Do not tell Pi which CLI commands to call or divide the work into steps.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "The desired outcome, including whether to answer, act, or both; exact entities; relevant location or time context already provided; and every active conversational constraint. Corrections are cumulative.",
        },
      },
      required: ["request"],
      additionalProperties: false,
    },
  },
];
