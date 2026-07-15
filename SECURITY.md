# Security policy

## Reporting a problem

Do not open a public issue for a vulnerability or exposed credential. Use the
repository's private GitHub security advisory form. Include the affected file
or endpoint, impact, and a small reproduction when possible.

## Local secrets and data

Riff stores API keys in `.env`, Pi sessions and memory under `.data`, and local
Supermemory runtime files under `.supermemory`. These paths are ignored by Git.

The Tesla private key belongs in the macOS login Keychain. The repository should
contain only its public key, and `.data/tesla` is ignored by default. Remove the
enrolled key from the vehicle and rotate it if the private key or laptop account
is compromised.

Spotify, OpenAI, Vercel, and Tesla credentials should be scoped to the
smallest access the demo needs. Rotate any credential that appears in a commit,
terminal recording, trace, screenshot, or uploaded demo artifact.

## Supported versions

Security fixes are applied to the current `main` branch. This project does not
have numbered release support yet.
