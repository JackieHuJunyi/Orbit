import { appendCheckpoint, createCheckpoint, type CheckpointMap } from "./checkpoints";
import { prepareWorkspaceMutation, type ArtifactSourcePatch } from "./patches";
import type {
  DataCellPreviewSourceTarget,
  DocumentBlockPreviewSourceTarget,
  PreviewSourceTarget,
} from "./preview-targets";
import { prepareVisualDataCellEdit, type VisualDataCellEditInput } from "./visual-data-edit";
import { prepareVisualDocumentBlockEdit, type VisualDocumentBlockEditInput } from "./visual-document-block-edit";
import {
  prepareVisualSemanticHtmlSlideEdit,
  type VisualSemanticHtmlSlideEditInput,
} from "./visual-semantic-html-slide-edit";
import type { WorkspaceArtifact } from "./workspace";

type MutableRef<T> = { current: T };
type PreparedDirectCommit =
  | { error: string; nextArtifacts: null; nextCheckpoints: null }
  | { error: null; nextArtifacts: WorkspaceArtifact[]; nextCheckpoints: CheckpointMap };
type CompiledDirectEdit = { errors: string[]; nextSource: string; nextTarget: PreviewSourceTarget | null };

function prepareDirectCommit(input: {
  artifacts: WorkspaceArtifact[];
  checkpoints: CheckpointMap;
  requestedArtifact: WorkspaceArtifact;
  targetLabel: string;
  detail: string;
  compile: (artifact: WorkspaceArtifact) => CompiledDirectEdit;
}): PreparedDirectCommit {
  const currentArtifact = input.artifacts.find((artifact) => artifact.id === input.requestedArtifact.id);
  if (!currentArtifact || currentArtifact.source !== input.requestedArtifact.source) {
    return {
      error: "The source changed while this content was being edited. Try again from the current content.",
      nextArtifacts: null,
      nextCheckpoints: null,
    };
  }
  const compiled = input.compile(currentArtifact);
  if (compiled.errors.length || !compiled.nextTarget) {
    return {
      error: compiled.errors[0] ?? "Orbit could not apply this direct edit.",
      nextArtifacts: null,
      nextCheckpoints: null,
    };
  }
  const patch: ArtifactSourcePatch = {
    artifactId: currentArtifact.id,
    summary: `Edit ${input.targetLabel}`,
    detail: input.detail,
    nextSource: compiled.nextSource,
    operationCount: 1,
  };
  const prepared = prepareWorkspaceMutation(input.artifacts, [patch], []);
  if (prepared.errors.length) {
    return { error: prepared.errors.slice(0, 3).join(" "), nextArtifacts: null, nextCheckpoints: null };
  }
  const checkpoint = createCheckpoint(currentArtifact, `Before direct edit · ${input.targetLabel}`, "manual");
  return {
    error: null,
    nextArtifacts: prepared.nextArtifacts,
    nextCheckpoints: appendCheckpoint(input.checkpoints, checkpoint),
  };
}

export function createDirectPreviewEditHandlers(
  canStartOperation: boolean,
  artifactsRef: MutableRef<WorkspaceArtifact[]>,
  checkpointsRef: MutableRef<CheckpointMap>,
  commit: (artifacts: WorkspaceArtifact[], checkpoints: CheckpointMap) => void,
) {
  const finish = (
    requestedArtifact: WorkspaceArtifact,
    targetLabel: string,
    detail: string,
    compile: (artifact: WorkspaceArtifact) => CompiledDirectEdit,
  ) => {
    if (!canStartOperation) return "Finish or cancel the current review before editing this content.";
    const prepared = prepareDirectCommit({
      artifacts: artifactsRef.current,
      checkpoints: checkpointsRef.current,
      requestedArtifact,
      targetLabel,
      detail,
      compile,
    });
    if (prepared.error !== null) return prepared.error;
    try {
      commit(prepared.nextArtifacts, prepared.nextCheckpoints);
    } catch {
      return "Device storage is full, so Orbit kept the source unchanged.";
    }
    return null;
  };

  return {
    onDirectEditDocumentBlock: (
      artifact: WorkspaceArtifact,
      target: DocumentBlockPreviewSourceTarget,
      edit: VisualDocumentBlockEditInput,
    ) =>
      finish(artifact, target.label, `Type directly in one Markdown ${target.blockType} block.`, (current) =>
        prepareVisualDocumentBlockEdit(current, target, edit),
      ),
    onDirectEditDataCell: (
      artifact: WorkspaceArtifact,
      target: DataCellPreviewSourceTarget,
      edit: VisualDataCellEditInput,
    ) =>
      finish(artifact, target.label, "Type directly in one Data cell.", (current) =>
        prepareVisualDataCellEdit(current, target, edit),
      ),
    onDirectEditSemanticHtmlSlide: (
      artifact: WorkspaceArtifact,
      target: PreviewSourceTarget,
      edit: VisualSemanticHtmlSlideEditInput,
    ) =>
      finish(artifact, target.label, "Type directly in one semantic HTML slide.", (current) =>
        prepareVisualSemanticHtmlSlideEdit(current, target, edit),
      ),
  };
}
