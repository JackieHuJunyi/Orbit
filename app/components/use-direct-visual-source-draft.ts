"use client";

import { useCallback, useRef } from "react";
import { handleDirectVisualSourceDraft } from "../lib/direct-visual-source-draft";
import type { WorkspaceArtifact } from "../lib/workspace";
import type { VisualSourceDraft } from "./use-visual-source-draft";

type MutableRef<T> = { current: T };

export function useDirectVisualSourceDraft(
  artifactsRef: MutableRef<WorkspaceArtifact[]>,
  sourceEditorRef: MutableRef<HTMLTextAreaElement | null>,
) {
  const activeDraftRef = useRef<VisualSourceDraft | null>(null);
  const handleDirectVisualSourceDraftChange = useCallback(
    (draft: VisualSourceDraft | null) =>
      handleDirectVisualSourceDraft(draft, activeDraftRef, sourceEditorRef.current, artifactsRef.current),
    [artifactsRef, sourceEditorRef],
  );
  const consumeDirectVisualSourceDraft = useCallback(() => {
    const draft = activeDraftRef.current;
    if (!draft || draft.errors.length) return null;
    activeDraftRef.current = null;
    return draft;
  }, []);
  return { consumeDirectVisualSourceDraft, handleDirectVisualSourceDraftChange };
}
