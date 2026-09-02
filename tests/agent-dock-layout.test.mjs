import assert from "node:assert/strict";
import test from "node:test";

import {
  clampFloatingAgentDock,
  moveFloatingAgentDock,
  normalizeAgentDockPlacement,
  normalizeAgentDockPoint,
  placeAgentContextTrigger,
  placeFloatingAgentDock,
} from "../app/lib/agent-dock-layout.ts";

test("places a floating Agent beside content without leaving the viewport", () => {
  assert.deepEqual(
    placeFloatingAgentDock({ left: 860, right: 1320, top: 220, bottom: 420 }, { width: 1440, height: 900 }),
    { x: 408, y: 192 },
  );
  assert.deepEqual(placeFloatingAgentDock({ left: 40, right: 260, top: 10, bottom: 90 }, { width: 390, height: 844 }), {
    x: 12,
    y: 12,
  });
});

test("clamps dragging and the contextual trigger to every viewport edge", () => {
  assert.deepEqual(
    moveFloatingAgentDock(
      { x: 300, y: 200 },
      { x: 900, y: -500 },
      { width: 440, height: 360 },
      { width: 1200, height: 800 },
    ),
    { x: 748, y: 12 },
  );
  assert.deepEqual(
    clampFloatingAgentDock({ x: -50, y: 900 }, { width: 360, height: 500 }, { width: 390, height: 844 }),
    { x: 12, y: 332 },
  );
  assert.deepEqual(
    placeAgentContextTrigger({ left: 20, right: 180, top: 18, bottom: 80 }, { width: 390, height: 844 }),
    { x: 24, y: 12 },
  );
});

test("normalizes corrupt persisted floating layout values", () => {
  assert.equal(normalizeAgentDockPlacement("floating"), "floating");
  assert.equal(normalizeAgentDockPlacement("detached"), "docked");
  assert.deepEqual(normalizeAgentDockPoint({ x: 180, y: 96 }), { x: 180, y: 96 });
  assert.deepEqual(normalizeAgentDockPoint({ x: Number.NaN, y: "96" }), { x: 12, y: 12 });
});
