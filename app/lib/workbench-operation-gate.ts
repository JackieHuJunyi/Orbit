export const WORKBENCH_OPERATION_OWNERS = [
  "welcome",
  "new-artifact",
  "operating-review",
  "document-briefing",
  "agent-proposal",
  "import-review",
  "pdf-ocr",
  "export-review",
  "pilot-evidence",
  "delivery-outcome",
  "checkpoint-restore",
  "workspace-reset",
  "directory-sync",
  "document-structure",
  "local-image",
  "visual-draft",
] as const;

export type WorkbenchOperationOwner = (typeof WORKBENCH_OPERATION_OWNERS)[number];

export const WORKBENCH_BUSY_OPERATIONS = [
  "agent-planning",
  "import-reading",
  "export-preparing",
  "operating-review-checking",
  "document-briefing-checking",
  "delivery-recording",
  "visual-edit-checking",
  "directory-syncing",
  "pdf-ocr-processing",
] as const;

export type WorkbenchBusyOperation = (typeof WORKBENCH_BUSY_OPERATIONS)[number];

export type WorkbenchOperationGateInput = Readonly<{
  hydrated: boolean;
  owners: Readonly<Record<WorkbenchOperationOwner, boolean>>;
  busy: Readonly<Record<WorkbenchBusyOperation, boolean>>;
}>;

export type WorkbenchOperationGate = Readonly<{
  hydrated: boolean;
  activeOwners: readonly WorkbenchOperationOwner[];
  activeBusyOperations: readonly WorkbenchBusyOperation[];
  owner: WorkbenchOperationOwner | null;
  hasOwnerConflict: boolean;
  canStartOperation: boolean;
  blocksGlobalShortcuts: boolean;
}>;

export function prepareWorkbenchOperationGate(input: WorkbenchOperationGateInput): WorkbenchOperationGate {
  const activeOwners = Object.freeze(WORKBENCH_OPERATION_OWNERS.filter((owner) => input.owners[owner] === true));
  const activeBusyOperations = Object.freeze(
    WORKBENCH_BUSY_OPERATIONS.filter((operation) => input.busy[operation] === true),
  );
  const hasOwnerConflict = activeOwners.length > 1;
  const canStartOperation = input.hydrated && activeOwners.length === 0 && activeBusyOperations.length === 0;

  return Object.freeze({
    hydrated: input.hydrated,
    activeOwners,
    activeBusyOperations,
    owner: activeOwners.length === 1 ? activeOwners[0] : null,
    hasOwnerConflict,
    canStartOperation,
    blocksGlobalShortcuts: !canStartOperation,
  });
}

export function workbenchOperationCanReplace(gate: WorkbenchOperationGate, owner: WorkbenchOperationOwner): boolean {
  return (
    gate.hydrated &&
    gate.activeOwners.length === 1 &&
    gate.activeOwners[0] === owner &&
    gate.activeBusyOperations.length === 0
  );
}
