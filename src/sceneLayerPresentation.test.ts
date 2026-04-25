import { describe, expect, it } from "vitest";
import { getLayerPresentation, shouldRenderActorOnLayer } from "./sceneLayerPresentation";

describe("scene layer presentation", () => {
  it("renders geometry only for the active layer", () => {
    expect(getLayerPresentation(0, 0)).toEqual({
      isActive: true,
      renderGeometry: true,
      showLayerMarkers: true,
    });

    expect(getLayerPresentation(1, 0)).toEqual({
      isActive: false,
      renderGeometry: false,
      showLayerMarkers: false,
    });
  });

  it("shows actors only on the active layer", () => {
    expect(shouldRenderActorOnLayer(1, 1)).toBe(true);
    expect(shouldRenderActorOnLayer(0, 1)).toBe(false);
  });
});
