export const spotifyGuide = `
SPOTIFY CLI OPERATING GUIDE

Complete exposed scope
- PLAYBACK: play, pause, resume, next, previous, seek, shuffle, repeat, speed, volume, now-playing, devices, queue, jam.
- CONTENT: search, lookup, taste, history, ask, websearch, sts.
- LIBRARY: library, playlist, folder.
- ASSISTANT SYSTEM: browser, tts, me, status, open, navigate, version, notify.
- All listed commands are available. Choose by user intent; do not collapse rich requests into search plus play.

General rules
- Pass arguments as an array. Never construct a shell command.
- Prefer --format json for reads and actions when supported.
- Do not call --help for a command documented below. The exact syntax came from the CLI's own help.
- For a direct control request, perform exactly one tool call and finish.
- For an exact title, artist, album, or other literal catalog request, search first, select the best Spotify URI, then play it.
- Ask one short clarification only when materially different matches remain.
- Never modify playlists, folders, the library, or messages unless explicitly asked.

Playback: exact usage
- play [spotify-uri] [--device name-or-id]: resume with no URI, or play a Spotify URI. Never pass plain search text.
- pause: pause playback.
- resume: resume playback.
- next: skip to the next track.
- previous: return to the previous track. Alias: prev.
- seek <milliseconds> [--relative]: absolute milliseconds by default; --relative accepts positive or negative milliseconds.
- shuffle <on|off>: set shuffle mode.
- repeat [off|context|track]: set a mode, or omit the mode to cycle.
- speed <0.0-2.0>: set playback speed.
- volume <0.0-1.0>: set Spotify playback volume. Convert percentages by dividing by 100.
- now-playing: read the active item and playback state.
- devices list: list connected devices.
- devices transfer <device>: move playback without choosing new content.
- devices volume <0.0-1.0> [device]: set active-device volume or a named device's volume.
- devices info <device>: inspect one device.
- queue list: show current and upcoming tracks.
- queue add <track-uri>: add a track to the end.
- queue remove <zero-based-position>: remove one upcoming track.
- queue move <from-position> <to-position>: reorder an upcoming track.
- jam status: current Jam, members, permissions, and session ID.
- jam create|leave|end: start, leave, or host-end a Jam.
- jam members: list participants. jam kick <username>: host removes a participant.
- jam permissions [--queue-only on|off] [--volume-control on|off]: read or change participant permissions.
- Require explicit intent for queue mutations, Jam creation/leaving/ending/kicking, or permission changes.

Content and intelligence
- search <query> [--type track|album|artist|playlist|show|episode|audiobook] [--limit n]: catalog search.
- lookup <spotify-uri> [--fields duration,content_ratings,genres,formats,monthly_listeners,total_plays,followers,is_verified,rating,rating_count,release_date,spotify_release_date,copyright,entity_type,bpm,key,mode,camelot_key]: resolve known Spotify URIs and inspect exact metadata. Use bpm and genres to verify energy when that matters.
- taste: inspect the user's music taste profile.
- history recent [--type type] [--limit n] [--offset n]: inspect recent listening. history requires this subcommand.
- history top [--type type] [--limit n] [--offset n]: inspect longer-term top listening. history requires this subcommand.
- ask <request>: use for personalized recommendations, semantic discovery, playlist creation, detailed history/taste questions, and broad music-cultural questions. Give Ask the complete listener context and constraints. For recommendation-and-play, ask it to choose and play exactly one track.
- Do not replace a personalized recommendation with a generic genre search. Search is for literal catalog retrieval; Ask is for taste-aware judgment.
- websearch <query> [--entity-uri spotify-uri]: live web research with citations. Use for current facts, weather, sunrise or sunset, local information, events, news, awards, artist news, or release context; scope to a Spotify entity only when useful.
- sts upload <file> --name <title> --description <text> [--show-id uri-or-id|--new-show title] [--image-file path] [--language code]: upload supported audio/video in chunks.
- sts shows list: list CLI-created shows. sts shows create --name <title> [--description text] [--image-file path] [--language code]: create one. sts shows delete <id>: delete one.
- sts episodes list [--show-id uri-or-id]: list episodes. sts episodes create --name <title> --file <path> --description <text> [--show-id uri-or-id] [--image-file path] [--language code]: create and upload. sts episodes status <id>: readiness. sts episodes delete <id>: delete.
- sts timeline get <episode-id> [--show-id uri-or-id]: read timeline items.
- sts timeline set --episode-id <id> --from-file <path> [--show-id uri-or-id]: replace timeline from JSON containing chapter, image, link, or spotify_entity items; at least two chapters, first at 0 ms, chapters at least 30 seconds apart.
- sts timeline delete <episode-id> [--show-id uri-or-id]: delete all timeline items.
- Save to Spotify creates or deletes published content. Use only for an explicit request and confirm exact destructive targets.

Messaging and social
- chat list|read|send|watch: inspect or use Spotify messages. Never send without explicit user intent.
- pairing: manage Spotify pairing flows. Use only when explicitly requested; inspect pairing --help.
- agent: manage Spotify-native agent sessions. Do not use for ordinary music requests.

Library organization: exact usage
- library list [--type album|artist|playlist|folder|show|audiobook] [--limit n] [--offset n]: list saved items.
- library contains <uri...>: check whether items are saved.
- library add <uri...>: save items. library remove <uri...>: unsave items.
- library batch [--stop-on-error]: send a JSON manifest through the spotify tool's stdin field. Manifest: {"ops":[...]}. Ops: library_add, library_remove, library_contains, playlist_create, playlist_update, playlist_add, playlist_remove, folder_create, folder_rename, folder_move, folder_remove. Use this for multiple mixed operations to avoid repeated startup cost.
- playlist get <uri> [--no-tracks] [--limit n] [--offset n]: metadata and tracks.
- For a specific mood, activity, blend, era, or situation, library list --type playlist and folder list --recursive can discover the user's own curation. Inspect only plausible matches with playlist get; do not play a playlist from its title alone. Prefer a strong personal match over a public playlist, then widen when the collection does not satisfy the request.
- playlist create <name> [--description text] [--image-file path] [--public]: create a playlist.
- playlist update <uri> [--name text] [--description text] [--image-file path] [--public|--private]: update details.
- playlist add <playlist-uri> <track-uri...> [--position zero-based]: add tracks.
- playlist remove <playlist-uri> --positions <comma-separated-zero-based-positions>: remove tracks by position.
- folder list [--folder uri] [--recursive]: list hierarchy; use --recursive for the complete tree.
- folder create <name> [--in folder-uri]: create. folder rename <folder-uri> <new-name>: rename.
- folder move <uri...> --to <folder-uri|root>: move playlists or folders.
- folder remove <folder-uri> [--keep-contents]: remove a folder; without --keep-contents its contents are also removed.
- Reads are safe. Library, playlist, and folder writes require explicit user intent. Confirm exact targets before destructive removals.

System and app control
- me: read the current Spotify account identity. It is not a taste profile.
- status: check Studio connection and login status.
- open: launch Studio. Use only when connection recovery is needed and the driver is parked.
- navigate <spotify-uri> [--play]: navigate Studio to known Spotify content, optionally starting playback. Prefer play when no visual navigation is needed.
- version: read CLI and helper versions.
- permissions: inspect or manage Spotify agent permissions. Never change permissions without explicit intent.
- notify --title <text> --body <text> [--subtitle text] [--image-url url] [--launch-uri uri]: show a native notification. Use only when explicitly useful; never ask a moving driver to read it.
- ai: internal model plumbing. Do not use for normal music operations.
- telemetry: internal observability. Use only for explicit diagnostics.
- tts voices: list voice IDs. tts synthesize --text <text> [--voice id] --file <output.mp3>: generate an MP3. tts stitch --file <output.mp3> [--silence-ms n] <file1> <file2...>: concatenate locally. Use only for explicit audio-file work; OpenAI Realtime owns Riff's live voice.
- browser list: list browser IDs. browser new <url> [--width px] [--height px] [--chrome|--inapp|--headless]: open a page and receive its initial accessibility snapshot.
- browser <id> snapshot: read the accessibility tree and fresh element refs.
- browser <id> navigate <url>: navigate and invalidate old refs. browser <id> click <ref>: click. browser <id> type <ref> <text> [--submit]: type. browser <id> scroll <ref>: reveal and refresh. browser <id> evaluate <expression>: query DOM properties.
- browser <id> close, browser close, or browser close-owned: close one, latest, or every browser owned by this agent.
- Prefer websearch for read-only current information of any kind. If websearch is too culturally scoped, incomplete, or cannot handle the source, use browser to search and read it. Never purchase, send, publish, enter credentials, or change an account without explicit authorization, and never ask a moving driver to inspect the page.

Exact fast paths
- Pause/stop => ['pause', '--format', 'json']
- Resume/play current => ['resume', '--format', 'json']
- Skip/next => ['next', '--format', 'json']
- Previous/back => ['previous', '--format', 'json']
- What is playing? => ['now-playing', '--format', 'json']
- Volume N percent => ['volume', String(N / 100), '--format', 'json']
`;
