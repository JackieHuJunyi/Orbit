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
  const restoreFocusFrameRef = useRef(0);

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

  useLayoutEffect(
    () => () => {
      if (restoreFocusFrameRef.current) window.cancelAnimationFrame(restoreFocusFrameRef.current);
    },
    [],
  );

  const setItemRef = useCallback((index: number, element: HTMLButtonElement | null) => {
    itemRefs.current[index] = element;
  }, []);

  const closeAndRestoreFocus = useCallback(() => {
    onOpenChange(false);
    if (restoreFocusFrameRef.current) window.cancelAnimationFrame(restoreFocusFrameRef.current);
    restoreFocusFrameRef.current = window.requestAnimationFrame(() => {
      restoreFocusFrameRef.current = 0;
      restoreFocusRef.current?.focus({ preventScroll: true });
    });
  }, [onOpenChange, restoreFocusRef]);

  const requestOpen = useCallback(
    (edge: WorkbenchMenuFocusEdge) => {
      if (restoreFocusFrameRef.current) {
        window.cancelAnimationFrame(restoreFocusFrameRef.current);
        restoreFocusFrameRef.current = 0;
      }
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
        onOpenChange(false);
        return;
      }
      if (nextIndex == null) return;
      event.preventDefault();
      items[nextIndex]?.focus({ preventScroll: true });
    },
    [closeAndRestoreFocus, enabledItems, onOpenChange],
  );

  return { closeAndRestoreFocus, onMenuKeyDown, requestOpen, setItemRef } as const;
}
