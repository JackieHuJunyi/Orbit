# ADR 0023: Interface contributions use small reversible surfaces

## Status

Accepted — Rune v1.04.

## Context

Rune had already separated Quick Actions metadata from execution and kept Source/Preview mounted across focus modes. The remaining UI composition still duplicated view controls in both pane headers, and the split gesture lived inside the Workbench with window-level listeners and unthrottled React updates. Adding more feature-owned chrome this way would continue growing the composition root and make ordering, collision handling, cleanup, and interaction behavior implicit.

DeepSeek Harness demonstrates typed slots, reversible registration, a layout-owned frame, retained subtrees, pointer capture, and paint-paced resizing. Its Cordis runtime also includes profiles, dynamic packages, session scopes, injected services, and hot lifecycle machinery that Rune does not currently need.

## Decision

Rune introduces a small React-free surface registry. Surface owners declare a stable id and `single` or ordered `list` cardinality. Contributions provide lowercase kebab-case identity, finite order, and an opaque value. Unknown surfaces, duplicate declarations or contributions, invalid order, and a second occupant of a single surface fail immediately. Registration returns an idempotent disposer; reads return deterministically ordered immutable snapshots.

Workspace view definitions and Quick Actions use this primitive first. The registry has no React, browser, provider, persistence, credential, or Artifact mutation capability. The Workbench remains the composition root and sole dispatcher of existing business actions.

The frame controls become one component boundary. Both pane headers render the same registry-backed view switch. The separator owns pointer capture, animation-frame coalescing, RTL pointer math, keyboard increments and reset, drag cleanup, and settle-only preference persistence. Source and Preview remain mounted; grid easing pauses only during an active gesture. Its visual affordance is a quiet hit strip whose capsule appears on hover, focus, or drag.

## Consequences

New discoverable interface contributions gain explicit ownership, order, collision behavior, and cleanup without a runtime plugin host. Repeated controls no longer drift across pane headers, and dragging cannot flood React or detach from the pointer because of layout easing. Tests can exercise registry lifecycle and pointer geometry without React or a browser.

Rune still does not accept third-party executable UI, load packages dynamically, scope contributions by session, or expose shell state through a service locator. Those capabilities require a separate threat model and demonstrated product need.
