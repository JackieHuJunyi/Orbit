# ADR 0024: Artifact kinds have one static adapter authority

## Status

Accepted — Rune v1.05.

## Context

Rune's architecture described an Artifact Adapter boundary, but the production facts for each kind were still spread across `workspace.ts`, `artifact-creation.ts`, and the preview component. File detection, starter source, filename extension, source language, validation, status statistics, Quick Actions, and preview dispatch each repeated their own `if` chain. Adding a sixth Artifact could therefore compile in one subsystem while remaining missing or misclassified in another.

DeepSeek Harness and Cordis both demonstrate the useful principle that a capability should have one declared owner and that missing providers should fail during composition. Rune does not need their dynamic package, profile, session, or service-container runtime for a closed first-party file vocabulary.

## Decision

Rune introduces a React-free `artifact-adapter-registry`. The registry receives the complete required kind list and one adapter per kind. It rejects missing, duplicate, unknown, non-finite, or malformed definitions, returns an immutable ordered snapshot, and provides exact kind lookup plus ordered file detection.

Each production adapter owns:

- creation label, primary format, canonical extension, and description;
- deterministic starter source and source language;
- format detection without `.deck.md`/`.chart.json` suffix ambiguity;
- source validation and compact status statistics;
- deterministic local Quick Action suggestions.

`artifact-creation` and `workspace` now consume that authority. The React preview layer remains a separate capability boundary and uses one exhaustive `Record<ArtifactKind, renderer>` so a new kind cannot silently fall through to the Slides renderer. React is deliberately not stored in the domain registry.

The Workbench still owns selection, persistence, history, imports/exports, provider access, reviews, checkpoints, and every workspace mutation. Adapters return source or derived display facts; they never write.

## Consequences

Adding a first-party Artifact kind now has one manifest-like definition and one compile-time preview renderer requirement. Shared metadata cannot drift between the New dialog, import detection, status bar, validation, and Quick Actions. Registry tests prove completeness, immutability, ordering, suffix precedence, and the absence of React, browser, persistence, network, or mutation capabilities.

This does not make Artifact kinds runtime plugins. Rune still does not load third-party code, replace adapters after startup, grant adapters service access, or use a global dependency container. Those costs require an explicit product and security decision.
