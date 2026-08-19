# ADR 0031: Area charts reuse ordered provenance

- Status: accepted
- Date: 2026-08-19
- Scope: Strict Chart source, preview, and export

## Context

Rune's Chart v1 contract already proves one category field, one finite value field, an explicit order, and exact category/value provenance for bar and line marks. A useful first expansion is an area view for magnitude or volume sequences. Adding a generic chart library or multi-series object would widen source, security, accessibility, and export contracts before a real task defines them.

## Decision

`area` joins `bar` and `line` as the only accepted Chart v1 marks. It shares line's ordered point geometry, finite-value range normalization, one-to-twenty visible marks, exact source-cell provenance, Query snapshot requirements, runtime-impact validation, and revision-bound visual edit. New and Workspace Agent creation may choose it; the Agent instruction reserves it for meaningful magnitude or volume sequences. Operating Review retains its narrower bar/line choice.

React and scriptless static HTML fill the polygon between the proven point sequence and the plot baseline, then render the existing line, points, labels, and source actions. PPTX uses a bounded custom vector path beneath editable point labels; fixed PDF uses the same polygon path. DOCX and ODT preserve area data as semantic trend tables so text, direction, and values remain selectable and importable. None of these snapshots retain a live binding.

Scatter, multi-series, stacked, dual-axis, arbitrary SVG, and executable chart specifications remain invalid. They require a new typed source and accessibility contract rather than another renderer branch.

## Consequences

- Users gain one richer sequence view without migrating existing Chart JSON or changing its upstream dependency model.
- An area point has the same exact category/value source target as the equivalent line point; the fill has no selection or write authority.
- Every existing export path represents area deterministically, and unsupported chart forms still fail closed.
- Future series or layout work must define field identity, scale, legend, provenance, and handoff behavior before code is added.
