# ADR 0072: Orbit is the public identity; Rune remains a compatibility namespace

- Status: accepted
- Date: 2026-09-02

## Context

The product is now named **Orbit · 引力**. The former name, Rune, appears in two fundamentally different roles:

1. public identity: interface copy, application titles, guides, generated-file authorship, package metadata, and current documentation;
2. durable protocol identity: existing localStorage keys, source asset references, connected-folder layout, desktop IPC channels, environment variables, theme ids, and exported implementation symbols.

Treating both roles as one search-and-replace would make the interface look renamed while silently abandoning saved onboarding, language, appearance, model preference, workspaces, image references, credentials, desktop bridge calls, and downstream imports.

## Decision

The canonical public lockup is **Orbit · 引力**. Use it at primary identity moments such as the welcome chrome, Workbench header, settings version, browser title, and current documentation heading. Use **Orbit** as the grammatical product name inside sentences and translated interface copy.

The following legacy namespaces remain unchanged until a separately versioned migration has a concrete consumer and rollback plan:

- `rune-*` browser persistence and DOM hydration attributes;
- `.rune-assets` directories and `rune-asset:sha256:` source references;
- `rune:*` Electron preload/IPC channels;
- `RUNE_*` server and desktop environment variables;
- existing `rune`, `rune-dark`, and related persisted theme identifiers;
- exported `Rune*` TypeScript/JavaScript symbols and established serialized schema names.

New user-visible copy must say Orbit. New internal code should use neutral domain names where practical; it must not duplicate storage or bridge contracts merely to look renamed. Any future protocol rename requires dual-read, canonical-write migration, explicit versioning, stale-client behavior, and recovery tests before the old identifier can be removed.

The package name is `orbit-office` to distinguish the code package from the broad product word. The repository may use `Orbit` within its owner namespace, with the local Git remote updated after the remote rename.

## Consequences

- Existing users keep their data and preferences without a one-time migration or reset.
- Generated DOCX, XLSX, PPTX, ODF, HTML, and PDF metadata now attributes Orbit.
- Source filenames and developer-facing implementation identifiers may still contain `rune`; this is intentional compatibility debt, not stale public branding.
- Historical release notes through v1.54 retain the Rune name because rewriting them would erase the actual release history.
- Release tests guard the public lockup and the continued presence of representative legacy contracts.
