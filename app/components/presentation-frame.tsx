"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import {
  PRESENTATION_CANVAS_HEIGHT,
  PRESENTATION_CANVAS_WIDTH,
  presentationCanvasTransform,
  presentationSrcDocReplayDelay,
} from "../lib/presentation-canvas";

type PresentationFrameProps = Omit<ComponentPropsWithoutRef<"iframe">, "height" | "width"> & {
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

export function PresentationFrame({
  className = "",
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
  }, [props.srcDoc]);

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
