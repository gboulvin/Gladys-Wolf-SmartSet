# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

The **Wolf SmartSet** external integration of Gladys Assistant: a Node.js
service (Node 22+, ESM, no build step) that runs in its own sandboxed Docker
container, talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
(its only runtime dependency) and to the Wolf SmartSet cloud
(`www.wolf-smartset.com`) with the built-in `fetch`. It started from the
official JavaScript template.

## Commands

```bash
npm install
npm test                                  # node --test "test/**/*.test.js"
node --test test/devices.test.js          # one file
node --test --test-name-pattern "mode"    # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                 SDK client + createApp() + connect(), nothing else
src/app.js               every SDK handler, registered before connect()
src/devices/index.js     WolfHub: systems in memory, discovery payload, polling,
                         writes, transports, scene triggers (publishSceneEvent)
src/devices/features.js  Wolf parameter -> Gladys feature, raw value -> state
src/wolf/auth.js         OpenID Connect + PKCE sign-in (login form, redirects)
src/wolf/client.js       portal client: token, browser session, retry on 401/500
src/wolf/parameters.js   GetGuiDescriptionForGateway parsing, name translation
src/actions.js           manifest `actions` (Configuration screen buttons)
src/scenes.js            manifest `scene_actions`
src/widgets.js           manifest `widgets`
src/i18n.js              user messages, en / fr / de / es
src/config.js            DEFAULT_CONFIG (mirrors the manifest defaults)
docs/{en,fr,de,es}.md    user documentation, re-hosted by Gladys (mandatory)
test/helpers/fakeWolf.js in-memory Wolf portal used as `fetchImpl`
```

## Rules

- **External ids are forever.** The device id is
  `gladys.externalIds('system', <Wolf system Id>)`, the feature id its
  `feature(<parameter ValueId>)`. Never build one from a name: names follow the
  language of the configuration. The same goes for every key users store:
  manifest `config_schema`, `actions`, widget and scene keys, trigger variable
  and action output keys.
- **Every feature carries `name`, `min`, `max`, `read_only` and
  `has_feedback`**, even where they mean nothing (`0`/`0` for text and select
  features): Gladys stores them NOT NULL. `test/devices.test.js` checks them,
  expert mode included.
- **The Wolf API is unofficial.** Keep its quirks documented where they are
  handled (`src/wolf/`), mirror `wolf_comm` (the Home Assistant library) when
  in doubt, and never call it from the tests: extend `test/helpers/fakeWolf.js`.
- **Secrets.** Never log the password, the access token or a whole request or
  error object of the sign-in. The container rootfs is read-only: write only
  under `/data` (nothing needs it today).
- **No scene loops.** A write made by the integration updates the known value
  first, so the next read never fires `mode_changed` for it. Scene events fire
  on transitions only, never on the first read.
- **Rate.** The Wolf cloud is slow and rate-limited: one read per system per
  `poll_frequency` (60 s minimum), values published with
  `publishChangedStates` (heartbeat 30 min).
- **Languages.** Every user-facing text exists in **en, fr, de and es**:
  manifest texts, `src/i18n.js` messages, widget labels and `docs/*.md`.
  `test/i18n.test.js` enforces it for the manifest and the messages.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Manifest.** Texts are multi-language objects, never plain strings. The
  catalog `description` holds 10 to 100 characters per language.
  `scene_triggers`, `scene_actions` and `widgets` require
  `gladys_version >=5.1.0`. `transports` is `["cloud"]`: Wolf SmartSet has no
  local API. `test/manifest.test.js` ties the manifest to the code: change
  both sides together.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
