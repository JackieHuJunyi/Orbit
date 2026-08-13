# ADR 0016: Synthetic evals do not prove user outcomes

## Status

Accepted — Rune v0.97.

## Context

Rune has broad parser, compiler, mutation, and export tests, but no versioned task-level regression set. The product plan also requires at least twenty licensed or redacted real tasks and seven-dimensional human review before pilot. Treating generated fixtures as those real tasks would fabricate evidence; waiting for real tasks would leave deterministic workflow regressions without one release gate.

## Decision

Rune keeps two visibly separate evidence layers:

1. A twenty-case, explicitly synthetic E1 Golden Task Set covers Operating Review and Document-to-Presentation success and fail-closed paths. It uses frozen inputs, the public task-provider and transaction seams, ten real DuckDB-Wasm executions, live Chart/deliverable bindings, source-linked presentation metadata, collision handling, multilingual content, refresh identity, and zero-output rejection.
2. Licensed or redacted real tasks remain at 0/20 until authorized material and human reviewers exist. Each will be scored 1–5 for number correctness, evidence completeness, conclusion usefulness, structure clarity, visual deliverability, change comprehensibility, and overall time saved. Number correctness below 4 cannot be hidden by averaging.

The deterministic Markdown baseline is checked by `npm test`; the production client cannot import the eval runner. GitHub applies the same eval with build, tests, lint, typecheck, and production audit.

## Consequences

Task regressions now stop a release, while the report states exactly what it does not prove. A synthetic pass cannot increase the licensed-task count, human score, north-star deliverable count, retention evidence, or commercial validation.
