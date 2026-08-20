# ADR 0048: Agent review uses one candidate workspace surface

## Status

Accepted for Rune v1.32.

## Context

Rune already prepared an Agent proposal atomically and could preview any artifact from the resulting candidate workspace. The Workbench still derived the candidate artifact, candidate artifact array, review flags, and canonical fallbacks independently. Those expressions were equivalent, but no single boundary guaranteed that Source and Preview received the same candidate snapshot, and no browser test exercised the real Agent through review, discard, apply, and reload.

## Decision

`prepareWorkspaceProposalSurface` is the sole React-free adapter between an optional pending Agent mutation and the two-pane review UI. It delegates mutation and revision proof to `prepareWorkspaceProposalPreview`, then returns the proposal result, selected candidate artifact, complete candidate workspace, and explicit review/candidate activity flags as one value.

When there is no proposal, both panes receive the canonical selection and workspace. When a proposal is stale, invalid, or has no previewable artifact, review remains visibly active but both panes receive the unchanged canonical fallback. No partial candidate is exposed. The adapter has no React, DOM, provider, persistence, checkpoint, export, or mutation authority.

Real Chromium must drive the local Agent itself. A single-file flow proves complete proposed Source and output agree, Discard is byte-exact and zero-write, and Apply persists exactly the reviewed candidate after reload. A Workspace flow proves multiple patches remain one transaction, candidate files can be inspected independently, and an unapplied semantic-HTML slide addition never appears in canonical storage or after Discard.

## Consequences

- Source and Preview cannot drift because of separate Workbench fallback logic.
- Invalid review stays diagnosable without displaying a partially prepared workspace.
- Multi-file proposals remain inspectable while preserving one atomic Apply boundary.
- Browser evidence now covers the actual Agent UI rather than only pure projection helpers.
- This does not grant direct editing, persistence, export, or provider authority to proposal presentation state.
