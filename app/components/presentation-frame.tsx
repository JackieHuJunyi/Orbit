"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import {
  PRESENTATION_CANVAS_HEIGHT,
  PRESENTATION_CANVAS_WIDTH,
  presentationCanvasTransform,
  presentationSrcDocReplayDelay,
} from "../lib/presentation-canvas";

type PresentationFrameProps = Omit<ComponentPropsWithoutRef<"iframe">, "height" | "width"> & {
  editable?: {
    label: string;
    source: string;
    onCancel: () => void;
    onCommit: (source: string) => string | null;
    onDraftChange: (source: string) => string | null;
  };
  viewportClassName?: string;
};

type WebKitSrcDocReplayTask = {
  cancelled: boolean;
  delay: number;
  frame: HTMLIFrameElement;
  loadListener: (() => void) | null;
  phaseTimer: number | null;
  source: string;
};

const webKitSrcDocReplayQueue: WebKitSrcDocReplayTask[] = [];
let activeWebKitSrcDocReplay: WebKitSrcDocReplayTask | null = null;
let webKitSrcDocReplayIdentity = 0;

function clearWebKitSrcDocReplayTask(task: WebKitSrcDocReplayTask) {
  if (task.phaseTimer != null) window.clearTimeout(task.phaseTimer);
  if (task.loadListener) task.frame.removeEventListener("load", task.loadListener);
  task.phaseTimer = null;
  task.loadListener = null;
}

function finishWebKitSrcDocReplay(task: WebKitSrcDocReplayTask, ready = false) {
  if (ready && task.frame.getAttribute("srcdoc") === task.source) task.frame.dataset.srcdocReady = "true";
  clearWebKitSrcDocReplayTask(task);
  if (activeWebKitSrcDocReplay === task) activeWebKitSrcDocReplay = null;
  const queuedIndex = webKitSrcDocReplayQueue.indexOf(task);
  if (queuedIndex >= 0) webKitSrcDocReplayQueue.splice(queuedIndex, 1);
  window.queueMicrotask(runNextWebKitSrcDocReplay);
}

function loadWebKitSrcDocReplaySource(task: WebKitSrcDocReplayTask) {
  if (task.cancelled || !task.frame.isConnected) {
    finishWebKitSrcDocReplay(task);
    return;
  }
  clearWebKitSrcDocReplayTask(task);
  task.loadListener = () => finishWebKitSrcDocReplay(task, true);
  task.frame.addEventListener("load", task.loadListener, { once: true });
  task.frame.setAttribute("srcdoc", task.source);
  task.phaseTimer = window.setTimeout(() => finishWebKitSrcDocReplay(task), 2_500);
}

function runNextWebKitSrcDocReplay() {
  if (activeWebKitSrcDocReplay) return;
  const task = webKitSrcDocReplayQueue.shift();
  if (!task) return;
  if (task.cancelled || !task.frame.isConnected) {
    window.queueMicrotask(runNextWebKitSrcDocReplay);
    return;
  }
  activeWebKitSrcDocReplay = task;
  task.phaseTimer = window.setTimeout(() => {
    if (task.cancelled || !task.frame.isConnected) {
      finishWebKitSrcDocReplay(task);
      return;
    }
    task.frame.removeAttribute("srcdoc");
    task.loadListener = () => loadWebKitSrcDocReplaySource(task);
    task.frame.addEventListener("load", task.loadListener, { once: true });
    task.frame.setAttribute("src", `about:blank#orbit-srcdoc-replay-${++webKitSrcDocReplayIdentity}`);
    task.phaseTimer = window.setTimeout(() => loadWebKitSrcDocReplaySource(task), 320);
  }, task.delay);
}

function enqueueWebKitSrcDocReplay(frame: HTMLIFrameElement, source: string, delay: number) {
  const task: WebKitSrcDocReplayTask = {
    cancelled: false,
    delay,
    frame,
    loadListener: null,
    phaseTimer: null,
    source,
  };
  frame.dataset.srcdocReady = "false";
  webKitSrcDocReplayQueue.push(task);
  runNextWebKitSrcDocReplay();
  return () => {
    task.cancelled = true;
    if (activeWebKitSrcDocReplay === task) finishWebKitSrcDocReplay(task);
    else {
      const queuedIndex = webKitSrcDocReplayQueue.indexOf(task);
      if (queuedIndex >= 0) webKitSrcDocReplayQueue.splice(queuedIndex, 1);
    }
  };
}

const DIRECT_SLIDE_TAG_PATTERN = /<\s*(\/)?\s*([a-z][a-z0-9:-]*)\b[^>]*>/giu;
const DIRECT_SLIDE_BINDING_PATTERN = /\{\{[^{}]+\}\}/gu;
const DIRECT_SLIDE_EXCLUDED_TAGS = new Set(["script", "style", "template", "textarea", "title"]);
const DIRECT_SLIDE_VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

type DirectSlideTextTarget = Readonly<{ end: number; index: number; start: number; text: string }>;

function normalizedSlideText(value: string) {
  return value
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function directSlideTextTargets(source: string, document: Document) {
  const targets: DirectSlideTextTarget[] = [];
  const stack: string[] = [];
  const addText = (rangeStart: number, rangeEnd: number) => {
    if (stack.some((tag) => DIRECT_SLIDE_EXCLUDED_TAGS.has(tag))) return;
    const raw = source.slice(rangeStart, rangeEnd);
    if (!raw.trim() || /<!--|-->|[<>]/u.test(raw)) return;
    let partStart = 0;
    const addPart = (partEnd: number) => {
      const part = raw.slice(partStart, partEnd);
      const leading = part.match(/^\s*/u)?.[0].length ?? 0;
      const trailing = part.match(/\s*$/u)?.[0].length ?? 0;
      const value = part.slice(leading, part.length - trailing);
      if (!value) return;
      const template = document.createElement("template");
      template.innerHTML = value;
      const text = template.content.textContent ?? "";
      if (!text) return;
      const start = rangeStart + partStart + leading;
      targets.push({ end: start + value.length, index: targets.length, start, text });
    };
    for (const binding of raw.matchAll(DIRECT_SLIDE_BINDING_PATTERN)) {
      if (binding.index == null) continue;
      addPart(binding.index);
      partStart = binding.index + binding[0].length;
    }
    addPart(raw.length);
  };
  let cursor = 0;
  for (const match of source.matchAll(DIRECT_SLIDE_TAG_PATTERN)) {
    if (match.index == null) continue;
    addText(cursor, match.index);
    const closing = Boolean(match[1]);
    const tag = match[2].toLocaleLowerCase();
    if (closing) {
      const index = stack.lastIndexOf(tag);
      if (index >= 0) stack.splice(index);
    } else if (!DIRECT_SLIDE_VOID_TAGS.has(tag) && !/\/\s*>$/u.test(match[0])) {
      stack.push(tag);
    }
    cursor = match.index + match[0].length;
  }
  addText(cursor, source.length);
  return targets;
}

function escapeSlideText(value: string) {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function editableSlideSource(section: HTMLElement, source: string, targets: DirectSlideTextTarget[]) {
  const replacements = [...section.querySelectorAll<HTMLElement>("[data-orbit-edit-target]")].flatMap((element) => {
    const target = targets[Number(element.dataset.orbitEditTarget)];
    return target ? [{ end: target.end, start: target.start, value: escapeSlideText(element.textContent ?? "") }] : [];
  });
  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (next, replacement) => `${next.slice(0, replacement.start)}${replacement.value}${next.slice(replacement.end)}`,
      source,
    );
}

function directSlideTextNodes(section: HTMLElement) {
  const nodes: Text[] = [];
  const walker = section.ownerDocument.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    const parent = text.parentElement;
    if (
      text.data.trim() &&
      parent &&
      !parent.closest("[data-orbit-slide-text-editor]") &&
      !DIRECT_SLIDE_EXCLUDED_TAGS.has(parent.tagName.toLocaleLowerCase())
    )
      nodes.push(text);
    current = walker.nextNode();
  }
  return nodes;
}

function wrapDirectSlideText(section: HTMLElement, target: DirectSlideTextTarget) {
  const nodes = directSlideTextNodes(section);
  const exact = nodes.find((node) => node.data.includes(target.text));
  const node =
    exact ?? nodes.find((candidate) => normalizedSlideText(candidate.data) === normalizedSlideText(target.text));
  if (!node) return null;
  const start = exact ? node.data.indexOf(target.text) : 0;
  const length = exact ? target.text.length : node.data.length;
  const editableNode = start > 0 ? node.splitText(start) : node;
  if (length < editableNode.data.length) editableNode.splitText(length);
  const wrapper = section.ownerDocument.createElement("span");
  wrapper.textContent = editableNode.data;
  editableNode.replaceWith(wrapper);
  return wrapper;
}

function enableDirectSlideEditing(frame: HTMLIFrameElement, editable: NonNullable<PresentationFrameProps["editable"]>) {
  const document = frame.contentDocument;
  const section = document?.querySelector<HTMLElement>("body > main > section");
  if (!document || !section) return () => undefined;
  const targets = directSlideTextTargets(editable.source, document);
  const originalRenderedValues = new Map<number, string>();
  let composing = false;
  let dirty = false;
  let cancelled = false;
  let restoring = false;

  const decorate = () => {
    targets.forEach((target) => {
      const element = wrapDirectSlideText(section, target);
      if (!element) return;
      originalRenderedValues.set(target.index, element.textContent ?? "");
      element.contentEditable = "true";
      element.spellcheck = true;
      element.setAttribute("role", "textbox");
      element.setAttribute("aria-label", `${editable.label} · text ${target.index + 1}`);
      element.dataset.orbitEditTarget = String(target.index);
      element.dataset.orbitSlideTextEditor = "true";
    });
  };
  decorate();
  const style = document.createElement("style");
  style.dataset.orbitDirectSlideEditing = "true";
  style.textContent = `[data-orbit-slide-text-editor]{outline:0;caret-color:#3b82f6;cursor:text}[data-orbit-slide-text-editor]:focus{box-shadow:inset 0 -2px color-mix(in srgb,#3b82f6 72%,transparent)}`;
  document.head.appendChild(style);

  const SlideMutationObserver = document.defaultView?.MutationObserver ?? MutationObserver;
  const observer = new SlideMutationObserver(() => {
    if (!composing && !restoring) publish();
  });
  const observe = () => {
    observer.disconnect();
    if (section) observer.observe(section, { characterData: true, childList: true, subtree: true });
  };

  const publish = () => {
    if (!section) return;
    dirty = true;
    const active = document.activeElement as HTMLElement | null;
    const error = editable.onDraftChange(editableSlideSource(section, editable.source, targets));
    active?.toggleAttribute("aria-invalid", Boolean(error));
    if (active && error) active.dataset.directEditError = error;
    else if (active) delete active.dataset.directEditError;
  };
  observe();
  const onCompositionStart = () => {
    composing = true;
  };
  const onCompositionEnd = () => {
    composing = false;
    publish();
  };
  const onInput = (event: Event) => {
    if (composing || (event instanceof InputEvent && event.isComposing)) return;
    publish();
  };
  const commitIfNeeded = (force = false) => {
    window.queueMicrotask(() => {
      if (!force && document.activeElement?.closest?.("[data-orbit-slide-text-editor]")) return;
      if (cancelled) {
        cancelled = false;
        return;
      }
      if (!dirty || !section) {
        editable.onCancel();
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      const error = editable.onCommit(editableSlideSource(section, editable.source, targets));
      if (error) {
        active?.setAttribute("aria-invalid", "true");
        if (active) active.dataset.directEditError = error;
        return;
      }
      dirty = false;
    });
  };
  const onFocusOut = () => commitIfNeeded(false);
  const onFrameBlur = () => commitIfNeeded(true);
  const onKeyDown = (event: globalThis.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cancelled = true;
    dirty = false;
    restoring = true;
    section.querySelectorAll<HTMLElement>("[data-orbit-edit-target]").forEach((element) => {
      const original = originalRenderedValues.get(Number(element.dataset.orbitEditTarget));
      if (original != null) element.textContent = original;
    });
    window.queueMicrotask(() => {
      restoring = false;
    });
    editable.onCancel();
    frame.focus({ preventScroll: true });
  };
  document.addEventListener("compositionstart", onCompositionStart, true);
  document.addEventListener("compositionend", onCompositionEnd, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("focusout", onFocusOut, true);
  document.addEventListener("keydown", onKeyDown, true);
  frame.addEventListener("blur", onFrameBlur);
  return () => {
    document.removeEventListener("compositionstart", onCompositionStart, true);
    document.removeEventListener("compositionend", onCompositionEnd, true);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("focusout", onFocusOut, true);
    document.removeEventListener("keydown", onKeyDown, true);
    frame.removeEventListener("blur", onFrameBlur);
    observer.disconnect();
    style.remove();
  };
}

export function PresentationFrame({
  className = "",
  editable,
  onLoad,
  viewportClassName = "",
  ...props
}: PresentationFrameProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const fitCanvas = () => {
      const transform = presentationCanvasTransform(viewport.clientWidth, viewport.clientHeight);
      if (transform.scale <= 0) return;
      viewport.style.setProperty("--presentation-frame-scale", String(transform.scale));
      viewport.style.setProperty("--presentation-frame-offset-x", `${transform.offsetX}px`);
      viewport.style.setProperty("--presentation-frame-offset-y", `${transform.offsetY}px`);
    };

    fitCanvas();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", fitCanvas);
      return () => window.removeEventListener("resize", fitCanvas);
    }
    const observer = new ResizeObserver(fitCanvas);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const source = props.srcDoc;
    if (typeof source !== "string") return;
    const delay = presentationSrcDocReplayDelay(source, navigator.userAgent);
    if (delay == null) return;
    const frame = frameRef.current;
    if (!frame) return;

    // WebKit can abandon simultaneous live srcdoc updates on empty documents.
    // Serialize a blank navigation and the same proven bytes for each frame;
    // SSR and other engines retain the ordinary native srcdoc path.
    return enqueueWebKitSrcDocReplay(frame, source, delay);
  }, [editable, props.srcDoc]);

  useLayoutEffect(() => {
    if (!editable) return;
    const frame = frameRef.current;
    if (!frame) return;
    let cleanup: () => void = () => {};
    const install = () => {
      cleanup();
      cleanup = enableDirectSlideEditing(frame, editable);
    };
    frame.addEventListener("load", install);
    if (frame.contentDocument?.readyState === "complete") install();
    return () => {
      frame.removeEventListener("load", install);
      cleanup();
    };
  }, [editable, props.srcDoc]);

  const handleFrameLoad: NonNullable<ComponentPropsWithoutRef<"iframe">["onLoad"]> = (event) => {
    const source = props.srcDoc;
    if (
      typeof source === "string" &&
      presentationSrcDocReplayDelay(source, navigator.userAgent) == null &&
      event.currentTarget.getAttribute("srcdoc") === source
    ) {
      event.currentTarget.dataset.srcdocReady = "true";
    }
    onLoad?.(event);
  };

  return (
    <div
      className={`presentation-frame-viewport ${viewportClassName}`.trim()}
      data-presentation-canvas={`${PRESENTATION_CANVAS_WIDTH}x${PRESENTATION_CANVAS_HEIGHT}`}
      ref={viewportRef}
      style={
        {
          "--presentation-frame-offset-x": "0px",
          "--presentation-frame-offset-y": "0px",
          "--presentation-frame-scale": "1",
        } as CSSProperties
      }
    >
      <iframe
        {...props}
        className={`presentation-frame ${className}`.trim()}
        data-srcdoc-ready="false"
        height={PRESENTATION_CANVAS_HEIGHT}
        onLoad={handleFrameLoad}
        ref={frameRef}
        width={PRESENTATION_CANVAS_WIDTH}
      />
    </div>
  );
}
