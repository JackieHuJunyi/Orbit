# ADR 0013: Task results use a shared device evidence ledger

- Status: accepted
- Date: 2026-08-14

## Context

Operating Review already retained bounded technical runs and post-handoff usability judgments inside its saved workflow. Document to Presentation had the same real product questions—did Apply succeed, how long did the task take, which provider and tokens were used, and did the exported Deck become usable—but no corresponding evidence. Copying the operating-review storage shape into every task would couple product measurement to task recipes, duplicate normalization and privacy rules, and make a third task more expensive to add.

A technical Apply is also not a verified deliverable. A delivery judgment must refer to the exact task input and output revisions that were applied; an unchanged Artifact id is insufficient because either source may have changed later.

## Decision

Rune adds one versioned, device-local `RuneTaskEvidence` ledger for task-independent execution facts. A run contains only a registered task id, applied/stopped status, bounded stop reason, actual planner provider, exact source and output Artifact ids, portable source revision tokens, changed-file/runtime-impact counts, duration, and provider-reported token usage. The ledger retains at most 24 newest runs.

Document-to-Presentation creation and in-place refresh write this record in the same persistence transaction as a successful Apply. Review cancellation, stale revision, validation failure, or persistence failure may append a stopped record, but evidence failure never gains write authority or weakens the zero-source-write guarantee.

After an exact Deck output is downloaded or pushed to a folder, Rune may ask for a usability judgment. It is accepted only when the current task source and output still match the applied run's recorded portable revisions. The outcome then records the applied run id, task id, exact output id, handoff method/format, rating, elapsed time, and an output SHA-256 fingerprint. It retains at most 24 newest outcomes, and reconfirming one run/output replaces the earlier judgment.

The ledger never stores canonical source, filenames as measurement fields, prompts, Query rows, model responses, credentials, user identity, or background telemetry. Source-owned task recipes remain in readable Artifacts; operational evidence belongs to the device ledger.

Operating Review keeps its existing saved-workflow evidence schema for backward compatibility in this milestone, but the delivery dialog now consumes the task-neutral rating contract. A later migration may move legacy records into the shared ledger only with an explicit, tested storage-version transition; Rune will not maintain two authoritative copies of the same run.

## Consequences

- A new task can reuse one normalization, privacy, timing, delivery, and summary boundary instead of inventing task-specific telemetry.
- Document-to-Presentation now exposes recent task history and verified-delivery feedback without adding hidden task recipe state.
- Changed source or output revisions fail closed before delivery confirmation, preventing a later manual edit from being credited to an older Apply.
- Device evidence can guide product validation, but it does not prove demand, retention, business correctness, or payment.
- The ledger is deliberately static and local. It is not a session bus, analytics SDK, cloud event stream, or dynamic plugin host.
