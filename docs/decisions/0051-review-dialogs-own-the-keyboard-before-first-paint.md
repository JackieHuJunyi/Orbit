# ADR 0051: Review dialogs own the keyboard before first paint

## Status

Accepted for Rune v1.35.

## Context

`ReviewDialog` mounted a visible modal and then used a passive effect to move focus, lock body scrolling, install the Tab trap, and register Escape. A fast user—or a CI worker—could observe the committed dialog and press Escape before that effect ran. Focus and the key event remained on the background New trigger, so the modal did not close. A retry passed because timing changed; the retry was evidence of a real first-frame race, not a reason to add a wait.

## Decision

The shared dialog lifecycle runs in `useLayoutEffect`. React first commits the modal DOM; the layout effect then records previous focus and body overflow, locks scrolling, focuses the declared initial control or first enabled control, and registers the document key handler before the browser paints that committed modal. Tab wrapping and Escape stay in the same listener and cancellation callback reference.

Cleanup removes that exact listener, restores the previous body overflow, and returns focus to the previously active element. Business dialogs keep only their existing `onCancel` policy; they do not add local keyboard listeners or a second modal state.

The New browser test performs three consecutive immediate open/Escape/close cycles without an artificial delay. A release stress check repeats the test ten times, covering thirty transitions.

## Consequences

- A visible shared review dialog already owns focus and Escape.
- New, import, export, task, image, and structural review surfaces inherit one deterministic keyboard lifecycle.
- Tests no longer normalize a lost first Escape by waiting or relying on a retry.
- Layout work remains bounded to one modal query and focus operation; no Artifact, provider, persistence, or source authority enters the dialog shell.
