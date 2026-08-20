"use client";

import { useEffect, useRef, type RefObject } from "react";
import { selectPreviewNavigationCandidate } from "../lib/source-navigation";

export type SourcePreviewScrollTarget = Readonly<{
  id: string;
  kind: string;
}>;

/**
 * Keeps a canonical Source caret linked to an already-rendered Preview node.
 * The first move into a target centers it. Further caret moves inside the same
 * target use `nearest`, so manually scrolling the Preview away is recoverable
 * without repeatedly re-centering while the user types or uses arrow keys.
 */
export function useSourcePreviewScroll({
  artifactId,
  cursorEnd,
  cursorStart,
  enabled,
  previewScrollRef,
  target,
}: Readonly<{
  artifactId: string;
  cursorEnd?: number;
  cursorStart?: number;
  enabled: boolean;
  previewScrollRef: RefObject<HTMLDivElement | null>;
  target: SourcePreviewScrollTarget | null;
}>) {
  const lastTargetKeyRef = useRef("");

  useEffect(() => {
    if (!enabled || !target) {
      lastTargetKeyRef.current = "";
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const linkedElements = [
        ...(previewScrollRef.current?.querySelectorAll<HTMLElement>(
          "[data-preview-source-id], [data-preview-section-id]",
        ) ?? []),
      ];
      const linkedIndex = selectPreviewNavigationCandidate(
        target,
        linkedElements.map((element) => ({
          sourceId: element.dataset.previewSourceId,
          sectionId: element.dataset.previewSectionId,
          primary: element.dataset.previewSourcePrimary === "true",
        })),
      );
      const linkedElement = linkedElements[linkedIndex];
      if (!linkedElement) return;

      const targetKey = `${artifactId}\u0000${target.kind}\u0000${target.id}`;
      const repeatedTarget = targetKey === lastTargetKeyRef.current;
      linkedElement.scrollIntoView({
        block: repeatedTarget ? "nearest" : "center",
        inline: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      lastTargetKeyRef.current = targetKey;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [artifactId, cursorEnd, cursorStart, enabled, previewScrollRef, target]);
}
