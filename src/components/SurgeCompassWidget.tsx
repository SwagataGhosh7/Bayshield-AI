import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { CycloneScenario, ForecastPoint } from '../types/cyclone';
import {
  Compass,
  Navigation,
  Wind,
  Waves,
  ChevronDown,
  ChevronUp,
  MapPin,
  Maximize2,
  Minimize2,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface SurgeCompassWidgetProps {
  scenario: CycloneScenario;
  timeOffset: number;
  totalWaterLevel: number;
  baseSurgeMeters?: number;
}

/**
 * Calculates great-circle or rhumb-line bearing in degrees (0-359) from (lat1, lng1) to (lat2, lng2)
 */
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(deltaLambda);
  const theta = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((theta + 360) % 360);
}

/**
 * Converts degree bearing (0-360) to 16-point cardinal compass string
 */
function bearingToCardinal(deg: number): string {
  const cardinals = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const idx = Math.round(deg / 22.5) % 16;
  return cardinals[idx];
}

export const SurgeCompassWidget: React.FC<SurgeCompassWidgetProps> = ({
  scenario,
  timeOffset,
  totalWaterLevel,
  baseSurgeMeters,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stop map pan, zoom, click, and wheel propagation to Leaflet
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Compute forward storm track bearing and surge vector direction
  const vectorData = useMemo(() => {
    const track = scenario.forecastTrack || [];
    const landfall = scenario.landfallCoordinates;

    // Find current track position or interpolate
    let currentPoint: ForecastPoint | undefined;
    let nextPoint: ForecastPoint | undefined;

    // Find closest point matching timeOffset
    const sortedTrack = [...track].sort((a, b) => a.timeOffsetHours - b.timeOffsetHours);
    for (let i = 0; i < sortedTrack.length; i++) {
      if (sortedTrack[i].timeOffsetHours <= timeOffset) {
        currentPoint = sortedTrack[i];
        nextPoint = sortedTrack[i + 1] || sortedTrack[i];
      }
    }

    if (!currentPoint) {
      currentPoint = sortedTrack[0] || {
        lat: scenario.currentCoordinates.lat,
        lng: scenario.currentCoordinates.lng,
      };
    }
    if (!nextPoint || nextPoint === currentPoint) {
      nextPoint = {
        lat: landfall.lat,
        lng: landfall.lng,
      } as ForecastPoint;
    }

    // Forward track translation bearing
    let trackBearing = calculateBearing(
      currentPoint.lat,
      currentPoint.lng,
      nextPoint.lat,
      nextPoint.lng
    );

    // If points are coincident or past landfall, aim towards landfall or inland decay vector
    if (isNaN(trackBearing) || (currentPoint.lat === nextPoint.lat && currentPoint.lng === nextPoint.lng)) {
      trackBearing = calculateBearing(
        scenario.currentCoordinates.lat,
        scenario.currentCoordinates.lng,
        landfall.lat,
        landfall.lng
      );
    }

    // Hydrodynamic Surge Thrust Vector:
    // In the Northern Hemisphere (Bay of Bengal), cyclonic counter-clockwise rotation
    // combines with translation speed to create peak onshore water forcing in the
    // Right-Front Quadrant (RFQ). Deflection into the coast is ~ +28° to +35°.
    const isPostLandfall = timeOffset > 0;
    const rfqDeflection = isPostLandfall ? 15 : 32;
    const surgeBearing = Math.round((trackBearing + rfqDeflection) % 360);
    const surgeCardinal = bearingToCardinal(surgeBearing);
    const trackCardinal = bearingToCardinal(trackBearing);

    // Shallow-water wave celerity: c = sqrt(g * h)
    const effectiveDepth = Math.max(0.8, totalWaterLevel);
    const celerityMps = Math.sqrt(9.81 * effectiveDepth);
    const celerityKmh = Math.round(celerityMps * 3.6);

    // Kinetic thrust force index (kN/m)
    const thrustKiloNewtons = Math.round(0.5 * 1025 * 9.81 * Math.pow(effectiveDepth, 2) / 1000);

    return {
      trackBearing,
      trackCardinal,
      surgeBearing,
      surgeCardinal,
      celerityKmh,
      thrustKiloNewtons,
      currentLat: currentPoint.lat,
      currentLng: currentPoint.lng,
      landfallLat: landfall.lat,
      landfallLng: landfall.lng,
      isPostLandfall,
    };
  }, [scenario, timeOffset, totalWaterLevel]);

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-6 left-4 z-20 select-none font-sans pointer-events-auto"
    >
      {isExpanded ? (
        /* Expanded Tactical Surge Compass Console */
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10 w-[240px] sm:w-[260px] transition-all duration-200">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-950/90 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Compass className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs text-slate-100 tracking-tight">Surge Vector</span>
              <span className="text-[10px] font-mono text-cyan-400 font-semibold px-1 rounded bg-cyan-950 border border-cyan-800/80">
                {vectorData.surgeCardinal}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowTooltip(!showTooltip)}
                className={`p-1 rounded hover:bg-slate-800 transition ${
                  showTooltip ? 'text-cyan-400' : 'text-slate-400'
                }`}
                title="Hydrodynamic Physics Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                title="Minimize Compass Widget"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Educational Physics Tooltip Drawer */}
          {showTooltip && (
            <div className="p-2.5 bg-slate-950/95 border-b border-slate-800 text-[10px] text-slate-300 space-y-1 animate-in fade-in">
              <div className="font-bold text-cyan-300 flex items-center gap-1">
                <Waves className="w-3 h-3 text-cyan-400" />
                <span>Right-Front Quadrant Dynamics</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                In Northern Hemisphere cyclones, rotational onshore winds align with forward translation speed, creating maximum sea-surface water pileup $\sim 30^\circ$ to the right of the storm track.
              </p>
            </div>
          )}

          {/* Main Instrument Display: Dial & Compass */}
          <div className="p-3 flex flex-col items-center justify-center space-y-2.5">
            {/* The Compass Dial */}
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-slate-700/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center">
              {/* Radial Degree Hash Rings */}
              <div className="absolute inset-1 rounded-full border border-slate-800/80 border-dashed" />
              <div className="absolute inset-2.5 rounded-full border border-cyan-500/10" />

              {/* Cardinal Labels */}
              <span className="absolute top-1 text-[9px] font-mono font-bold text-rose-400">N</span>
              <span className="absolute bottom-1 text-[9px] font-mono font-bold text-slate-400">S</span>
              <span className="absolute right-1.5 text-[9px] font-mono font-bold text-slate-400">E</span>
              <span className="absolute left-1.5 text-[9px] font-mono font-bold text-slate-400">W</span>

              {/* Minor Ordinal Indicators */}
              <span className="absolute top-3.5 right-3.5 text-[7px] font-mono text-slate-600">NE</span>
              <span className="absolute bottom-3.5 right-3.5 text-[7px] font-mono text-slate-600">SE</span>
              <span className="absolute bottom-3.5 left-3.5 text-[7px] font-mono text-slate-600">SW</span>
              <span className="absolute top-3.5 left-3.5 text-[7px] font-mono text-slate-600">NW</span>

              {/* Subtle Forward Track Heading Indicator Needle (Pale Grey/Blue) */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-500 ease-out"
                style={{ transform: `rotate(${vectorData.trackBearing}deg)` }}
                title={`Forward Storm Track: ${vectorData.trackBearing}° ${vectorData.trackCardinal}`}
              >
                <div className="w-0.5 h-14 bg-gradient-to-t from-transparent via-cyan-700/60 to-cyan-400/90 rounded-t-full -translate-y-4" />
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 absolute" />
              </div>

              {/* PRIMARY STORM SURGE THRUST VECTOR ARROW (Glowing Amber-Cyan Hydrodynamic Arrow) */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-700 ease-out z-10"
                style={{ transform: `rotate(${vectorData.surgeBearing}deg)` }}
              >
                {/* Arrow Vector Stem and Arrowhead */}
                <div className="relative flex flex-col items-center -translate-y-4">
                  {/* Glowing Arrow Head */}
                  <div
                    className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)] filter"
                  />
                  {/* Pulsing Energy Core */}
                  <div className="w-1.5 h-7 bg-gradient-to-t from-cyan-600 via-cyan-400 to-white rounded-b-full shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                </div>

                {/* Counterweight Tail */}
                <div className="absolute w-1 h-3 bg-rose-500/80 rounded-full translate-y-5" />
              </div>

              {/* Center Pivot Hub */}
              <div className="w-4 h-4 rounded-full bg-slate-900 border-2 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)] z-20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
              </div>
            </div>

            {/* Telemetry Metrics Readout */}
            <div className="w-full space-y-1.5">
              {/* Primary Bearing Box */}
              <div className="p-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Surge Direction</span>
                  <div className="font-mono text-sm font-extrabold text-cyan-300 flex items-baseline gap-1">
                    <span>{vectorData.surgeBearing.toString().padStart(3, '0')}°</span>
                    <span className="text-xs text-cyan-400">{vectorData.surgeCardinal}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Track Heading</span>
                  <div className="font-mono text-xs font-semibold text-slate-300">
                    {vectorData.trackBearing.toString().padStart(3, '0')}° {vectorData.trackCardinal}
                  </div>
                </div>
              </div>

              {/* Dynamic Kinetic Speed & Hydrodynamic Thrust */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[9px]">Wave Celerity</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {vectorData.celerityKmh} km/h
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[9px]">Hydro Thrust</span>
                  <span className="font-mono font-bold text-amber-400">
                    {vectorData.thrustKiloNewtons} kN/m
                  </span>
                </div>
              </div>

              {/* Landfall Vector Status Footer */}
              <div className="px-2 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between text-[9px] text-cyan-300 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  {timeOffset === 0
                    ? 'Landfall Peak Onshore Push'
                    : timeOffset < 0
                    ? `Pre-Landfall T${timeOffset}h`
                    : `Post-Landfall Decay T+${timeOffset}h`}
                </span>
                <span className="text-slate-400">{scenario.forwardSpeed} km/h fwd</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed Compact Circular Mini-Compass Badge */
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="group relative w-12 h-12 rounded-full bg-slate-900/95 hover:bg-slate-900 border-2 border-slate-700 hover:border-cyan-400 shadow-2xl flex items-center justify-center transition-all duration-150 active:scale-95 ring-1 ring-white/10"
          title={`Storm Surge Vector: ${vectorData.surgeBearing}° ${vectorData.surgeCardinal} — Click to expand full telemetry`}
        >
          {/* Rotating Arrow Indicator */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out pointer-events-none"
            style={{ transform: `rotate(${vectorData.surgeBearing}deg)` }}
          >
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[9px] border-b-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.9)] -translate-y-2.5" />
          </div>

          {/* Compass Icon Center Hub */}
          <Compass className="w-5 h-5 text-slate-300 group-hover:text-cyan-300 transition-colors" />

          {/* Mini Cardinal Pill Badge */}
          <div className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full bg-cyan-950 border border-cyan-700 text-[8px] font-mono font-bold text-cyan-300 shadow">
            {vectorData.surgeCardinal}
          </div>
        </button>
      )}
    </div>
  );
};
