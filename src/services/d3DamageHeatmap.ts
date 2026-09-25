import * as d3 from 'd3';
import L from 'leaflet';
import { CycloneScenario, InfrastructureNode, CoastalSurgeZone } from '../types/cyclone';
import { COASTAL_SURGE_ZONES } from '../data/cycloneScenarios';

export interface DamageHeatPoint {
  lat: number;
  lng: number;
  intensity: number; // 0.0 to 1.0 normalized damage intensity
  damageDescription: string;
  sourceType: 'infrastructure' | 'coastal_surge' | 'storm_core';
}

/**
 * Generates dynamic geospatial damage sample points based on:
 * 1. Current storm eye position and intensity from forecastTrack
 * 2. Coastal surge zones inundation / wave overtopping
 * 3. Infrastructure node vulnerability scores
 * 4. Timeline offset (peak damage near landfall t=0)
 */
export function generateDamageHeatmapPoints(params: {
  scenario: CycloneScenario;
  timeOffset: number;
  totalWaterLevel: number;
  infrastructure: InfrastructureNode[];
  mangroveOverride: boolean;
}): DamageHeatPoint[] {
  const { scenario, timeOffset, totalWaterLevel, infrastructure, mangroveOverride } = params;
  const points: DamageHeatPoint[] = [];

  // Temporal landfall multiplier: Gaussian decay centered at Landfall (t=0)
  const timeFactor = Math.exp(-Math.pow(timeOffset, 2) / (2 * Math.pow(8, 2)));

  // 1. Storm Eye & Core Windfield damage footprint from forecastTrack
  const track = scenario.forecastTrack;
  let currentEye = track[0];
  if (track && track.length > 0) {
    // Find closest track point to timeOffset
    let minDiff = Infinity;
    track.forEach((pt) => {
      const diff = Math.abs(pt.timeOffsetHours - timeOffset);
      if (diff < minDiff) {
        minDiff = diff;
        currentEye = pt;
      }
    });
  }

  if (currentEye) {
    // Eye wall maximum shear zone
    const eyeShearIntensity = Math.min(1.0, (scenario.windSpeed / 230) * (0.35 + 0.65 * timeFactor));
    points.push({
      lat: currentEye.lat,
      lng: currentEye.lng,
      intensity: Number(eyeShearIntensity.toFixed(2)),
      damageDescription: `Cyclone Eyewall Core Impact Zone (Winds: ${scenario.windSpeed} km/h)`,
      sourceType: 'storm_core',
    });

    // Radial dispersion around eye
    const offsets = [
      [0.2, 0.25], [-0.2, -0.25], [0.25, -0.2], [-0.25, 0.2],
      [0.4, 0.1], [-0.4, 0.15], [0.1, -0.45], [-0.15, 0.4]
    ];
    offsets.forEach(([dLat, dLng]) => {
      points.push({
        lat: currentEye.lat + dLat,
        lng: currentEye.lng + dLng,
        intensity: Number((eyeShearIntensity * 0.72).toFixed(2)),
        damageDescription: 'Hurricane-Force Structural Damage Swath',
        sourceType: 'storm_core',
      });
    });
  }

  // 2. Coastal Surge Zones: dynamic hydrodynamic damage based on TWL vs zone mean elevation & embankment
  COASTAL_SURGE_ZONES.forEach((zone: CoastalSurgeZone) => {
    const isProtected = mangroveOverride && zone.mangroveProtectionPercent > 30;
    const effectiveWater = isProtected ? Math.max(0, totalWaterLevel - 0.85) : totalWaterLevel;
    const floodDepth = Math.max(0, effectiveWater - zone.meanElevationMeters);
    const overtopping = Math.max(0, effectiveWater - zone.embankmentHeightMeters);

    // Normalized damage ratio (0 to 1)
    let zoneDamageRatio = Math.min(1.0, (floodDepth / 2.8) * (0.35 + 0.65 * timeFactor));
    if (overtopping > 0) {
      zoneDamageRatio = Math.min(1.0, zoneDamageRatio + (overtopping / 1.5) * 0.35);
    }
    if (isProtected) zoneDamageRatio = zoneDamageRatio * 0.72;

    if (zone.polygon && zone.polygon.length > 0) {
      // Add zone centroid / first coordinate
      const centerCoord = zone.polygon[0];
      points.push({
        lat: centerCoord[0],
        lng: centerCoord[1],
        intensity: Number(zoneDamageRatio.toFixed(2)),
        damageDescription: `${zone.name}: Water Depth +${floodDepth.toFixed(1)}m (Overtopping: ${overtopping.toFixed(1)}m)`,
        sourceType: 'coastal_surge',
      });

      // Add surrounding perimeter points for smooth surface interpolation
      zone.polygon.slice(1).forEach((coord: [number, number]) => {
        points.push({
          lat: coord[0],
          lng: coord[1],
          intensity: Number((zoneDamageRatio * 0.85).toFixed(2)),
          damageDescription: `${zone.name} Littoral Polder Flood Periphery`,
          sourceType: 'coastal_surge',
        });
      });
    }
  });

  // 3. Infrastructure Nodes (Substations, Roads, Hospitals, Shelters, Ports)
  infrastructure.forEach((node: InfrastructureNode) => {
    const floodDepth = Math.max(0, totalWaterLevel - node.elevationMeters);
    const criticalRatio = floodDepth / Math.max(0.5, node.floodCriticalHeightMeters);
    const windRatio = scenario.windSpeed / 180;
    const nodeDamageScore = Math.min(1.0, (criticalRatio * 0.65 + windRatio * 0.35) * (0.3 + 0.7 * timeFactor));

    if (nodeDamageScore > 0.15) {
      points.push({
        lat: node.lat,
        lng: node.lng,
        intensity: Number(nodeDamageScore.toFixed(2)),
        damageDescription: `${node.name} (${node.type.toUpperCase()}): Damage Index ${Math.round(nodeDamageScore * 100)}%`,
        sourceType: 'infrastructure',
      });
    }
  });

  return points;
}

/**
 * Custom D3 Canvas Heatmap & Intensity Surface Layer for Leaflet
 */
export class D3DamageHeatmapLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private points: DamageHeatPoint[] = [];

  constructor(points: DamageHeatPoint[]) {
    super();
    this.points = points;
  }

  public updatePoints(newPoints: DamageHeatPoint[]) {
    this.points = newPoints;
    this.redraw();
  }

  onAdd(map: L.Map): this {
    this.canvas = L.DomUtil.create('canvas', 'leaflet-d3-damage-heatmap-layer') as HTMLCanvasElement;
    this.canvas.style.position = 'absolute';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.opacity = '0.78';
    this.canvas.style.zIndex = '350';
    this.ctx = this.canvas.getContext('2d');

    const pane = map.getPane('overlayPane') || map.getPanes().overlayPane;
    pane.appendChild(this.canvas);

    map.on('moveend resize zoomend', this.redraw, this);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map): this {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    map.off('moveend resize zoomend', this.redraw, this);
    return this;
  }

  public redraw(): void {
    const map = (this as any)._map as L.Map;
    if (!map || !this.canvas || !this.ctx) return;

    const size = map.getSize();
    const bounds = map.getBounds();
    const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

    this.canvas.width = size.x;
    this.canvas.height = size.y;
    L.DomUtil.setPosition(this.canvas, topLeft);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, size.x, size.y);

    if (this.points.length === 0) return;

    // Off-screen accumulation canvas for smooth radial blending
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size.x;
    offCanvas.height = size.y;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    const currentZoom = map.getZoom();
    // Dynamic radius based on Leaflet zoom level (smooth expansion)
    const baseRadius = Math.max(28, Math.min(110, Math.round(18 * Math.pow(1.32, currentZoom - 6))));

    // Pass 1: Render radial alpha gradients on offscreen canvas
    this.points.forEach((pt) => {
      if (
        pt.lat < bounds.getSouth() - 1 ||
        pt.lat > bounds.getNorth() + 1 ||
        pt.lng < bounds.getWest() - 1 ||
        pt.lng > bounds.getEast() + 1
      ) {
        return;
      }

      const layerPt = map.latLngToLayerPoint([pt.lat, pt.lng]);
      const x = layerPt.x - topLeft.x;
      const y = layerPt.y - topLeft.y;

      const ptRadius = Math.round(baseRadius * (0.7 + 0.6 * pt.intensity));
      const gradient = offCtx.createRadialGradient(x, y, 0, x, y, ptRadius);

      const alpha = Math.min(1.0, Math.max(0.12, pt.intensity * 0.85));
      gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
      gradient.addColorStop(0.45, `rgba(0, 0, 0, ${alpha * 0.55})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      offCtx.fillStyle = gradient;
      offCtx.beginPath();
      offCtx.arc(x, y, ptRadius, 0, Math.PI * 2);
      offCtx.fill();
    });

    // Pass 2: Colorize pixels using D3.js Inferno color transfer function
    const imgData = offCtx.getImageData(0, 0, size.x, size.y);
    const data = imgData.data;

    // Pre-calculate D3 color lookup table for maximum 60fps performance
    const lutSize = 256;
    const colorLut: [number, number, number][] = new Array(lutSize);
    for (let i = 0; i < lutSize; i++) {
      const t = i / (lutSize - 1);
      // Remap t to emphasize high-severity damage zone
      const colorStr = d3.interpolateInferno(Math.pow(t, 0.85));
      const rgb = d3.rgb(colorStr);
      colorLut[i] = [rgb.r, rgb.g, rgb.b];
    }

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const alphaVal = data[i + 3];
      if (alphaVal > 10) {
        const lutIdx = Math.min(255, Math.floor((alphaVal / 255) * 255));
        const [r, g, b] = colorLut[lutIdx];
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        // Non-linear transparency curve: faint peripheries, punchy hot core
        data[i + 3] = Math.min(235, Math.floor(Math.pow(alphaVal / 255, 0.75) * 220));
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Pass 3: Draw D3 contour elevation rings at peak zones
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    this.points
      .filter((pt) => pt.intensity >= 0.7)
      .forEach((pt) => {
        const layerPt = map.latLngToLayerPoint([pt.lat, pt.lng]);
        const x = layerPt.x - topLeft.x;
        const y = layerPt.y - topLeft.y;
        const ringRadius = Math.round(baseRadius * 0.45);
        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
    ctx.restore();
  }
}
