"use client";

import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from "react";

export type WorkbenchMenuFocusEdge = "first" | "last";

export function useWorkbenchMenuFocus({
  itemCount,
  open,
  onOpenChange,
  requestedFocusRef: suppliedRequestedFocusRef,
  restoreFocusRef,
}: {
  itemCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestedFocusRef?: RefObject<WorkbenchMenuFocusEdge>;
  restoreFocusRef: RefObject<HTMLElement | null>;
}) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const ownRequestedFocusRef = useRef<WorkbenchMenuFocusEdge>("first");

  const enabledItems = useCallback(
    () => itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled)),
    [],
  );

  useLayoutEffect(() => {
    itemRefs.current.length = itemCount;
    if (!open) return;
    const items = enabledItems();
    const requestedEdge = suppliedRequestedFocusRef?.current ?? ownRequestedFocusRef.current;
    const requestedIndex = requestedEdge === "last" ? items.length - 1 : 0;
    items[requestedIndex]?.focus({ preventScroll: true });
  }, [enabledItems, itemCount, open, suppliedRequestedFocusRef]);

  const setItemRef = useCallback((index: number, element: HTMLButtonElement | null) => {
    itemRefs.current[index] = element;
  }, []);

  const closeAndRestoreFocus = useCallback(() => {
    onOpenChange(false);
    // Let React commit the close before returning focus. This frame survives a
    // lazy menu unmount, and the expanded-state guard prevents an obsolete
    // callback from stealing focus if the trigger has already reopened it.
    window.requestAnimationFrame(() => {
      const trigger = restoreFocusRef.current;
      if (trigger?.getAttribute("aria-expanded") === "false") trigger.focus({ preventScroll: true });
    });
  }, [onOpenChange, restoreFocusRef]);

  const closeAndMovePastTrigger = useCallback(
    (backward: boolean) => {
      onOpenChange(false);
      // WebKit can retain a detached menu item as document.activeElement when
      // React unmounts a popover during the browser's native Tab traversal.
      // Resolve the adjacent visible control from the stable trigger after the
      // close commit so Tab always exits the menu instead of leaving focus in
      // hidden chrome.
      window.requestAnimationFrame(() => {
        const trigger = restoreFocusRef.current;
        if (!trigger) return;
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            !element.hidden &&
            element.getAttribute("aria-hidden") !== "true" &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden",
        );
        const triggerIndex = candidates.indexOf(trigger);
        const next = candidates[triggerIndex + (backward ? -1 : 1)];
        next?.focus({ preventScroll: true });
      });
    },
    [onOpenChange, restoreFocusRef],
  );

  const requestOpen = useCallback(
    (edge: WorkbenchMenuFocusEdge) => {
      ownRequestedFocusRef.current = edge;
      if (open) {
        const items = enabledItems();
        items[edge === "last" ? items.length - 1 : 0]?.focus({ preventScroll: true });
        return;
      }
      onOpenChange(true);
    },
    [enabledItems, onOpenChange, open],
  );

  const onMenuKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const items = enabledItems();
      if (!items.length) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      let nextIndex: number | null = null;
      if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      if (event.key === "ArrowUp")
        nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = items.length - 1;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeAndRestoreFocus();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        closeAndMovePastTrigger(event.shiftKey);
        return;
      }
      if (nextIndex == null) return;
      event.preventDefault();
      items[nextIndex]?.focus({ preventScroll: true });
    },
    [closeAndMovePastTrigger, closeAndRestoreFocus, enabledItems],
  );

  return { closeAndRestoreFocus, onMenuKeyDown, requestOpen, setItemRef } as const;
}
