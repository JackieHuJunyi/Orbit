# ADR 0006: Direct actions only open capabilities

- Status: accepted
- Date: 2026-08-14
- Scope: actionable freshness in the workspace file rail

## Context

Rune can derive that a linked presentation's Document source changed, but a passive label still makes the user rediscover the presentation task and verify its target. Turning the whole file row into refresh would remove ordinary open behavior. Letting a shortcut compile or write immediately would create a second mutation path outside review-before-write.

## Decision

A changed linked Deck has a separate keyboard-focusable refresh action beside its normal file-open button. The action accepts the clicked exact Deck id and, at activation time:

1. resolves that id from the current workspace ref;
2. parses its current exact Document origin;
3. re-derives its current freshness;
4. stops when the target is absent or no longer `changed`;
5. selects the target and opens the existing Document briefing task session.

The setup surface receives the exact Document and presentation ids, restores the recipe from current Deck source, and retains the standard Prepare review → candidate transaction → Apply path. The direct action cannot compile, mutate, checkpoint, or persist. It is disabled under the same busy and review states that disable other task creation.

The normal file row remains an Artifact navigation control. Refresh and context-pin controls are siblings rather than nested buttons. They use logical inline-end positioning and reserved padding so Arabic RTL mirrors the complete interaction instead of only its text.

## Rejected alternatives

**Make the changed label informational only.** Rejected because it reveals a task without providing the next safe step.

**Refresh immediately from the file row.** Rejected because freshness is advisory and never authorizes content replacement.

**Use the currently selected Artifact after setting selection.** Rejected because React selection updates are asynchronous and could open the wrong Deck.

**Add a selected-file action to the global top bar.** Rejected because the top bar is reserved for workspace-wide creation, import, export, and tools.

## Enforcement

- `tests/task-architecture.test.mjs` verifies exact-id/current-ref revalidation and forbids compiler, Artifact mutation, or persistence calls in the shortcut.
- `tests/rendered-html.test.mjs` verifies separate accessible control wiring, shared disabled state, compact geometry, and logical RTL positioning.
- `tests/document-briefing.test.mjs` continues to prove that changed targets only become current through the reviewed compiler transaction.
