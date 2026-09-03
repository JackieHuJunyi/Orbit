"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { orbitUICopy, type OrbitLocale } from "../lib/localization";

export function ReviewDialog({
  dialogId,
  kicker,
  title,
  description,
  detailsLabel,
  dialogClassName,
  children,
  footer,
  locale,
  onCancel,
}: {
  dialogId: string;
  kicker: ReactNode;
  title: string;
  description: ReactNode;
  detailsLabel: string;
  dialogClassName?: string;
  children: ReactNode;
  footer: ReactNode;
  locale: OrbitLocale;
  onCancel: () => void;
}) {
  const copy = orbitUICopy(locale);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef(onCancel);

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector =
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusables = dialog ? [...dialog.querySelectorAll<HTMLElement>(focusableSelector)] : [];
    const initialFocus = dialog?.querySelector<HTMLElement>("[data-dialog-initial-focus]") ?? focusables[0];
    initialFocus?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const current = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!current.length) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="import-review-backdrop">
      <section
        ref={dialogRef}
        className={`import-review-dialog ${dialogClassName ?? ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-description`}
      >
        <header className="import-review-header">
          <div>
            <span className="import-review-kicker">{kicker}</span>
            <h2 id={`${dialogId}-title`}>{title}</h2>
            <p id={`${dialogId}-description`}>{description}</p>
          </div>
          <button
            className="icon-button"
            onClick={onCancel}
            aria-label={copy.common.closeDialog(title)}
            title={copy.common.cancel}
          >
            <X />
          </button>
        </header>
        <div className="import-review-body" role="region" aria-label={detailsLabel} tabIndex={0}>
          {children}
        </div>
        <footer className="import-review-actions">{footer}</footer>
      </section>
    </div>
  );
}
