# Orbit

Orbit is a source-native workspace where people and AI create documents, data, charts, and presentations together. Readable source stays authoritative while every preview, model proposal, and export remains reviewable.

## Latest release

- **Orbit v1.65** — Document text, CSV/JSON cells, and safe HTML slide text are directly editable in Preview; reasoning strength gains a progressively deeper Codex-style track, and reopening the macOS window is reliable. See [ADR 0084](docs/decisions/0084-preview-text-editing-is-direct-and-source-safe.md).
- **Windows compatibility update** — Windows gained cross-platform startup, local OCR and DuckDB support, proxy-aware Codex account connections, and legacy Word and PowerPoint conversion with safeguards for open documents; see the [Windows development notes](WINDOWS-CHECKPOINT.md).

## Recent releases

- **v1.64** — Signed-in Codex accounts expose their real model and reasoning catalog inside a calmer, animated ChatGPT-style Composer; see [ADR 0083](docs/decisions/0083-signed-in-model-catalogs-are-account-authoritative.md).
- **v1.63** — Chat became the persistent model entry point, desktop state gained a stable origin, and the continuous English “Hello” returned; see [ADR 0082](docs/decisions/0082-chat-is-the-persistent-model-entry-point.md).
- **v1.62** — One reviewed local workspace now covers thirty-six PDF organization, conversion, editing, security, and intelligence tools; see [ADR 0081](docs/decisions/0081-pdf-tools-share-one-reviewed-local-runtime.md).
- **v1.61** — Found-only discovery expanded to nineteen provider patterns while slow model and large-file work became visible and stoppable; see [ADR 0080](docs/decisions/0080-discovery-and-slow-work-remain-evidence-led.md).
- **v1.60** — Codex, Claude Code, and Gemini CLI account sessions joined API, CC Switch, and local-model connections; see [ADR 0079](docs/decisions/0079-official-clients-own-account-authentication.md).
- **v1.59** — The desktop runtime, profile, credential vault, persistence, and interface completed the move to one Orbit identity; see [ADR 0078](docs/decisions/0078-orbit-owns-one-runtime-identity.md).
- **v1.58** — The Agent gained bounded multi-turn conversation and the macOS build gained a verified packaging and release chain; see [ADR 0077](docs/decisions/0077-agent-conversation-and-macos-release-have-bounded-owners.md).
- **v1.57** — A unified material hierarchy and movable contextual Agent simplified every major workbench panel; see [ADR 0076](docs/decisions/0076-panels-use-one-contextual-material-hierarchy.md).
- **v1.56** — Orbit introduced its two-planet identity, end-to-end model readiness, and a free-text-first Agent Composer; see [ADR 0073](docs/decisions/0073-orbit-is-one-wordmark-with-one-two-planet-symbol.md), [ADR 0074](docs/decisions/0074-desktop-model-readiness-is-end-to-end.md), and [ADR 0075](docs/decisions/0075-agent-composition-is-free-text-first.md).
- **v1.55** — The public product became Orbit while legacy Rune storage and integration identifiers remained compatible; see [ADR 0072](docs/decisions/0072-orbit-is-public-identity-rune-remains-a-compatibility-namespace.md).

Earlier releases and their decision links are recorded in [CHANGELOG.md](CHANGELOG.md).

## What Orbit does

- Keeps Markdown, CSV/JSON, DuckDB SQL, Chart JSON, and semantic HTML readable and live.
- Synchronizes Source and Preview in both directions down to proven blocks, rows, cells, marks, and slides.
- Lets AI answer or propose bounded changes without writing until the user reviews and applies them.
- Connects signed-in model accounts, API keys, CC Switch profiles, Ollama, LM Studio, and manual providers.
- Imports and exports modern Office, OpenDocument, PDF, HTML, and canonical source formats locally.
- Runs nine interface languages, device-local workspaces, checkpoints, and reviewed folder synchronization.

The exact shipped contract and remaining real-user evidence gates are separated in the [first-release handoff](docs/FIRST-RELEASE-HANDOFF.md).

## Documentation

- [Product plan](Orbit产品设计与行动规划.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decision records](docs/decisions/)
- [Delivery readiness](docs/DELIVERY-READINESS.md)
- [macOS release guide](docs/MACOS-RELEASE.md)
- [Progress](PROGRESS.md)
- [Detailed changelog](CHANGELOG.md)

## Development

Orbit requires Node.js 22.13 or newer.

```bash
npm install
npm run desktop:dev
```

For browser development, use `npm run dev` and open the printed local URL. The desktop command builds and starts the native Electron shell.

## Verification

```bash
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run audit:production
```

Release and QA commands are documented in the [macOS release guide](docs/MACOS-RELEASE.md).
