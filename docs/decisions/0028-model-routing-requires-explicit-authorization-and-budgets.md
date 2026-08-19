# ADR 0028: Model routing requires explicit authorization and budgets

- Status: accepted
- Date: 2026-08-19
- Scope: Personal and deployment model transport

## Context

Rune already isolated OpenAI Responses, OpenAI-compatible Chat Completions, Anthropic Messages, and Gemini generateContent behind explicit adapters. A selected personal profile took precedence over the deployment model, but profiles did not declare their bounded capabilities or task budgets. Automatically trying another provider after failure would also send the user's content to a new data destination without a separate decision.

## Decision

Every connection carries a non-secret capability manifest and a per-task token budget. The manifest declares the exact protocol, structured-output mechanism, model-catalog support, provider-reported usage, and Rune's maximum accepted output ceiling. Personal profiles default to 50,000 input and 4,000 output tokens and may be configured only within 1,024–200,000 input and 256–8,000 output tokens. Deployment OpenAI uses the same defaults and may be bounded through `RUNE_MODEL_MAX_INPUT_TOKENS` and `RUNE_MODEL_MAX_OUTPUT_TOKENS`.

Before provider contact, Rune conservatively estimates UTF-8 input cost across instructions, bounded task content, schema identity and description, and the complete JSON Schema. An estimated overage fails with zero provider calls. Every adapter passes the configured output limit through its native protocol. Provider-reported input or output usage above the configured ceiling causes the result to fail validation.

Cross-provider failover is a vault preference that defaults to false. The interface exposes it only when at least two connections exist and explains that the same bounded content may reach another provider. When enabled, a selected personal profile routes first, followed by the other personal profiles in visible order and then deployment OpenAI; deployment selection routes to personal profiles only as fallbacks. Agent, Operating Review, and Document-to-Presentation share this router and repeat their existing structured-output validation inside each attempt.

The process records successful connections as healthy and failures as unhealthy. An unhealthy connection is avoided for sixty seconds only when another explicitly authorized candidate exists; it then returns to unknown. This registry is deliberately process-local and best-effort, not durable monitoring. Status APIs return only the bounded health fact and never credentials, request content, or provider error bodies.

Abort signals stop routing immediately and never authorize another provider. Routing changes transport selection only; it does not widen context, model operation capabilities, runtime validation, review, persistence, or workspace write authority.

## Consequences

- A failed provider cannot silently expand the destination of user content.
- Task cost has enforceable preflight and provider-reported ceilings across all supported protocols.
- Recently failing connections can be avoided without claiming a durable availability system.
- Invalid structured output may use an authorized fallback, but every candidate remains subject to the same local evidence and mutation contracts.
- Account-wide quotas, persistent usage/latency history, billing enforcement, and organization data policy remain future identity and commercial-system work.
