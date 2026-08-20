"use client";

import { useEffect } from "react";

export type VisualSourceDraft = {
  artifactId: string;
  sourceRevision: string;
  nextSource: string;
  start: number;
  end: number;
  errors: string[];
};

export type VisualSourceDraftHandler = (draft: VisualSourceDraft | null) => void;

/**
 * Publishes one controlled Preview edit as a complete, read-only Source draft.
 * `undefined` explicitly yields ownership to a mounted child editor; `null`
 * clears the draft. Unmounting always releases the shared mirror.
 */
export function useVisualSourceDraftMirror(
  draft: VisualSourceDraft | null | undefined,
  onDraftChange?: VisualSourceDraftHandler,
) {
  useEffect(() => {
    if (draft !== undefined) onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);
}
