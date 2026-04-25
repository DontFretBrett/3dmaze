export interface LayerPresentation {
  isActive: boolean;
  renderGeometry: boolean;
  showLayerMarkers: boolean;
}

export function getLayerPresentation(layerIndex: number, activeLayer: number): LayerPresentation {
  const isActive = layerIndex === activeLayer;
  return {
    isActive,
    renderGeometry: isActive,
    showLayerMarkers: isActive,
  };
}

export function shouldRenderActorOnLayer(actorLayer: number, activeLayer: number) {
  return actorLayer === activeLayer;
}
