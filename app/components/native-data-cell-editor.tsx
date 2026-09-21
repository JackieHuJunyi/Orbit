"use client";

import { useRef, type CompositionEvent, type FormEvent, type KeyboardEvent } from "react";
import type { DataCellPreviewSourceTarget } from "../lib/preview-targets";
import type { VisualDataCellEditInput, VisualDataCellValueType } from "../lib/visual-data-edit";
import type { DataCell } from "../lib/workspace";

function directValueType(value: DataCell, format: "CSV" | "JSON", draft: string): VisualDataCellValueType {
  if (format === "CSV") return "auto";
  if (typeof value === "number") return Number.isFinite(Number(draft)) && draft.trim() ? "number" : "string";
  if (typeof value === "boolean") return ["true", "false"].includes(draft.trim()) ? "boolean" : "string";
  if (value == null) return draft.trim() === "null" ? "null" : "string";
  return "string";
}

export function NativeDataCellEditor({
  format,
  target,
  value,
  onCancel,
  onCommit,
  onDraftChange,
  onMove,
}: {
  format: "CSV" | "JSON";
  target: DataCellPreviewSourceTarget;
  value: DataCell;
  onCancel: () => void;
  onCommit: (input: VisualDataCellEditInput) => string | null;
  onDraftChange: (input: VisualDataCellEditInput) => string | null;
  onMove: (direction: "next-row") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const originalValue = value == null ? "null" : String(value);
  const composingRef = useRef(false);
  const dirtyRef = useRef(false);
  const cancelledRef = useRef(false);

  const editInput = (draft: string): VisualDataCellEditInput => ({
    draft,
    valueType: directValueType(value, format, draft),
  });

  const publish = (element: HTMLInputElement) => {
    dirtyRef.current = element.value !== originalValue;
    const error = onDraftChange(editInput(element.value));
    element.toggleAttribute("aria-invalid", Boolean(error));
    if (error) element.dataset.directEditError = error;
    else delete element.dataset.directEditError;
  };

  return (
    <input
      ref={inputRef}
      className="native-data-cell-editor"
      data-data-cell-editor={`${target.rowIndex}:${target.columnIndex}`}
      defaultValue={originalValue}
      aria-label={`Edit ${target.label}`}
      inputMode={typeof value === "number" ? "decimal" : "text"}
      spellCheck={typeof value === "string"}
      onFocus={(event) => {
        const input = event.currentTarget;
        input.dataset.orbitOriginalValue = originalValue;
        window.requestAnimationFrame(() => input.isConnected && input.select());
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
        composingRef.current = false;
        publish(event.currentTarget);
      }}
      onInput={(event: FormEvent<HTMLInputElement>) => {
        if (composingRef.current || (event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing)) return;
        publish(event.currentTarget);
      }}
      onBlur={(event) => {
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        if (!dirtyRef.current) {
          onCancel();
          return;
        }
        const error = onCommit(editInput(event.currentTarget.value));
        if (error) {
          event.currentTarget.setAttribute("aria-invalid", "true");
          event.currentTarget.dataset.directEditError = error;
          window.requestAnimationFrame(() => event.currentTarget.focus({ preventScroll: true }));
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelledRef.current = true;
          dirtyRef.current = false;
          event.currentTarget.value = originalValue;
          onCancel();
          event.currentTarget.blur();
          return;
        }
        if (event.key !== "Enter" || composingRef.current) return;
        event.preventDefault();
        event.currentTarget.blur();
        window.requestAnimationFrame(() => onMove("next-row"));
      }}
    />
  );
}
