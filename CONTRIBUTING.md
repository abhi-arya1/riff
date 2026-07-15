# Contributing

Riff is a local demo built around Bun, OpenAI Realtime, Pi, the Spotify Labs
CLI, and optional Tesla BLE control. Discuss large changes in an issue before
writing them. Small fixes can go straight to a pull request.

## Local setup

Follow the setup section in [README.md](README.md). Keep credentials and runtime
data out of Git. Use `.env.example` when adding a new configuration value.

## Checks

Run both checks before opening a pull request:

```bash
bun test
bun run typecheck
```

Add a focused test when behavior changes. Hardware-dependent Tesla tests must
have a mock path and must not send commands during the test suite.

## Pull requests

Keep each pull request focused. Describe the behavior that changed, the checks
you ran, and any hardware or third-party account needed to verify it. Do not
include API keys, VINs, private keys, memory data, session logs, or transcripts.

Vehicle controls must stay on a fixed allowlist. New controls need a clear
driving-safety case and tests that reject unsupported arguments and retries.
