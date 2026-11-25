# Wolf SmartSet for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
monitors and controls **Wolf** heating systems (condensing boilers, heat pumps,
ventilation, solar...) through the **Wolf SmartSet** cloud — the same service
as the Wolf SmartSet app and portal, and as the Home Assistant
[`wolflink`](https://www.home-assistant.io/integrations/wolflink/) integration.

Built with the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
from the official
[integration template](https://github.com/GladysAssistant/integration-template-js).

- **Transport:** cloud (`"transports": ["cloud"]`): the device badge shows
  `cloud` while the Wolf gateway is online, `unreachable` when it is not.
- **Languages:** English, French, German and Spanish (manifest, messages,
  widget, documentation; the parameter names are translated by Wolf SmartSet).
- **Requires** Gladys **5.1.0** or later (scene triggers, scene actions and
  dashboard widgets).

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Features

| Surface                   | What it does                                                                                                                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Devices**               | One device per Wolf system, one feature per parameter: temperature probes, pressure, power, energy, operating hours, percentages, texts. Writable temperatures become **thermostat setpoints**, lists of choices become **choice lists** (operating modes, programs), both controllable from Gladys. |
| **Scene triggers**        | `gateway_status_changed` (the gateway went online / offline), `mode_changed` (a list parameter — mode, program, burner state — took a new value).                                                                                                                                                    |
| **Scene actions**         | `refresh_system` (read now), `set_parameter` (write any writable parameter, by name or id), `read_parameter` (read one value into scene variables).                                                                                                                                                  |
| **Dashboard widget**      | `wolf_system`: live temperatures and pressure, gateway connection, last read, current modes, **Refresh** button.                                                                                                                                                                                     |
| **Configuration actions** | `test_connection` (sign in, count the systems), `list_parameters` (writable parameters of a system, with their ids).                                                                                                                                                                                 |

## How it talks to Wolf SmartSet

Wolf publishes no public API. Like `wolf_comm` (the library behind the Home
Assistant integration), the integration:

1. signs in to the Wolf identity server with an OpenID Connect authorization
   code flow with PKCE, posting the login form like the portal does
   ([`src/wolf/auth.js`](src/wolf/auth.js));
2. opens a portal "browser session" and keeps it alive
   ([`src/wolf/client.js`](src/wolf/client.js));
3. reads the systems (`GetSystemList`), the gateway state
   (`GetSystemStateList`), the parameter tree (`GetGuiDescriptionForGateway`,
   parsed in [`src/wolf/parameters.js`](src/wolf/parameters.js)), the values
   (`GetParameterValues`, one request per bundle) and writes with
   `WriteParameterValues`.

The parameter names are translated with the portal's own texts
(`text.culture.<lang>.js`), in the language chosen in the configuration.

## Project structure

```
.
├─ index.js                          # SDK bootstrap: createApp() + connect()
├─ src/
│  ├─ app.js                         # every SDK handler, registered before connect()
│  ├─ config.js                      # config defaults + normalization
│  ├─ i18n.js                        # messages in en / fr / de / es
│  ├─ status.js                      # error -> connection status message
│  ├─ actions.js                     # Configuration screen buttons
│  ├─ scenes.js                      # scene actions
│  ├─ widgets.js                     # dashboard widget
│  ├─ devices/
│  │  ├─ index.js                    # WolfHub: systems, polling, writes, scene triggers
│  │  └─ features.js                 # Wolf parameter -> Gladys feature / state
│  └─ wolf/
│     ├─ auth.js                     # OpenID Connect + PKCE sign-in
│     ├─ client.js                   # portal client (session, retries)
│     ├─ parameters.js               # GUI description parsing, name translation
│     └─ constants.js                # endpoints, units
├─ docs/{en,fr,de,es}.md             # user documentation (re-hosted by Gladys)
├─ test/                             # node --test, fake Gladys + fake Wolf portal
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
├─ CHANGELOG.md · CLAUDE.md · SECURITY.md
└─ .github/                          # CI, release, build, Dependabot
```

## Development

```bash
npm install
npm test               # node --test, never touches the network
npm run lint           # ESLint
npm run format:check   # Prettier
```

The tests run the integration against the SDK's fake Gladys
(`@gladysassistant/integration-sdk/testing`) and an in-memory fake of the Wolf
portal ([`test/helpers/fakeWolf.js`](test/helpers/fakeWolf.js)), from the
sign-in to the scene events.

Run it against a real Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="wolf-smartset" \
LOG_LEVEL=debug \
npm start
```

Check the store rules locally (once a version is released, the validator also
checks that the Docker image exists):

```bash
npx github:GladysAssistant/integration-store .
```

## Release

Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md),
then run **Actions → Release → Run workflow** (patch, minor or major). The
workflow bumps `package.json` and the manifest, rolls the changelog, tags,
builds the `linux/amd64` + `linux/arm64` image to
`ghcr.io/gboulvin/gladys-wolf-smartset` and publishes the GitHub Release.

The image must be **public** on ghcr.io for Gladys to pull it (package settings
→ visibility), and the repository needs the `gladys-assistant-integration`
topic to be indexed by the store.

## Disclaimer

Not affiliated with WOLF GmbH. "Wolf" and "Wolf SmartSet" are trademarks of
their owner. The Wolf SmartSet web services are not a public API and may
change without notice.

## License

Apache-2.0
