# Riff

Riff is a local voice companion for Spotify and the car. It listens through a
browser, responds with OpenAI Realtime, remembers explicit preferences, and
hands longer work to a persistent Pi agent.

Riff is an early demo. It runs on your laptop and expects you to bring the
accounts, API keys, and command-line tools it uses.

## What it does

- Talks through a small WebRTC interface with interruption and echo cancellation.
- Sends pause, resume, skip, now-playing, and exact Spotify volume commands
  through a short path that does not start Pi.
- Uses Pi for recommendations, playlist work, listening history, current web
  research, and other tasks that need more than one step.
- Gives Pi access to the Spotify CLI's playback, content, library, and selected
  system commands.
- Stores explicit preferences and named listening rituals in a local
  Supermemory instance.
- Optionally controls a small set of Tesla media and cabin functions over BLE.

Riff does not control Tesla locks, doors, trunk, driving, charging, navigation,
keys, or security settings.

## Required software

Riff currently targets macOS. You need:

- [Bun](https://bun.sh/)
- A Pi-compatible coding agent CLI available as `pi`, or a path set in `PI_PATH`
- Studio by Spotify Labs, open and signed in
- The `spotify_cli` bundled inside the Studio application
- An OpenAI API key for Realtime
- A Vercel AI Gateway key for the default Pi model and local memory

This repository does not include Studio by Spotify Labs or `spotify_cli`. A
working installation is required. The default path is:

```text
/Applications/Studio by Spotify Labs.app/Contents/MacOS/spotify_cli
```

## Setup

Install the JavaScript dependencies and create a local environment file:

```bash
bun install
cp .env.example .env
```

Set these values in `.env`:

```dotenv
PI_OPENAI_API_KEY=your_openai_key
PI_AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
PI_MODEL=vercel-ai-gateway/google/gemini-3.1-flash-lite
SPOTIFY_CLI_PATH="/Applications/Studio by Spotify Labs.app/Contents/MacOS/spotify_cli"
```

The project Pi configuration declares
[`@ramarivera/pi-supermemory`](https://github.com/danenright/pi-supermemory).
If your Pi installation does not resolve packages from `.pi/settings.json`,
install it manually:

```bash
pi install npm:@ramarivera/pi-supermemory
```

Keep `.env`, `.data`, and `.supermemory` local. They contain credentials,
memory data, session files, or generated runtime state.

## Run the voice app

Keep Studio by Spotify Labs open, then run:

```bash
bun run voice
```

Open [http://localhost:3000](http://localhost:3000), press **Start Riff**, and
allow microphone access. Headphones give the browser the cleanest interruption
behavior. Laptop speakers also work when the output volume is moderate.

The page shows the current track, playback state, transcript, and a short log of
tool activity. The browser owns microphone capture, audio playback, and
barge-in. The Bun server keeps API keys private and runs the local tools.

## How requests are routed

```text
browser microphone
        |
OpenAI Realtime
        |
        +-- direct Spotify playback
        +-- direct Tesla media and comfort
        +-- local memory
        +-- persistent Pi agent
                 |
                 +-- Spotify CLI
                 +-- live web research and browser
                 +-- isolated scratch shell
```

Realtime handles conversation and short actions. Pi handles current research,
recommendations, taste and history analysis, playlist or queue work, and other
requests that need planning. Pi receives fixed tools instead of unrestricted
filesystem, network, or shell access.

Riff keeps one Pi session for each active browser session. A new voice turn can
cancel the current response and pending tool work. Tesla commands are sent at
most once because retrying an ambiguous media or comfort command can apply it
twice.

## Local memory

The voice server starts a local Supermemory process when a Gateway key is
available. Its data is stored in `.data/supermemory`.

Riff saves direct requests to remember, stable preferences, corrections, and
named rituals. It rejects secrets, precise locations, routine playback actions,
and raw conversation transcripts.

You can run the memory process in its own terminal:

```bash
bun run memory
```

## Tesla BLE

Tesla support is optional. Start with mock mode while parked:

```dotenv
TESLA_ENABLED=false
TESLA_MOCK=true
```

```bash
bun run voice
```

Riff's real BLE controls are limited to media transport, media volume, climate,
cabin temperature, front-seat heat, and steering-wheel heat. Pairing requires
Tesla's `tesla-control` and `tesla-keygen` binaries from the
[`vehicle-command`](https://github.com/teslamotors/vehicle-command) project.

Generate a key on macOS:

```bash
mkdir -p .data/tesla
.data/bin/tesla-keygen -key-name riff -keyring-type keychain \
  -output .data/tesla/public-key.pem create
```

Set `TESLA_VIN` locally, then enroll the public key while parked with a physical
key card:

```bash
.data/bin/tesla-control -vin "$TESLA_VIN" -ble \
  add-key-request .data/tesla/public-key.pem owner cloud_key
```

Tap the key card on the center console and approve the key on the touchscreen.
Verify the connection with a read-only request:

```bash
TESLA_KEY_NAME=riff TESLA_CACHE_FILE=.data/tesla-cache.json \
  .data/bin/tesla-control -vin "$TESLA_VIN" -ble state climate
```

Enable the real path only after that command succeeds:

```dotenv
TESLA_ENABLED=true
TESLA_MOCK=false
TESLA_VIN=your_vin
TESLA_KEY_NAME=riff
TESLA_CACHE_FILE=.data/tesla-cache.json
```

Pairing, terminal work, permission changes, and troubleshooting must be done
while parked. Once moving, use Riff hands-free.

## Developer commands

```bash
bun run dev          # restart the server when files change
bun run agent        # one Pi request
bun run agent:trace  # one Pi request with tool activity
bun run riff         # persistent typed development harness
bun run riff:trace   # persistent harness with tool activity
bun test
bun run typecheck
```

## Project status

The Spotify CLI dependency limits who can run the project today. Tesla support
has been tested with local BLE pairing on a supported vehicle. APIs, model IDs,
and third-party command syntax can change.

Riff is not affiliated with or endorsed by Spotify, Tesla, OpenAI, Vercel, Pi,
or Supermemory. Product names belong to their respective owners.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report
security problems through the process in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
