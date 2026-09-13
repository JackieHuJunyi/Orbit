"use client";

import { useCallback, useState, type RefObject } from "react";
import { matchPdfToolIntent } from "../lib/pdf-tool-intent";
import { pdfToolOpenedNotice, pdfToolSelectionNotice } from "../lib/pdf-tool-continuation";
import type { PdfToolDefinition } from "../lib/pdf-tool-registry";
import type { OrbitLocale } from "../lib/localization";

export function usePdfToolFlow({
  locale,
  importRef,
  setNotice,
}: {
  locale: OrbitLocale;
  importRef: RefObject<HTMLInputElement | null>;
  setNotice: (notice: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [initialToolId, setInitialToolId] = useState("merge");
  const [intent, setIntent] = useState<PdfToolDefinition | null>(null);

  const openTools = useCallback((allowed: boolean) => {
    if (!allowed) return;
    setIntent(null);
    setInitialToolId("merge");
    setOpen(true);
  }, []);
  const openMatchingIntent = useCallback(
    (prompt: string, allowed: boolean) => {
      const toolId = matchPdfToolIntent(prompt);
      if (!toolId || !allowed) return false;
      setInitialToolId(toolId);
      setOpen(true);
      setNotice(pdfToolOpenedNotice(locale));
      return true;
    },
    [locale, setNotice],
  );
  const continueInWorkspace = useCallback(
    (tool: PdfToolDefinition) => {
      setIntent(tool);
      setOpen(false);
      setNotice(pdfToolSelectionNotice(locale, tool));
      window.requestAnimationFrame(() => importRef.current?.click());
    },
    [importRef, locale, setNotice],
  );
  const close = useCallback(() => setOpen(false), []);
  const clearIntent = useCallback(() => setIntent(null), []);

  return {
    open,
    initialToolId,
    intent,
    openTools,
    openMatchingIntent,
    continueInWorkspace,
    close,
    clearIntent,
    centerProps: { initialToolId, onClose: close, onContinueInWorkspace: continueInWorkspace },
  } as const;
}
