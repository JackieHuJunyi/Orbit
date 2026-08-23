export const PRESENTATION_CANVAS_WIDTH = 1120;
export const PRESENTATION_CANVAS_HEIGHT = 630;

const WEBKIT_SRC_DOC_REPLAY_BASE_MS = 48;
const WEBKIT_SRC_DOC_REPLAY_STEP_MS = 24;
const WEBKIT_SRC_DOC_REPLAY_SLOTS = 7;

export type PresentationCanvasTransform = Readonly<{
  offsetX: number;
  offsetY: number;
  scale: number;
}>;

export function presentationCanvasTransform(
  viewportWidth: number,
  viewportHeight: number,
): PresentationCanvasTransform {
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return Object.freeze({ offsetX: 0, offsetY: 0, scale: 0 });
  }
  const scale = Math.min(viewportWidth / PRESENTATION_CANVAS_WIDTH, viewportHeight / PRESENTATION_CANVAS_HEIGHT);
  return Object.freeze({
    scale,
    offsetX: (viewportWidth - PRESENTATION_CANVAS_WIDTH * scale) / 2,
    offsetY: (viewportHeight - PRESENTATION_CANVAS_HEIGHT * scale) / 2,
  });
}

export function presentationSrcDocReplayDelay(source: string, userAgent: string): number | null {
  const webKit = /AppleWebKit/u.test(userAgent) && !/(?:Chrome|Chromium|Edg)\//u.test(userAgent);
  if (!webKit || !source) return null;
  let slot = 0;
  const stride = Math.max(1, Math.floor(source.length / 64));
  for (let index = 0; index < source.length; index += stride) {
    slot = (slot * 31 + source.charCodeAt(index)) % WEBKIT_SRC_DOC_REPLAY_SLOTS;
  }
  return WEBKIT_SRC_DOC_REPLAY_BASE_MS + slot * WEBKIT_SRC_DOC_REPLAY_STEP_MS;
}

export const PRESENTATION_PREVIEW_CANVAS_STYLE = `
html,body{width:${PRESENTATION_CANVAS_WIDTH}px!important;height:${PRESENTATION_CANVAS_HEIGHT}px!important;min-width:${PRESENTATION_CANVAS_WIDTH}px!important;min-height:${PRESENTATION_CANVAS_HEIGHT}px!important;max-width:${PRESENTATION_CANVAS_WIDTH}px!important;max-height:${PRESENTATION_CANVAS_HEIGHT}px!important;overflow:hidden!important}
body>main{display:block!important;width:${PRESENTATION_CANVAS_WIDTH}px!important;height:${PRESENTATION_CANVAS_HEIGHT}px!important;min-width:${PRESENTATION_CANVAS_WIDTH}px!important;min-height:${PRESENTATION_CANVAS_HEIGHT}px!important;max-width:${PRESENTATION_CANVAS_WIDTH}px!important;max-height:${PRESENTATION_CANVAS_HEIGHT}px!important;margin:0!important;padding:0!important;overflow:hidden!important}
body>main>section{width:${PRESENTATION_CANVAS_WIDTH}px!important;height:${PRESENTATION_CANVAS_HEIGHT}px!important;min-width:${PRESENTATION_CANVAS_WIDTH}px!important;min-height:${PRESENTATION_CANVAS_HEIGHT}px!important;max-width:${PRESENTATION_CANVAS_WIDTH}px!important;max-height:${PRESENTATION_CANVAS_HEIGHT}px!important;margin:0!important;aspect-ratio:auto!important;overflow:hidden!important}
`;
