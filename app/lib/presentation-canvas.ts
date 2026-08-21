export const PRESENTATION_CANVAS_WIDTH = 1120;
export const PRESENTATION_CANVAS_HEIGHT = 630;

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

export const PRESENTATION_PREVIEW_CANVAS_STYLE = `
html,body{width:${PRESENTATION_CANVAS_WIDTH}px!important;height:${PRESENTATION_CANVAS_HEIGHT}px!important;min-width:${PRESENTATION_CANVAS_WIDTH}px!important;min-height:${PRESENTATION_CANVAS_HEIGHT}px!important;max-width:${PRESENTATION_CANVAS_WIDTH}px!important;max-height:${PRESENTATION_CANVAS_HEIGHT}px!important;overflow:hidden!important}
body>main{display:block!important;width:${PRESENTATION_CANVAS_WIDTH}px!important;height:${PRESENTATION_CANVAS_HEIGHT}px!important;min-width:${PRESENTATION_CANVAS_WIDTH}px!important;min-height:${PRESENTATION_CANVAS_HEIGHT}px!important;max-width:${PRESENTATION_CANVAS_WIDTH}px!important;max-height:${PRESENTATION_CANVAS_HEIGHT}px!important;margin:0!important;padding:0!important;overflow:hidden!important}
body>main>section{width:${PRESENTATION_CANVAS_WIDTH}px!important;height:${PRESENTATION_CANVAS_HEIGHT}px!important;min-width:${PRESENTATION_CANVAS_WIDTH}px!important;min-height:${PRESENTATION_CANVAS_HEIGHT}px!important;max-width:${PRESENTATION_CANVAS_WIDTH}px!important;max-height:${PRESENTATION_CANVAS_HEIGHT}px!important;margin:0!important;aspect-ratio:auto!important;overflow:hidden!important}
`;
