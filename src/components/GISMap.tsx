import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CycloneScenario,
  InfrastructureNode,
  EvacuationCorridor,
  GEESatelliteFeed,
  CoastalSurgeZone,
  ZoneCalculatedRisk,
  EvacuationRoute,
  HistoricalCycloneEvent,
  MapStickyNote,
} from '../types/cyclone';
import { COASTAL_SURGE_ZONES } from '../data/cycloneScenarios';
import { evaluateNodeVulnerability, calculateZoneSurgeRisk } from '../services/surgePhysics';
import { InteractiveMapLegend } from './InteractiveMapLegend';
import {
  generateDamageHeatmapPoints,
  D3DamageHeatmapLayer,
} from '../services/d3DamageHeatmap';
import { calculateAllZonesDensity } from '../services/spatialDensity';
import { STICKY_NOTE_COLORS, findNearestInfrastructureNode } from '../services/stickyNotesService';
import { SurgeCompassWidget } from './SurgeCompassWidget';
import {
  Layers,
  MapPin,
  Eye,
  AlertTriangle,
  Zap,
  Shield,
  Activity,
  Trees,
  Maximize2,
  Waves,
  ShieldAlert,
  Users,
  ChevronRight,
  X,
  Compass,
  Navigation,
  History,
  Flame,
  StickyNote,
  Plus,
} from 'lucide-react';

interface GISMapProps {
  scenario: CycloneScenario;
  timeOffset: number;
  totalWaterLevel: number;
  infrastructure: InfrastructureNode[];
  corridors: EvacuationCorridor[];
  satelliteFeeds: GEESatelliteFeed[];
  selectedNode: InfrastructureNode | null;
  onSelectNode: (node: InfrastructureNode | null) => void;
  mangroveOverride: boolean;
  activeEvacuationRoute?: EvacuationRoute | null;
  onSelectEvacuationRoute?: (route: EvacuationRoute | null) => void;
  onToggleRoutePlanner?: () => void;
  historicalOverlayEvent?: HistoricalCycloneEvent | null;
  showHistoricalOverlay?: boolean;
  onToggleHistoricalOverlay?: (active: boolean) => void;
  onOpenHistoricalModal?: () => void;
  showDensityHeatmap?: boolean;
  onToggleDensityHeatmap?: () => void;
  stickyNotes?: MapStickyNote[];
  onAddStickyNote?: (coord: { lat: number; lng: number }, nodeName?: string, nodeId?: string) => void;
  onEditStickyNote?: (note: MapStickyNote) => void;
  onOpenStickyNotesList?: () => void;
}

export const GISMap: React.FC<GISMapProps> = ({
  scenario,
  timeOffset,
  totalWaterLevel,
  infrastructure,
  corridors,
  satelliteFeeds,
  selectedNode,
  onSelectNode,
  mangroveOverride,
  activeEvacuationRoute = null,
  onSelectEvacuationRoute,
  onToggleRoutePlanner,
  historicalOverlayEvent = null,
  showHistoricalOverlay = false,
  onToggleHistoricalOverlay,
  onOpenHistoricalModal,
  showDensityHeatmap = false,
  onToggleDensityHeatmap,
  stickyNotes = [],
  onAddStickyNote,
  onEditStickyNote,
  onOpenStickyNotesList,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [baseMapStyle, setBaseMapStyle] = useState<'dark' | 'satellite' | 'street'>('dark');
  
  // Layer toggles
  const [showCoastalRiskZones, setShowCoastalRiskZones] = useState(true);
  const [showDamageHeatmap, setShowDamageHeatmap] = useState(false);
  const [showSurgeZones, setShowSurgeZones] = useState(true);
  const [showMangroves, setShowMangroves] = useState(true);
  const [showInfrastructure, setShowInfrastructure] = useState(true);
  const [showCorridors, setShowCorridors] = useState(true);
  const [showWindRadius, setShowWindRadius] = useState(true);
  const [showEvacRoutes, setShowEvacRoutes] = useState(true);
  const [showStickyNotes, setShowStickyNotes] = useState(true);
  const [isPlacingStickyNote, setIsPlacingStickyNote] = useState(false);
  const [showSurgeCompass, setShowSurgeCompass] = useState(true);

  const isPlacingStickyNoteRef = useRef(false);
  const onAddStickyNoteRef = useRef(onAddStickyNote);
  isPlacingStickyNoteRef.current = isPlacingStickyNote;
  onAddStickyNoteRef.current = onAddStickyNote;

  const d3HeatmapLayerRef = useRef<D3DamageHeatmapLayer | null>(null);

  // Inspected Coastal Zone
  const [selectedZone, setSelectedZone] = useState<CoastalSurgeZone | null>(null);
  const [selectedZoneRisk, setSelectedZoneRisk] = useState<ZoneCalculatedRisk | null>(null);
  const [activeLegendFilter, setActiveLegendFilter] = useState<string | null>(null);

  const [probedPoint, setProbedPoint] = useState<{
    lat: number;
    lng: number;
    estElevation: number;
    surgeDepth: number;
  } | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [scenario.landfallCoordinates.lat, scenario.landfallCoordinates.lng],
      zoom: 8,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial base layer (CartoDB Dark Matter)
    const tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
        maxZoom: 18,
      }
    ).addTo(map);

    (map as any)._currentTileLayer = tileLayer;

    const layersGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layersGroup;
    mapInstanceRef.current = map;

    // Interactive map click probe
    map.on('click', (e: L.LeafletMouseEvent) => {
      const origEvent = e.originalEvent;
      if (origEvent) {
        const target = origEvent.target as HTMLElement | null;
        if (target && target.closest('.interactive-map-legend, .leaflet-control, button, select, input, .no-map-click')) {
          return;
        }
      }
      const { lat, lng } = e.latlng;

      // Handle placing sticky note mode
      if (isPlacingStickyNoteRef.current && onAddStickyNoteRef.current) {
        const nearest = findNearestInfrastructureNode(lat, lng);
        onAddStickyNoteRef.current({ lat, lng }, nearest?.name, nearest?.id);
        setIsPlacingStickyNote(false);
        return;
      }

      // Synthesize coastal elevation based on distance from Bay
      const distFromCoastKm = Math.max(0, (lat - 21.4) * 110);
      const estElevation = Number(Math.max(0.6, distFromCoastKm * 0.08 + 1.2).toFixed(1));
      const surgeDepth = Number(Math.max(0, totalWaterLevel - estElevation).toFixed(2));
      setProbedPoint({ lat, lng, estElevation, surgeDepth });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Set map crosshair cursor when in sticky note placement mode
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    if (isPlacingStickyNote) {
      el.style.cursor = 'crosshair';
    } else {
      el.style.cursor = '';
    }
  }, [isPlacingStickyNote]);

  // Update base map tile when baseMapStyle changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if ((map as any)._currentTileLayer) {
      map.removeLayer((map as any)._currentTileLayer);
    }

    let url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    let attr = '&copy; CartoDB &copy; OpenStreetMap contributors';

    if (baseMapStyle === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = 'Tiles &copy; Esri, Earthstar Geographics';
    } else if (baseMapStyle === 'street') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attr = '&copy; OpenStreetMap contributors';
    }

    const newLayer = L.tileLayer(url, { attribution: attr, maxZoom: 18 }).addTo(map);
    (map as any)._currentTileLayer = newLayer;
  }, [baseMapStyle]);

  // Re-center map when scenario changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView([scenario.landfallCoordinates.lat, scenario.landfallCoordinates.lng], 8, {
      animate: true,
    });
    setSelectedZone(null);
    setSelectedZoneRisk(null);
  }, [scenario.id]);

  // Auto-focus on active route when selected
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeEvacuationRoute || activeEvacuationRoute.coordinates.length === 0) return;
    try {
      const bounds = L.latLngBounds(activeEvacuationRoute.coordinates);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10, animate: true });
    } catch (e) {
      console.warn('Could not fit bounds to route', e);
    }
  }, [activeEvacuationRoute?.id, activeEvacuationRoute?.originName]);

  // Render Geospatial Overlays
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Mangrove Barrier Bioshield Polygon (Sundarbans & Bhitarkanika)
    if (showMangroves) {
      const sundarbansPolygon: [number, number][] = [
        [21.55, 88.05],
        [21.85, 88.25],
        [22.15, 88.65],
        [22.25, 89.25],
        [22.05, 89.85],
        [21.65, 89.75],
        [21.52, 88.95],
        [21.55, 88.05],
      ];

      const bhitarkanikaPolygon: [number, number][] = [
        [20.55, 86.75],
        [20.75, 86.85],
        [20.85, 87.05],
        [20.65, 87.15],
        [20.55, 86.75],
      ];

      const mangroveStyle = {
        color: '#10b981',
        weight: 1.5,
        fillColor: '#059669',
        fillOpacity: mangroveOverride ? 0.35 : 0.15,
        dashArray: mangroveOverride ? undefined : '4, 4',
      };

      const sundarbansLayer = L.polygon(sundarbansPolygon, mangroveStyle);
      sundarbansLayer.bindTooltip(
        `<div class="p-1 text-xs">
          <strong>Sundarbans Mangrove Bioshield</strong><br/>
          Canopy Density: 84% (Rhizophora/Avicennia)<br/>
          Surge Dissipation: ${mangroveOverride ? '-0.85m Energy Damping (Active)' : 'Degraded (-0.2m)'}
        </div>`,
        { sticky: true }
      );
      layerGroup.addLayer(sundarbansLayer);

      const bhitarkanikaLayer = L.polygon(bhitarkanikaPolygon, mangroveStyle);
      bhitarkanikaLayer.bindTooltip(
        `<div class="p-1 text-xs">
          <strong>Bhitarkanika Bioshield Zone</strong><br/>
          Estuarine Mangrove Barrier (-0.7m Wave Damping)
        </div>`,
        { sticky: true }
      );
      layerGroup.addLayer(bhitarkanikaLayer);
    }

    // 2. Coastal Surge Risk Intensity Layer (Dynamic Multi-Zone Risk Modeling)
    if (showCoastalRiskZones && !showDensityHeatmap) {
      COASTAL_SURGE_ZONES.forEach((zone) => {
        const risk = calculateZoneSurgeRisk(zone, scenario, totalWaterLevel, mangroveOverride);

        // Dynamic risk color palette
        let strokeColor = '#10b981';
        let fillColor = '#059669';
        let fillOpacity = 0.22;
        let weight = 1.5;

        if (risk.riskLevel === 'CATASTROPHIC') {
          strokeColor = '#ef4444';
          fillColor = '#dc2626';
          fillOpacity = 0.58;
          weight = 2.8;
        } else if (risk.riskLevel === 'SEVERE') {
          strokeColor = '#f97316';
          fillColor = '#ea580c';
          fillOpacity = 0.48;
          weight = 2.2;
        } else if (risk.riskLevel === 'HIGH') {
          strokeColor = '#f59e0b';
          fillColor = '#d97706';
          fillOpacity = 0.38;
          weight = 1.8;
        } else if (risk.riskLevel === 'MODERATE') {
          strokeColor = '#eab308';
          fillColor = '#ca8a04';
          fillOpacity = 0.28;
          weight = 1.5;
        }

        const isRiskMatch =
          !activeLegendFilter ||
          risk.riskLevel.toLowerCase() === activeLegendFilter.toLowerCase();
        if (
          !isRiskMatch &&
          ['catastrophic', 'severe', 'moderate', 'low'].includes(
            (activeLegendFilter || '').toLowerCase()
          )
        ) {
          fillOpacity = 0.06;
          weight = 0.8;
        }

        const isSelected = selectedZone?.id === zone.id;
        if (isSelected) {
          strokeColor = '#38bdf8';
          weight = 3.5;
        }

        const zonePolygon = L.polygon(zone.polygon, {
          color: strokeColor,
          weight,
          fillColor,
          fillOpacity,
          dashArray: risk.riskLevel === 'CATASTROPHIC' ? '6, 3' : undefined,
        });

        // Interactive click event to inspect coastal zone
        zonePolygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedZone(zone);
          setSelectedZoneRisk(risk);
          map.panTo(zonePolygon.getBounds().getCenter(), { animate: true });
        });

        // Tooltip on hover
        zonePolygon.bindTooltip(
          `<div class="p-1.5 text-xs min-w-[210px] space-y-1">
            <div class="flex items-center justify-between border-b border-slate-700 pb-1">
              <strong class="text-slate-100 font-semibold">${zone.name}</strong>
              <span class="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                risk.riskLevel === 'CATASTROPHIC'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : risk.riskLevel === 'SEVERE'
                  ? 'bg-orange-950 text-orange-300 border border-orange-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }">${risk.riskLevel}</span>
            </div>
            <div class="text-[11px] text-slate-300">
              <div>Modeled Local Surge: <strong class="text-cyan-300">${risk.localSurgeMeters}m</strong></div>
              <div>Embankment Crest: <strong>${zone.embankmentHeightMeters}m</strong></div>
              <div>Overtopping Depth: <strong class="${risk.overtoppingDepthMeters > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}">
                ${risk.overtoppingDepthMeters > 0 ? `+${risk.overtoppingDepthMeters}m Breach` : 'Freeboard Safe'}
              </strong></div>
              <div>Risk Score: <strong class="text-slate-100">${risk.riskScore}/100</strong> · Breach Prob: <strong>${risk.breachProbabilityPercent}%</strong></div>
              <div>Evacuees Required: <strong class="text-amber-300">${risk.evacueeCount.toLocaleString()}</strong> / ${zone.populationAtRisk.toLocaleString()}</div>
            </div>
            <div class="mt-1 pt-1 border-t border-slate-800 text-[10px] text-slate-400 italic">
              Click zone to inspect action plan & embankment metrics
            </div>
          </div>`,
          { sticky: true }
        );

        layerGroup.addLayer(zonePolygon);

        // Centroid Badge Marker showing Zone Name & Risk Badge
        const centroid = zonePolygon.getBounds().getCenter();
        const badgeIcon = L.divIcon({
          className: 'zone-centroid-badge',
          html: `
            <div class="px-2 py-0.5 rounded shadow-lg backdrop-blur-md text-[10px] font-bold border transition-transform hover:scale-110 flex items-center gap-1 cursor-pointer"
                 style="background: rgba(15, 23, 42, 0.88); border-color: ${strokeColor}; color: #f8fafc;">
              <span>${zone.name.split(' ')[0]}</span>
              <span class="px-1 py-0.2 rounded text-[9px] ${
                risk.riskLevel === 'CATASTROPHIC'
                  ? 'bg-rose-600 text-white'
                  : risk.riskLevel === 'SEVERE'
                  ? 'bg-orange-600 text-white'
                  : risk.riskLevel === 'HIGH'
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-600 text-white'
              }">${risk.localSurgeMeters}m</span>
            </div>
          `,
          iconSize: [85, 22],
          iconAnchor: [42, 11],
        });

        const badgeMarker = L.marker(centroid, { icon: badgeIcon });
        badgeMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedZone(zone);
          setSelectedZoneRisk(risk);
        });
        layerGroup.addLayer(badgeMarker);
      });
    }

    // 2.5 Critical Infrastructure Node Density Choropleth Overlay
    if (showDensityHeatmap) {
      const zoneDensities = calculateAllZonesDensity(
        COASTAL_SURGE_ZONES,
        infrastructure,
        totalWaterLevel,
        scenario.windSpeed
      );

      zoneDensities.forEach((zd) => {
        const isCluster = zd.densityLevel === 'CRITICAL_CLUSTER' || zd.densityLevel === 'HIGH';

        // Polygon Choropleth layer representing node density
        const choroPolygon = L.polygon(zd.polygon, {
          color: zd.densityBorderColor,
          weight: isCluster ? 3.5 : 2.2,
          fillColor: zd.densityColor,
          fillOpacity: zd.densityFillOpacity,
          dashArray: isCluster ? '6, 3' : undefined,
          className: 'density-choropleth-polygon',
        });

        choroPolygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          map.panTo(zd.centroid, { animate: true });
        });

        choroPolygon.bindTooltip(
          `<div class="p-2 text-xs min-w-[240px] space-y-1.5 font-sans">
            <div class="flex items-center justify-between border-b border-slate-700 pb-1">
              <strong class="text-slate-100 font-bold">${zd.zoneName}</strong>
              <span class="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                zd.densityLevel === 'CRITICAL_CLUSTER'
                  ? 'bg-rose-950 text-rose-300 border border-rose-700'
                  : zd.densityLevel === 'HIGH'
                  ? 'bg-red-950 text-red-300 border border-red-700'
                  : zd.densityLevel === 'MODERATE'
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-slate-800 text-slate-300'
              }">${zd.densityLevel.replace('_', ' ')}</span>
            </div>

            <div class="grid grid-cols-2 gap-1 text-[11px] bg-slate-950/70 p-1.5 rounded border border-slate-800">
              <div>High-Risk Assets: <strong class="text-rose-400 font-bold">${zd.highRiskNodes} / ${zd.totalNodes}</strong></div>
              <div>Compromised Ratio: <strong class="text-amber-300 font-bold">${Math.round(zd.densityRatio * 100)}%</strong></div>
            </div>

            <div class="text-[10px] text-slate-300 leading-snug">
              <strong class="text-cyan-400">Directive:</strong> ${zd.operationalMandate}
            </div>

            ${
              zd.compromisedNodes.length > 0
                ? `<div class="mt-1 pt-1 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5">
                    <div class="font-semibold text-slate-300">Compromised Facilities:</div>
                    ${zd.compromisedNodes
                      .slice(0, 3)
                      .map(
                        (n) => `<div>• ${n.name} (${n.riskScore}% risk | +${n.floodDepthMeters}m flood)</div>`
                      )
                      .join('')}
                    ${zd.compromisedNodes.length > 3 ? `<div class="italic text-[9px]">+ ${zd.compromisedNodes.length - 3} more facilities...</div>` : ''}
                  </div>`
                : ''
            }
          </div>`,
          { sticky: true }
        );

        layerGroup.addLayer(choroPolygon);

        // Density Badge in the centroid of the zone
        const badgeIcon = L.divIcon({
          className: 'density-centroid-badge',
          html: `
            <div class="flex items-center justify-center select-none pointer-events-none">
              <div class="px-2 py-0.5 rounded shadow-2xl backdrop-blur-md border text-[10px] font-bold font-mono flex items-center gap-1.5 ${
                zd.densityLevel === 'CRITICAL_CLUSTER'
                  ? 'bg-rose-950/95 text-rose-200 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse'
                  : zd.densityLevel === 'HIGH'
                  ? 'bg-red-950/95 text-red-200 border-red-500'
                  : zd.densityLevel === 'MODERATE'
                  ? 'bg-orange-950/90 text-orange-200 border-orange-500'
                  : zd.densityLevel === 'LOW'
                  ? 'bg-amber-950/85 text-amber-200 border-amber-600'
                  : 'bg-slate-900/80 text-slate-400 border-slate-700'
              }">
                <span>${zd.highRiskNodes >= 4 ? '🔥' : '📍'}</span>
                <span>${zd.highRiskNodes} Critical</span>
                <span class="text-[9px] opacity-75">(${Math.round(zd.densityRatio * 100)}%)</span>
              </div>
            </div>
          `,
          iconSize: [110, 24],
          iconAnchor: [55, 12],
        });

        const badgeMarker = L.marker(zd.centroid, { icon: badgeIcon });
        layerGroup.addLayer(badgeMarker);
      });
    }

    // 3. Storm Surge Inundation Graded Depth Polygons (Bathymetric Inundation Swaths)
    if (showSurgeZones && totalWaterLevel > 0.5) {
      if (totalWaterLevel >= 3.5) {
        const deepSurgeCoords: [number, number][] = [
          [21.5, 88.0],
          [21.75, 88.1],
          [21.85, 88.35],
          [21.72, 88.55],
          [21.48, 88.35],
        ];
        const deepLayer = L.polygon(deepSurgeCoords, {
          color: '#ef4444',
          weight: 1.2,
          fillColor: '#dc2626',
          fillOpacity: 0.35,
          dashArray: '3, 3',
        });
        layerGroup.addLayer(deepLayer);
      }
    }

    // 4. Cyclone Trajectory & Forecast Track
    const trackPoints = scenario.forecastTrack;
    if (trackPoints.length > 0) {
      const latLngs: [number, number][] = trackPoints.map((p) => [p.lat, p.lng]);

      const trackLine = L.polyline(latLngs, {
        color: '#38bdf8',
        weight: 3,
        dashArray: '6, 6',
        opacity: 0.8,
      });
      layerGroup.addLayer(trackLine);

      // Interpolate current cyclone position based on timeOffset
      let activePos = { lat: scenario.currentCoordinates.lat, lng: scenario.currentCoordinates.lng };
      if (trackPoints.length >= 2) {
        const sorted = [...trackPoints].sort((a, b) => a.timeOffsetHours - b.timeOffsetHours);
        const nextIdx = sorted.findIndex((p) => p.timeOffsetHours >= timeOffset);
        if (nextIdx > 0) {
          const p1 = sorted[nextIdx - 1];
          const p2 = sorted[nextIdx];
          const ratio = (timeOffset - p1.timeOffsetHours) / Math.max(1, p2.timeOffsetHours - p1.timeOffsetHours);
          activePos = {
            lat: p1.lat + (p2.lat - p1.lat) * ratio,
            lng: p1.lng + (p2.lng - p1.lng) * ratio,
          };
        } else if (nextIdx === 0) {
          activePos = { lat: sorted[0].lat, lng: sorted[0].lng };
        } else {
          activePos = { lat: sorted[sorted.length - 1].lat, lng: sorted[sorted.length - 1].lng };
        }
      }

      // Animated Cyclone Eye Marker
      const eyeIcon = L.divIcon({
        className: 'cyclone-eye-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-12 h-12 rounded-full border border-cyan-400 animate-ping opacity-60"></div>
            <div class="absolute w-9 h-9 rounded-full bg-cyan-500/20 border-2 border-cyan-400"></div>
            <div class="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_12px_#38bdf8] flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const eyeMarker = L.marker([activePos.lat, activePos.lng], { icon: eyeIcon });
      eyeMarker.bindPopup(`
        <div class="text-xs leading-relaxed">
          <div class="font-bold text-cyan-400 text-sm">${scenario.name}</div>
          <div class="text-slate-400">${scenario.category}</div>
          <div class="mt-2 text-slate-200">
            <strong>Sustained Winds:</strong> ${scenario.windSpeed} km/h (Gusts: ${scenario.gusts} km/h)<br/>
            <strong>Central Pressure:</strong> ${scenario.centralPressure} hPa<br/>
            <strong>Current Surge Potential:</strong> ${totalWaterLevel.toFixed(1)}m<br/>
            <strong>Time Offset:</strong> ${timeOffset}h to Landfall
          </div>
        </div>
      `);
      layerGroup.addLayer(eyeMarker);

      // Wind Radius Rings
      if (showWindRadius) {
        const r64 = L.circle([activePos.lat, activePos.lng], {
          radius: (scenario.rmaxKm || 45) * 1000,
          color: '#ef4444',
          weight: 1.2,
          fillColor: '#dc2626',
          fillOpacity: 0.1,
        });
        r64.bindTooltip('64-knot Hurricane Core', { sticky: true });
        layerGroup.addLayer(r64);

        const r34 = L.circle([activePos.lat, activePos.lng], {
          radius: (scenario.rmaxKm ? scenario.rmaxKm * 3.2 : 150) * 1000,
          color: '#38bdf8',
          weight: 1,
          dashArray: '5, 5',
          fillColor: '#0284c7',
          fillOpacity: 0.04,
        });
        r34.bindTooltip('34-knot Gale Force Wind Field', { sticky: true });
        layerGroup.addLayer(r34);
      }
    }

    // 5. Evacuation Corridors & Road Arteries
    if (showCorridors) {
      corridors.forEach((corridor) => {
        let corridorColor = '#22c55e';
        if (corridor.passability === 'caution') corridorColor = '#f59e0b';
        if (corridor.passability === 'impassable') corridorColor = '#ef4444';

        const line = L.polyline(corridor.coordinates, {
          color: corridorColor,
          weight: corridor.passability === 'impassable' ? 4 : 3,
          dashArray: corridor.passability === 'impassable' ? '8, 8' : undefined,
          opacity: 0.9,
        });

        line.bindPopup(`
          <div class="text-xs">
            <div class="font-bold text-sm text-slate-100">${corridor.name}</div>
            <div class="text-slate-400">${corridor.highwayNumber} (${corridor.from} → ${corridor.to})</div>
            <div class="mt-2">
              <span class="font-medium">Status:</span> 
              <span class="font-bold uppercase ${
                corridor.passability === 'impassable'
                  ? 'text-red-400'
                  : corridor.passability === 'caution'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }">${corridor.passability}</span><br/>
              <strong>Elevation:</strong> ${corridor.elevationMeters}m<br/>
              <strong>Vulnerable Culverts:</strong> ${corridor.culvertRiskCount} locations<br/>
              <strong>Evacuation Throughput:</strong> ${corridor.evacuationCapacityVehiclesPerHour} veh/hr
            </div>
          </div>
        `);
        layerGroup.addLayer(line);
      });
    }

    // 6. Critical Infrastructure Nodes
    if (showInfrastructure) {
      infrastructure.forEach((node) => {
        const evalResult = evaluateNodeVulnerability(node, totalWaterLevel, scenario.windSpeed);

        let iconBg = '#0284c7';
        let borderClr = '#38bdf8';
        if (evalResult.status === 'de_energized' || evalResult.status === 'critical') {
          iconBg = '#dc2626';
          borderClr = '#f87171';
        } else if (evalResult.status === 'warning' || evalResult.status === 'flooded') {
          iconBg = '#d97706';
          borderClr = '#fbbf24';
        }

        let symbolChar = '⚡';
        if (node.type === 'hospital') symbolChar = '✚';
        if (node.type === 'shelter') symbolChar = '⌂';
        if (node.type === 'road') symbolChar = '🛣';
        if (node.type === 'port') symbolChar = '⚓';
        if (node.type === 'water_plant') symbolChar = '💧';

        const isTypeFilterActive = [
          'substation',
          'road',
          'shelter',
          'hospital',
          'water_plant',
          'port',
        ].includes(activeLegendFilter || '');
        const isMatch = !isTypeFilterActive || node.type === activeLegendFilter;
        const opacityClass = !isMatch ? 'opacity-20 scale-75' : '';
        const highlightClass = isTypeFilterActive && isMatch ? 'scale-125 ring-4 ring-cyan-400/80 shadow-[0_0_15px_#38bdf8]' : '';

        const customMarker = L.divIcon({
          className: 'infra-marker',
          html: `
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg transition-all duration-300 hover:scale-125 ${opacityClass} ${highlightClass}"
                 style="background-color: ${iconBg}; border: 2px solid ${borderClr}; color: #ffffff;">
              <span>${symbolChar}</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([node.lat, node.lng], { icon: customMarker });
        marker.on('click', () => {
          if (isPlacingStickyNoteRef.current && onAddStickyNoteRef.current) {
            onAddStickyNoteRef.current({ lat: node.lat, lng: node.lng }, node.name, node.id);
            setIsPlacingStickyNote(false);
            return;
          }
          onSelectNode(node);
        });

        marker.bindPopup(`
          <div class="text-xs p-1">
            <div class="font-bold text-sm text-slate-100">${node.name}</div>
            <div class="text-slate-400 capitalize">${node.type.replace('_', ' ')} · ${node.district}</div>
            <div class="mt-2 space-y-1 text-slate-200">
              <div><strong>Elevation:</strong> ${node.elevationMeters}m | <strong>Critical Threshold:</strong> ${node.floodCriticalHeightMeters}m</div>
              <div><strong>Modeled Water Level:</strong> ${totalWaterLevel.toFixed(1)}m</div>
              <div><strong>Calculated Flood Depth:</strong> 
                <span class="font-bold ${evalResult.floodDepthMeters > 0 ? 'text-rose-400' : 'text-emerald-400'}">
                  ${evalResult.floodDepthMeters > 0 ? `+${evalResult.floodDepthMeters}m` : 'Dry (0.0m)'}
                </span>
              </div>
              <div><strong>Operational Risk:</strong> 
                <span class="font-bold ${evalResult.riskScore >= 75 ? 'text-rose-400' : evalResult.riskScore >= 45 ? 'text-amber-400' : 'text-emerald-400'}">
                  ${evalResult.riskScore}/100 (${evalResult.status.toUpperCase()})
                </span>
              </div>
            </div>
            <div class="mt-2 p-1.5 bg-slate-900 border border-slate-700 text-slate-300 rounded text-[11px] leading-tight">
              <strong>Action:</strong> ${evalResult.urgentRecommendation}
            </div>
            <button onclick="window._openStickyNoteModalForNode && window._openStickyNoteModalForNode('${node.id}')"
                    class="mt-2 w-full py-1 px-2 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/70 text-amber-300 font-bold text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer">
              <span>📝 Add Sticky Note Annotation</span>
            </button>
          </div>
        `);

        layerGroup.addLayer(marker);
      });
    }

    // 7. GEE Satellite Imagery & Radar Simulation Overlays
    const activeFeeds = satelliteFeeds.filter((f) => f.active);
    activeFeeds.forEach((feed) => {
      if (feed.id === 'gpm_rain') {
        const rainCoords: [number, number][] = [
          [20.8, 87.5],
          [21.6, 88.2],
          [22.5, 88.8],
          [23.1, 89.2],
        ];
        const rainSwath = L.polyline(rainCoords, {
          color: '#06b6d4',
          weight: 35,
          opacity: 0.22,
          lineCap: 'round',
        });
        rainSwath.bindTooltip('GPM Multi-Satellite Radar Rainband: >50 mm/hr core deluge', {
          sticky: true,
        });
        layerGroup.addLayer(rainSwath);
      }
    });

    // 8. Automated Safe & Fast Evacuation Route Overlay
    if (showEvacRoutes && activeEvacuationRoute && activeEvacuationRoute.coordinates.length > 0) {
      const coords = activeEvacuationRoute.coordinates;
      const isSafest = activeEvacuationRoute.type === 'safest';
      const isFastest = activeEvacuationRoute.type === 'fastest';

      const mainColor = isSafest ? '#10b981' : isFastest ? '#38bdf8' : '#f59e0b';

      // Soft glow background line
      const glowLine = L.polyline(coords, {
        color: mainColor,
        weight: 10,
        opacity: 0.35,
        lineCap: 'round',
      });
      layerGroup.addLayer(glowLine);

      // Core route polyline
      const routeLine = L.polyline(coords, {
        color: mainColor,
        weight: 4.5,
        opacity: 0.95,
        dashArray: isSafest ? undefined : '10, 6',
      });

      routeLine.bindTooltip(
        `<div class="p-1.5 text-xs min-w-[210px] space-y-1">
          <div class="font-bold text-slate-100 flex items-center gap-1.5 border-b border-slate-700 pb-1">
            <span class="text-cyan-400">🧭</span>
            <span>${activeEvacuationRoute.name}</span>
          </div>
          <div class="text-[11px] text-slate-300 space-y-0.5">
            <div>Distance: <strong>${activeEvacuationRoute.totalDistanceKm} km</strong> · Time: <strong>${Math.floor(activeEvacuationRoute.totalMinutes / 60)}h ${activeEvacuationRoute.totalMinutes % 60}m</strong></div>
            <div>Safety Score: <strong class="text-emerald-400 font-bold">${activeEvacuationRoute.safetyScore}%</strong> · Congestion: <strong>${activeEvacuationRoute.congestionIndex.toUpperCase()}</strong></div>
            <div>Max Surge Ponding: <strong class="${activeEvacuationRoute.maxSurgeExposureMeters > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}">${activeEvacuationRoute.maxSurgeExposureMeters > 0 ? `+${activeEvacuationRoute.maxSurgeExposureMeters}m` : '0.0m (Dry)'}</strong></div>
          </div>
        </div>`,
        { sticky: true }
      );
      layerGroup.addLayer(routeLine);

      // Origin Marker
      const originCoord = coords[0];
      const originIcon = L.divIcon({
        className: 'route-origin-pin',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-7 h-7 rounded-full bg-rose-500/40 animate-ping"></div>
            <div class="px-2 py-0.5 rounded shadow-xl bg-slate-950 border-2 border-rose-500 text-[10px] font-extrabold text-rose-300 whitespace-nowrap flex items-center gap-1">
              <span>📍 ORIGIN: ${activeEvacuationRoute.originName}</span>
            </div>
          </div>
        `,
        iconSize: [140, 24],
        iconAnchor: [70, 12],
      });
      const originMarker = L.marker(originCoord, { icon: originIcon });
      layerGroup.addLayer(originMarker);

      // Destination Marker
      const destCoord = coords[coords.length - 1];
      const destIcon = L.divIcon({
        className: 'route-dest-pin',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-7 h-7 rounded-full bg-emerald-500/40 animate-ping"></div>
            <div class="px-2 py-0.5 rounded shadow-xl bg-slate-950 border-2 border-emerald-400 text-[10px] font-extrabold text-emerald-300 whitespace-nowrap flex items-center gap-1">
              <span>🛡️ SHELTER: ${activeEvacuationRoute.destinationName}</span>
            </div>
          </div>
        `,
        iconSize: [160, 24],
        iconAnchor: [80, 12],
      });
      const destMarker = L.marker(destCoord, { icon: destIcon });
      layerGroup.addLayer(destMarker);

      // Hazards along the route
      activeEvacuationRoute.hazards.forEach((h) => {
        const hazardIcon = L.divIcon({
          className: 'route-hazard-icon',
          html: `
            <div class="w-6 h-6 rounded-full bg-amber-500/90 border-2 border-amber-200 text-slate-950 flex items-center justify-center text-xs font-bold shadow-lg animate-bounce">
              ⚠
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const hazardMarker = L.marker([h.lat, h.lng], { icon: hazardIcon });
        hazardMarker.bindPopup(`
          <div class="text-xs p-1">
            <div class="font-bold text-amber-400 text-sm flex items-center gap-1">
              <span>⚠ ${h.location}</span>
            </div>
            <div class="text-slate-300 mt-1">${h.description}</div>
            <div class="mt-1.5 p-1 rounded bg-amber-950/60 border border-amber-900 text-amber-200 text-[11px]">
              <strong>Mitigation:</strong> ${h.mitigationAdvice}
            </div>
          </div>
        `);
        layerGroup.addLayer(hazardMarker);
      });
    }

    // 9. Historical Cyclone Track & Landfall Overlay
    if (showHistoricalOverlay && historicalOverlayEvent && historicalOverlayEvent.trackCoordinates.length > 0) {
      const histCoords = historicalOverlayEvent.trackCoordinates;

      // Historical track line (distinct purple / violet with ambient glow)
      const histGlow = L.polyline(histCoords, {
        color: '#c084fc',
        weight: 9,
        opacity: 0.35,
        lineCap: 'round',
      });
      layerGroup.addLayer(histGlow);

      const histLine = L.polyline(histCoords, {
        color: '#a855f7',
        weight: 3.5,
        dashArray: '8, 8',
        opacity: 0.95,
      });

      histLine.bindTooltip(
        `<div class="p-1.5 text-xs min-w-[210px] space-y-1">
          <div class="font-bold text-purple-300 flex items-center gap-1.5 border-b border-purple-800/80 pb-1">
            <span>📜</span>
            <span>Historical: ${historicalOverlayEvent.name} (${historicalOverlayEvent.year})</span>
          </div>
          <div class="text-[11px] text-slate-300 space-y-0.5">
            <div>Category: <strong>${historicalOverlayEvent.category}</strong></div>
            <div>Peak TWL Surge: <strong class="text-purple-300 font-bold">${historicalOverlayEvent.totalWaterLevelMeters}m</strong> (Winds: ${historicalOverlayEvent.peakWindsKmh} km/h)</div>
            <div>Actual Economic Damage: <strong class="text-emerald-400 font-bold">$${historicalOverlayEvent.economicDamageBillionUsd}B USD</strong></div>
            <div>Substations Affected: <strong class="text-amber-300 font-bold">${historicalOverlayEvent.substationsAffected}</strong></div>
          </div>
        </div>`,
        { sticky: true }
      );
      layerGroup.addLayer(histLine);

      // Historical Landfall Marker
      const histLandfall = historicalOverlayEvent.landfallCoordinates;
      const histLandfallIcon = L.divIcon({
        className: 'hist-landfall-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-purple-600/40 border-2 border-purple-400 flex items-center justify-center text-xs shadow-xl animate-pulse">
              🌀
            </div>
            <div class="absolute -bottom-5 px-1.5 py-0.2 rounded shadow-md bg-purple-950 border border-purple-700 text-[9px] font-bold text-purple-200 whitespace-nowrap">
              ${historicalOverlayEvent.name} (${historicalOverlayEvent.year})
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const histMarker = L.marker([histLandfall.lat, histLandfall.lng], { icon: histLandfallIcon });
      histMarker.bindPopup(`
        <div class="p-1 text-xs">
          <div class="font-bold text-sm text-purple-300">${historicalOverlayEvent.name} (${historicalOverlayEvent.year})</div>
          <div class="text-slate-400 text-[11px]">${historicalOverlayEvent.timelineDates}</div>
          <div class="mt-2 space-y-1 text-slate-200">
            <div><strong>Historical Landfall:</strong> ${historicalOverlayEvent.landfallLocation}</div>
            <div><strong>Peak TWL Water Level:</strong> <span class="font-bold text-purple-300">${historicalOverlayEvent.totalWaterLevelMeters}m</span></div>
            <div><strong>Embankments Breached:</strong> <span class="text-rose-400 font-bold">${historicalOverlayEvent.embankmentBreachKm} km</span></div>
            <div><strong>Recorded Damage:</strong> <span class="text-emerald-400 font-bold">$${historicalOverlayEvent.economicDamageBillionUsd}B USD</span></div>
            <div><strong>Disruption Signature:</strong> ${historicalOverlayEvent.primaryDisruptionSignature}</div>
          </div>
        </div>
      `);
      layerGroup.addLayer(histMarker);
    }

    // 10. Session Map Sticky Notes Layer with Hover Tooltip Display & Click Actions
    if (showStickyNotes && stickyNotes && stickyNotes.length > 0) {
      stickyNotes.forEach((note) => {
        const theme = STICKY_NOTE_COLORS[note.color] || STICKY_NOTE_COLORS.yellow;
        const noteIcon = L.divIcon({
          className: 'sticky-note-marker',
          html: `
            <div class="relative group cursor-pointer transition-transform hover:scale-125 active:scale-95" style="width: 32px; height: 32px;" title="${note.title.replace(/"/g, '&quot;')}">
              <!-- Sticky note square body with folded paper dog-ear -->
              <div class="w-7 h-7 rounded-sm shadow-xl border flex items-center justify-center relative overflow-hidden"
                   style="background-color: ${theme.bgHex}; border-color: ${theme.borderHex}; color: ${theme.textHex};">
                <div style="position: absolute; top: 0; right: 0; width: 8px; height: 8px; background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.2) 50%), ${theme.headerBg}; border-bottom-left-radius: 2px;"></div>
                <span style="font-size: 13px; line-height: 1;">📝</span>
              </div>
              <!-- Pushpin indicator -->
              <div style="position: absolute; top: -5px; left: 10px; width: 6px; height: 6px; border-radius: 50%; background-color: #ef4444; border: 1px solid #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.6);"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [14, 28],
        });

        const noteMarker = L.marker([note.coordinates.lat, note.coordinates.lng], {
          icon: noteIcon,
          zIndexOffset: 1500,
        });

        // Hover Tooltip: Tactile Post-it card displaying note content, metadata, and coordinates
        const timeFormatted = new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const safeTitle = note.title.replace(/"/g, '&quot;');
        const safeContent = note.content.replace(/"/g, '&quot;');
        const safeAuthor = note.author.replace(/"/g, '&quot;');
        const safeNode = (note.nodeName || '').replace(/"/g, '&quot;');

        const tooltipHtml = `
          <div class="sticky-note-hover-card p-3 rounded-xl border shadow-2xl text-xs select-none max-w-[270px] min-w-[220px] relative overflow-hidden"
               style="background-color: ${theme.bgHex}; border-color: ${theme.borderHex}; color: ${theme.textHex}; font-family: system-ui, sans-serif;">
            <div style="position: absolute; top: 0; right: 0; width: 14px; height: 14px; background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.15) 50%), ${theme.headerBg}; border-bottom-left-radius: 4px;"></div>
            
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; margin-bottom: 4px; padding-right: 12px;">
              <strong style="font-size: 12px; font-weight: 700; line-height: 1.25;">${safeTitle}</strong>
              <span style="font-size: 8px; font-weight: 700; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; background-color: ${theme.badgeBg}; color: ${theme.badgeText}; white-space: nowrap;">
                ${note.priority.toUpperCase()}
              </span>
            </div>

            <div style="font-size: 10px; font-family: monospace; opacity: 0.85; margin-bottom: 6px;">
              ${safeNode ? `<div>📍 <strong>${safeNode}</strong></div>` : ''}
              <div>[${note.coordinates.lat.toFixed(3)}°N, ${note.coordinates.lng.toFixed(3)}°E]</div>
            </div>

            <div style="font-size: 11px; line-height: 1.4; margin-bottom: 8px; font-style: italic; white-space: pre-wrap; word-break: break-word;">
              "${safeContent}"
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; font-family: monospace; opacity: 0.8; border-top: 1px solid rgba(0,0,0,0.12); padding-top: 4px;">
              <span>By ${safeAuthor}</span>
              <span>${timeFormatted}</span>
            </div>
            <div style="font-size: 8px; text-align: center; margin-top: 3px; opacity: 0.6; font-style: italic;">
              Click marker to edit or remove note
            </div>
          </div>
        `;

        noteMarker.bindTooltip(tooltipHtml, {
          direction: 'top',
          offset: [0, -22],
          opacity: 1,
          className: 'sticky-note-leaflet-tooltip',
          sticky: false,
        });

        noteMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (onEditStickyNote) {
            onEditStickyNote(note);
          }
        });

        layerGroup.addLayer(noteMarker);
      });
    }

    // Register popup bridge for infrastructure add sticky note button
    (window as any)._openStickyNoteModalForNode = (id: string) => {
      const node = infrastructure.find((n) => n.id === id);
      if (node && onAddStickyNoteRef.current) {
        onAddStickyNoteRef.current({ lat: node.lat, lng: node.lng }, node.name, node.id);
      }
    };
  }, [
    scenario,
    timeOffset,
    totalWaterLevel,
    infrastructure,
    corridors,
    satelliteFeeds,
    showCoastalRiskZones,
    showSurgeZones,
    showMangroves,
    showInfrastructure,
    showCorridors,
    showWindRadius,
    showEvacRoutes,
    activeEvacuationRoute,
    mangroveOverride,
    selectedZone,
    activeLegendFilter,
    showHistoricalOverlay,
    historicalOverlayEvent,
    showDensityHeatmap,
    showStickyNotes,
    stickyNotes,
  ]);

  // Synchronize D3.js Dynamic Damage Heatmap Surface Layer in real-time
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!showDamageHeatmap) {
      if (d3HeatmapLayerRef.current) {
        map.removeLayer(d3HeatmapLayerRef.current);
        d3HeatmapLayerRef.current = null;
      }
      return;
    }

    const heatPoints = generateDamageHeatmapPoints({
      scenario,
      timeOffset,
      totalWaterLevel,
      infrastructure,
      mangroveOverride,
    });

    if (!d3HeatmapLayerRef.current) {
      const layer = new D3DamageHeatmapLayer(heatPoints);
      layer.addTo(map);
      d3HeatmapLayerRef.current = layer;
    } else {
      d3HeatmapLayerRef.current.updatePoints(heatPoints);
    }

    return () => {
      // Keep on unmount clean
    };
  }, [
    showDamageHeatmap,
    scenario,
    timeOffset,
    totalWaterLevel,
    infrastructure,
    mangroveOverride,
  ]);

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col bg-slate-950 overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-0 cursor-crosshair" />

      {/* Map Controls Floating Header Bar */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 border border-slate-800 rounded-lg text-xs shadow-xl">
        <span className="text-slate-400 font-medium flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          GIS Layers
        </span>
        <div className="h-3.5 w-px bg-slate-700 mx-1" />

        {/* Coastal Surge Risk Intensity Layer Toggle */}
        <button
          onClick={() => setShowCoastalRiskZones(!showCoastalRiskZones)}
          className={`px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1.5 ${
            showCoastalRiskZones
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Visualize localized surge intensity, embankment breach probability, and risk scores across coastal zones"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Surge Risk Intensity Zones
        </button>

        {/* D3 Dynamic Damage Heatmap Toggle (NEW FEATURE) */}
        <button
          onClick={() => setShowDamageHeatmap(!showDamageHeatmap)}
          className={`px-2.5 py-1 rounded transition-all font-medium flex items-center gap-1.5 ${
            showDamageHeatmap
              ? 'bg-orange-500/25 text-orange-300 border border-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.35)] ring-1 ring-orange-400/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="D3.js Dynamic Intensity Surface: Illustrates regional damage distribution synthesized in real-time with surge timeline"
        >
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span>Damage Heatmap</span>
          {showDamageHeatmap && (
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setShowSurgeZones(!showSurgeZones)}
          className={`px-2 py-1 rounded transition-colors ${
            showSurgeZones ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Bathymetric Swath
        </button>

        <button
          onClick={() => setShowMangroves(!showMangroves)}
          className={`px-2 py-1 rounded transition-colors ${
            showMangroves ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Mangrove Shield
        </button>

        <button
          onClick={() => setShowInfrastructure(!showInfrastructure)}
          className={`px-2 py-1 rounded transition-colors ${
            showInfrastructure ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Critical Assets
        </button>

        <button
          onClick={() => setShowCorridors(!showCorridors)}
          className={`px-2 py-1 rounded transition-colors ${
            showCorridors ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Evac Corridors
        </button>

        {/* Automated Evacuation Route Toggle */}
        <button
          onClick={() => {
            setShowEvacRoutes(!showEvacRoutes);
            if (onToggleRoutePlanner) onToggleRoutePlanner();
          }}
          className={`px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1.5 ${
            showEvacRoutes && activeEvacuationRoute
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Automated Evacuation Routes & Route Planner"
        >
          <Navigation className="w-3.5 h-3.5" />
          Evac Routes
          {activeEvacuationRoute && (
            <span className="ml-1 px-1 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono">
              {activeEvacuationRoute.totalDistanceKm}km
            </span>
          )}
        </button>

        {/* Historical Cyclone Track Overlay Toggle & Comparison */}
        <button
          onClick={() => {
            if (onOpenHistoricalModal) {
              onOpenHistoricalModal();
            } else if (onToggleHistoricalOverlay) {
              onToggleHistoricalOverlay(!showHistoricalOverlay);
            }
          }}
          className={`px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1.5 ${
            showHistoricalOverlay && historicalOverlayEvent
              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Compare with Historical Bay of Bengal Cyclone Events"
        >
          <History className="w-3.5 h-3.5 text-purple-400" />
          <span>Historical Track</span>
          {showHistoricalOverlay && historicalOverlayEvent && (
            <span className="ml-0.5 px-1 rounded bg-purple-950 text-purple-300 text-[10px] font-mono">
              {historicalOverlayEvent.name.split(' ')[1] || historicalOverlayEvent.year}
            </span>
          )}
        </button>

        <button
          onClick={() => setShowWindRadius(!showWindRadius)}
          className={`px-2 py-1 rounded transition-colors ${
            showWindRadius ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Wind Radii
        </button>

        {/* Sticky Notes Annotations Toolbar Controls */}
        <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/60">
          <button
            onClick={() => {
              if (onOpenStickyNotesList) {
                onOpenStickyNotesList();
              } else {
                setShowStickyNotes(!showStickyNotes);
              }
            }}
            className={`px-2 py-1 rounded transition-colors font-medium flex items-center gap-1.5 ${
              showStickyNotes && stickyNotes && stickyNotes.length > 0
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="View and Manage Session Map Sticky Notes"
          >
            <StickyNote className="w-3.5 h-3.5 text-amber-400" />
            <span>Sticky Notes</span>
            {stickyNotes && stickyNotes.length > 0 && (
              <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                {stickyNotes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsPlacingStickyNote(!isPlacingStickyNote)}
            className={`px-2 py-1 rounded transition-all font-semibold flex items-center gap-1 text-[11px] ${
              isPlacingStickyNote
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/60 ring-2 ring-amber-400/80 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
            }`}
            title={isPlacingStickyNote ? 'Click on map to place note, or click here to cancel' : 'Click to place a new Sticky Note on any coordinate'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isPlacingStickyNote ? 'Pinning...' : 'Add'}</span>
          </button>
        </div>

        {/* Surge Vector Compass Toggle */}
        <button
          onClick={() => setShowSurgeCompass(!showSurgeCompass)}
          className={`px-2 py-1 rounded transition-colors font-medium flex items-center gap-1.5 ${
            showSurgeCompass ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Storm Surge Vector Compass Widget"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Surge Compass</span>
        </button>

        <div className="h-3.5 w-px bg-slate-700 mx-1" />

        {/* Basemap Switcher */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded">
          <button
            onClick={() => setBaseMapStyle('dark')}
            className={`px-1.5 py-0.5 rounded ${
              baseMapStyle === 'dark' ? 'bg-slate-700 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => setBaseMapStyle('satellite')}
            className={`px-1.5 py-0.5 rounded ${
              baseMapStyle === 'satellite' ? 'bg-slate-700 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setBaseMapStyle('street')}
            className={`px-1.5 py-0.5 rounded ${
              baseMapStyle === 'street' ? 'bg-slate-700 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Topographic
          </button>
        </div>
      </div>

      {/* Coastal Zone Risk Inspector Card (When user clicks on any coastal zone) */}
      {selectedZone && selectedZoneRisk && (
        <div className="absolute top-16 left-3 z-10 bg-slate-900/95 backdrop-blur-md p-4 rounded-xl border border-slate-700 text-xs shadow-2xl max-w-sm animate-in fade-in zoom-in-95">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h4 className="font-bold text-sm text-slate-100">{selectedZone.name}</h4>
              </div>
              <div className="text-[11px] text-slate-400">{selectedZone.region}</div>
            </div>
            <button
              onClick={() => {
                setSelectedZone(null);
                setSelectedZoneRisk(null);
              }}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Risk Level & Score Badge */}
          <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 mb-2.5">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Inundation Threat Level</div>
              <div className={`font-extrabold text-sm ${
                selectedZoneRisk.riskLevel === 'CATASTROPHIC'
                  ? 'text-rose-400'
                  : selectedZoneRisk.riskLevel === 'SEVERE'
                  ? 'text-orange-400'
                  : 'text-amber-400'
              }`}>
                {selectedZoneRisk.riskLevel}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">Composite Risk Score</div>
              <div className="font-mono font-bold text-sm text-slate-100">
                {selectedZoneRisk.riskScore} <span className="text-slate-500 text-xs">/ 100</span>
              </div>
            </div>
          </div>

          {/* Water vs Embankment Comparative Visual */}
          <div className="space-y-1.5 mb-2.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Modeled Surge Level:</span>
              <strong className="text-cyan-300 font-mono">{selectedZoneRisk.localSurgeMeters}m</strong>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Embankment Design Crest:</span>
              <strong className="text-slate-300 font-mono">{selectedZone.embankmentHeightMeters}m</strong>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Crest Overtopping Depth:</span>
              <strong className={selectedZoneRisk.overtoppingDepthMeters > 0 ? 'text-rose-400 font-mono font-bold' : 'text-emerald-400 font-mono'}>
                {selectedZoneRisk.overtoppingDepthMeters > 0 ? `+${selectedZoneRisk.overtoppingDepthMeters}m breach depth` : 'Freeboard Safe (-0.4m)'}
              </strong>
            </div>

            {/* Progress Bar for Breach Probability */}
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Breach Probability:</span>
                <span className="font-mono font-bold text-rose-400">{selectedZoneRisk.breachProbabilityPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded"
                  style={{ width: `${selectedZoneRisk.breachProbabilityPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Evacuation Directive */}
          <div className="p-2 rounded bg-rose-950/40 border border-rose-900/60 mb-2">
            <div className="text-[10px] uppercase font-bold text-rose-300">Official Municipal Mandate:</div>
            <div className="text-xs text-rose-200 mt-0.5 font-medium leading-tight">
              {selectedZoneRisk.evacuationMandate}
            </div>
            <div className="mt-1 text-[11px] text-rose-300/80 flex items-center justify-between">
              <span>Target Relocation:</span>
              <strong>{selectedZoneRisk.evacueeCount.toLocaleString()} persons</strong>
            </div>
          </div>

          {/* Vulnerability factors */}
          <div className="space-y-1 text-[11px] text-slate-300">
            {selectedZoneRisk.keyVulnerabilities.map((v, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-cyan-400">•</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Probed Point Floating Card */}
      {probedPoint && !selectedZone && (
        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/95 backdrop-blur-md p-3 rounded-lg border border-slate-700 text-xs shadow-2xl max-w-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1 font-semibold text-cyan-400">
              <MapPin className="w-3.5 h-3.5" />
              Coastal Point Probe
            </span>
            <button
              onClick={() => setProbedPoint(null)}
              className="text-slate-500 hover:text-slate-300 px-1"
            >
              ✕
            </button>
          </div>
          <div className="text-slate-300 space-y-0.5">
            <div>Coords: {probedPoint.lat.toFixed(3)}°N, {probedPoint.lng.toFixed(3)}°E</div>
            <div>Estimated Elevation: <strong className="text-slate-100">{probedPoint.estElevation}m ASL</strong></div>
            <div>Modeled Water Level: <strong className="text-slate-100">{totalWaterLevel.toFixed(1)}m</strong></div>
            <div>Inundation Depth: 
              <span className={`ml-1 font-bold ${probedPoint.surgeDepth > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {probedPoint.surgeDepth > 0 ? `+${probedPoint.surgeDepth}m flood` : 'Above Water Level'}
              </span>
            </div>
            <button
              onClick={() => {
                if (onAddStickyNote) {
                  const nearest = findNearestInfrastructureNode(probedPoint.lat, probedPoint.lng);
                  onAddStickyNote({ lat: probedPoint.lat, lng: probedPoint.lng }, nearest?.name, nearest?.id);
                }
              }}
              className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-600/70 text-amber-300 font-bold text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <StickyNote className="w-3 h-3 text-amber-400" />
              <span>Pin Sticky Note at this Point</span>
            </button>
          </div>
        </div>
      )}

      {/* Critical Node Density Heatmap Floating Choropleth Legend */}
      {showDensityHeatmap && (
        <div className="absolute top-16 left-4 z-20 bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-rose-500/60 text-xs shadow-2xl max-w-xs space-y-2 pointer-events-auto ring-1 ring-rose-500/30 select-none animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-100">
              <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Critical Node Density Heatmap</span>
            </div>
            {onToggleDensityHeatmap && (
              <button
                onClick={onToggleDensityHeatmap}
                className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                title="Dismiss Density Heatmap Layer"
              >
                Close
              </button>
            )}
          </div>

          <div className="text-[10px] text-slate-400 leading-tight">
            Choropleth overlay representing spatial concentration of compromised facilities in high-risk zones.
          </div>

          <div className="space-y-1 text-[11px] pt-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#991b1b] border border-rose-400" />
                <span className="text-slate-300">Critical Cluster (6+ nodes)</span>
              </div>
              <span className="font-mono text-[10px] text-rose-300 font-bold">Severe</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#ef4444] border border-red-300" />
                <span className="text-slate-300">High Concentration (4-5 nodes)</span>
              </div>
              <span className="font-mono text-[10px] text-red-300 font-bold">High</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#f97316] border border-orange-300" />
                <span className="text-slate-300">Moderate Concentration (2-3 nodes)</span>
              </div>
              <span className="font-mono text-[10px] text-orange-300 font-medium">Moderate</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#eab308] border border-yellow-300" />
                <span className="text-slate-300">Low Concentration (1 node)</span>
              </div>
              <span className="font-mono text-[10px] text-yellow-300 font-medium">Low</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#334155] border border-slate-600" />
                <span className="text-slate-400">Safe / 0 Compromised</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">Normal</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Map Legend Component Overlay */}
      <InteractiveMapLegend
        totalWaterLevel={totalWaterLevel}
        activeFilter={activeLegendFilter}
        onSelectFilter={setActiveLegendFilter}
        mangroveOverride={mangroveOverride}
        showHeatmap={showDamageHeatmap}
        onToggleHeatmap={() => setShowDamageHeatmap(!showDamageHeatmap)}
      />

      {/* Mini-Compass Widget: Real-time Storm Surge Vector Direction & Dynamics */}
      {showSurgeCompass && (
        <SurgeCompassWidget
          scenario={scenario}
          timeOffset={timeOffset}
          totalWaterLevel={totalWaterLevel}
        />
      )}

      {/* Active Sticky Note Placement Mode Floating Banner */}
      {isPlacingStickyNote && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-950/95 border-2 border-amber-500 text-amber-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 animate-pulse text-xs backdrop-blur-md ring-1 ring-amber-400/50">
          <StickyNote className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Click anywhere on the map or an infrastructure facility to place a Sticky Note</span>
          <button
            onClick={() => setIsPlacingStickyNote(false)}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold transition ml-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
