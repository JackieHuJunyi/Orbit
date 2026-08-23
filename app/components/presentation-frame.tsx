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

export function PresentationFrame({ className = "", viewportClassName = "", ...props }: PresentationFrameProps) {
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

    // WebKit can abandon one of several simultaneous live srcdoc updates on
    // an empty document. Replay the same proven bytes once, with a small
    // content-derived stagger, while keeping the SSR and other engines on the
    // ordinary native srcdoc path.
    const timer = window.setTimeout(() => {
      if (frameRef.current !== frame) return;
      frame.removeAttribute("srcdoc");
      frame.setAttribute("srcdoc", source);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [props.srcDoc]);

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
        height={PRESENTATION_CANVAS_HEIGHT}
        ref={frameRef}
        width={PRESENTATION_CANVAS_WIDTH}
      />
    </div>
  );
}
