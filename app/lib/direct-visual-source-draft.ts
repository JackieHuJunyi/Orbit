import type { VisualSourceDraft } from "../components/use-visual-source-draft";
import type { WorkspaceArtifact } from "./workspace";

type MutableRef<T> = { current: T };

export function handleDirectVisualSourceDraft(
  draft: VisualSourceDraft | null,
  activeDraftRef: MutableRef<VisualSourceDraft | null>,
  sourceEditor: HTMLTextAreaElement | null,
  artifacts: WorkspaceArtifact[],
) {
  if (draft?.mode === "direct") {
    activeDraftRef.current = draft;
    if (sourceEditor && sourceEditor.value !== draft.nextSource) {
      const { scrollLeft, scrollTop } = sourceEditor;
      sourceEditor.value = draft.nextSource;
      sourceEditor.scrollLeft = scrollLeft;
      sourceEditor.scrollTop = scrollTop;
    }
    return true;
  }
  if (draft || !activeDraftRef.current) return false;
  const directDraft = activeDraftRef.current;
  activeDraftRef.current = null;
  const canonicalSource = artifacts.find((artifact) => artifact.id === directDraft.artifactId)?.source ?? "";
  if (sourceEditor && sourceEditor.value !== canonicalSource) sourceEditor.value = canonicalSource;
  return true;
}
