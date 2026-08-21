# ADR 0065: Workbench operations have one owner

- Status: Accepted
- Date: 2026-08-21
- Release: Rune v1.49

## Context

Rune already reviewed imports, exports, Agent plans, visual edits, restore actions, local images, folder I/O, focused tasks, and delivery evidence before they could write. The Workbench nevertheless decided whether another action could begin by repeating long, slightly different lists of modal booleans and asynchronous states in buttons, menus, shortcuts, and handlers. Adding a reviewed surface therefore required editing many unrelated branches, and a missed branch could allow two operations to compete for workspace identity.

## Decision

`workbench-operation-gate.ts` is the React-free authority for operation exclusivity. It owns a complete typed registry of reviewed owners and asynchronous phases and compiles the current facts into an immutable result:

- a new operation may start only after hydration with no owner and no busy phase;
- more than one owner is an explicit fail-closed conflict;
- global shortcuts consume the same blocked result;
- only the exact current owner may perform an intentional handoff, and not while any asynchronous phase is active.

`RuneWorkbench` remains the composition boundary. It projects UI state into the registry, passes the shared availability result to buttons, menus, commands, and Agent controls, and rechecks the expected owner in confirmation handlers. The pure gate cannot open a dialog, mutate an Artifact, persist state, access a folder, download a file, call a model, or decide what the next owner should be.

Owner replacement is deliberately explicit at each workflow edge. Welcome may proceed into a task source picker; Export and folder Push may proceed into delivery confirmation; a reviewed Document structure change may proceed into visual verification; and a complete visual draft may proceed into its canonical commit. No generic owner replacement or queue is introduced.

## Consequences

- A new reviewed workflow extends one registry and one projection instead of copying lock lists across the interface.
- Controls and handlers cannot disagree about whether another operation may start.
- Conflicting owners and owner-plus-busy replacement fail closed.
- Cancellation remains local to the owning surface; Rune does not silently discard one review to begin another.
- Mutation, persistence, network, download, and filesystem authority remain with their existing capability owners.

## Verification

- Pure tests cover every registered owner and busy phase, hydration, conflicts, exact replacement, immutability, and complete Workbench binding.
- Architecture checks keep the gate free of React and browser capabilities.
- Chromium proves a global command shortcut cannot open a competing surface during a New review and works immediately after that owner closes.
- The normal typecheck, production build, render/architecture, full unit, and full browser gates remain required.
