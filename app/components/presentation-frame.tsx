"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import {
  PRESENTATION_CANVAS_HEIGHT,
  PRESENTATION_CANVAS_WIDTH,
  presentationCanvasTransform,
} from "../lib/presentation-canvas";

type PresentationFrameProps = Omit<ComponentPropsWithoutRef<"iframe">, "height" | "width"> & {
  viewportClassName?: string;
};

export function PresentationFrame({ className = "", viewportClassName = "", ...props }: PresentationFrameProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

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
        width={PRESENTATION_CANVAS_WIDTH}
      />
    </div>
  );
}
