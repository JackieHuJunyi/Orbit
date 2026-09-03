import type { PointerEvent as ReactPointerEvent } from "react";

const DEFAULT_POINTER_POSITION = "50%";

function supportsSurfaceMotion() {
  return typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function trackFluidSurface<T extends HTMLElement>(event: ReactPointerEvent<T>) {
  if (event.pointerType === "touch" || !supportsSurfaceMotion()) return;

  const surface = event.currentTarget;
  const bounds = surface.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const normalizedX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  const normalizedY = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));

  surface.dataset.pointerActive = "true";
  surface.style.setProperty("--orbit-pointer-x", `${(normalizedX * 100).toFixed(2)}%`);
  surface.style.setProperty("--orbit-pointer-y", `${(normalizedY * 100).toFixed(2)}%`);
  surface.style.setProperty("--orbit-pointer-shift-x", `${((normalizedX - 0.5) * 8).toFixed(2)}px`);
  surface.style.setProperty("--orbit-pointer-shift-y", `${((normalizedY - 0.5) * 6).toFixed(2)}px`);
}

export function resetFluidSurface<T extends HTMLElement>(event: ReactPointerEvent<T>) {
  const surface = event.currentTarget;
  delete surface.dataset.pointerActive;
  surface.style.setProperty("--orbit-pointer-x", DEFAULT_POINTER_POSITION);
  surface.style.setProperty("--orbit-pointer-y", DEFAULT_POINTER_POSITION);
  surface.style.setProperty("--orbit-pointer-shift-x", "0px");
  surface.style.setProperty("--orbit-pointer-shift-y", "0px");
}
