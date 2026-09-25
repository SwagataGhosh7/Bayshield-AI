import React, { useState, useMemo } from 'react';
import {
  EvacuationRoute,
  EvacuationOrigin,
  EvacuationDestination,
  RouteObjective,
} from '../types/cyclone';
import {
  EVACUATION_ORIGINS,
  EVACUATION_DESTINATIONS,
  calculateEvacuationRoutes,
} from '../services/evacuationRouting';
import {
  Navigation,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Car,
  Truck,
  Bus,
  ChevronRight,
  ArrowRight,
  Layers,
  Radio,
  Sliders,
  MapPin,
  Compass,
  X,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface EvacuationRoutePlannerProps {
  totalWaterLevel: number;
  windSpeedKmh: number;
  activeRoute: EvacuationRoute | null;
  onSelectRoute: (route: EvacuationRoute | null) => void;
  onClose?: () => void;
}

export const EvacuationRoutePlanner: React.FC<EvacuationRoutePlannerProps> = ({
  totalWaterLevel,
  windSpeedKmh,
  activeRoute,
  onSelectRoute,
  onClose,
}) => {
  const [selectedOriginId, setSelectedOriginId] = useState<string>(EVACUATION_ORIGINS[0].id);
  const [selectedDestId, setSelectedDestId] = useState<string>(EVACUATION_DESTINATIONS[0].id);
  const [objective, setObjective] = useState<RouteObjective>('safest');
  const [broadcastSent, setBroadcastSent] = useState(false);

  // Recalculate routes dynamically based on active origin, destination, water level, and wind speed
  const routeResult = useMemo(() => {
    return calculateEvacuationRoutes({
      originId: selectedOriginId,
      destinationId: selectedDestId,
      totalWaterLevel,
      windSpeedKmh,
      objective,
    });
  }, [selectedOriginId, selectedDestId, totalWaterLevel, windSpeedKmh, objective]);

  // Set the default selected route when result changes if activeRoute is not yet selected
  React.useEffect(() => {
    if (!activeRoute) {
      const rec =
        routeResult.routes.find((r) => r.id === routeResult.recommendedRouteId) ||
        routeResult.routes[0];
      onSelectRoute(rec);
    }
  }, [routeResult.recommendedRouteId]);

  const currentRoute = activeRoute || routeResult.routes[0];

  const handleBroadcast = () => {
    setBroadcastSent(true);
    setTimeout(() => setBroadcastSent(false), 4000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-200 overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              Automated Evacuation Router
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                Live Dynamic
              </span>
            </h3>
            <div className="text-[11px] text-slate-400">
              Real-time surge bathymetry, road closures & traffic congestion
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Origin & Destination Selectors */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
          {/* Origin Selector */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium flex items-center justify-between mb-1">
              <span className="flex items-center gap-1 text-rose-300">
                <MapPin className="w-3 h-3 text-rose-400" />
                Evacuation Origin (Littoral Exposure Zone)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {routeResult.origin.populationAtRisk.toLocaleString()} at risk
              </span>
            </label>
            <select
              value={selectedOriginId}
              onChange={(e) => {
                setSelectedOriginId(e.target.value);
                onSelectRoute(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              {EVACUATION_ORIGINS.map((origin) => (
                <option key={origin.id} value={origin.id}>
                  {origin.name} ({origin.region}) — {origin.meanElevationMeters}m ASL
                </option>
              ))}
            </select>
          </div>

          {/* Destination Selector */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium flex items-center justify-between mb-1">
              <span className="flex items-center gap-1 text-emerald-300">
                <Shield className="w-3 h-3 text-emerald-400" />
                Safe Inland Destination (Relief Hub)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Capacity: {routeResult.destination.capacity.toLocaleString()}
              </span>
            </label>
            <select
              value={selectedDestId}
              onChange={(e) => {
                setSelectedDestId(e.target.value);
                onSelectRoute(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              {EVACUATION_DESTINATIONS.map((dest) => (
                <option key={dest.id} value={dest.id}>
                  {dest.name} — Elev: {dest.elevationMeters}m ASL (Occ: {dest.currentOccupancy.toLocaleString()}/{dest.capacity.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Objective Mode Switcher */}
          <div className="pt-1">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Routing Optimization Objective:
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'safest', label: 'Safest Ridge', icon: Shield },
                { id: 'fastest', label: 'Fastest Direct', icon: Clock },
                { id: 'balanced', label: 'Balanced', icon: Sliders },
              ].map((m) => {
                const Icon = m.icon;
                const active = objective === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setObjective(m.id as RouteObjective);
                      onSelectRoute(null);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition ${
                      active
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Calculated Routes List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Calculated Route Options ({routeResult.routes.length})
            </span>
            <span className="text-cyan-400 font-mono text-[10px]">
              Surge: {totalWaterLevel.toFixed(1)}m TWL
            </span>
          </div>

          {routeResult.routes.map((route) => {
            const isSelected = currentRoute.id === route.id;
            const isRecommended = routeResult.recommendedRouteId === route.id;

            return (
              <div
                key={route.id}
                onClick={() => onSelectRoute(route)}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-400 ring-1 ring-cyan-400/50 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Route Title & Badge */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                      {route.type === 'safest' && <Shield className="w-3.5 h-3.5 text-emerald-400" />}
                      {route.type === 'fastest' && <Clock className="w-3.5 h-3.5 text-cyan-400" />}
                      {route.type === 'alternative' && <RefreshCw className="w-3.5 h-3.5 text-amber-400" />}
                      {route.name}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {route.originName} → {route.destinationName}
                    </div>
                  </div>

                  {isRecommended && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0">
                      Recommended
                    </span>
                  )}
                </div>

                {/* Primary Metrics Grid */}
                <div className="grid grid-cols-4 gap-1 text-center bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 text-[11px]">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Distance</div>
                    <div className="font-mono font-bold text-slate-200">{route.totalDistanceKm} km</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Est. Time</div>
                    <div className="font-mono font-bold text-cyan-300">
                      {Math.floor(route.totalMinutes / 60)}h {route.totalMinutes % 60}m
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Safety Score</div>
                    <div
                      className={`font-mono font-bold ${
                        route.safetyScore >= 85
                          ? 'text-emerald-400'
                          : route.safetyScore >= 65
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {route.safetyScore}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Max Flood</div>
                    <div
                      className={`font-mono font-bold ${
                        route.maxSurgeExposureMeters > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {route.maxSurgeExposureMeters > 0
                        ? `+${route.maxSurgeExposureMeters}m`
                        : '0.0m (Dry)'}
                    </div>
                  </div>
                </div>

                {/* Congestion & Status Bar */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Traffic Congestion:</span>
                    <span
                      className={`font-bold capitalize ${
                        route.congestionIndex === 'gridlock'
                          ? 'text-rose-400'
                          : route.congestionIndex === 'heavy'
                          ? 'text-orange-400'
                          : route.congestionIndex === 'moderate'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {route.congestionIndex}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        route.overallStatus === 'clear'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : route.overallStatus === 'caution'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {route.overallStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Route Turn-by-Turn Leg & Hazard Details */}
        <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Route Corridors & Chokepoint Hazards
            </span>
            <span className="text-[10px] text-slate-400">
              {currentRoute.legs.length} Corridor Legs
            </span>
          </div>

          {/* Leg Segments */}
          <div className="space-y-1.5">
            {currentRoute.legs.map((leg, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between font-medium text-slate-200">
                  <span className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    {leg.fromName} → {leg.toName}
                  </span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {leg.distanceKm} km ({leg.estimatedMinutes}m)
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pl-5">
                  <span>Highway: <strong>{leg.highwayNumber}</strong></span>
                  <span>Elevation: <strong>{leg.roadElevationMeters}m</strong></span>
                  <span>
                    Flood Depth:{' '}
                    <strong
                      className={
                        leg.currentFloodDepthMeters > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }
                    >
                      {leg.currentFloodDepthMeters > 0
                        ? `+${leg.currentFloodDepthMeters}m`
                        : 'Clear (Dry)'}
                    </strong>
                  </span>
                  <span
                    className={`font-bold uppercase ${
                      leg.passability === 'open'
                        ? 'text-emerald-400'
                        : leg.passability === 'caution'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {leg.passability}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Hazard Warnings */}
          {currentRoute.hazards.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Active Tactical Hazards on Path ({currentRoute.hazards.length})
              </div>
              {currentRoute.hazards.map((h) => (
                <div
                  key={h.id}
                  className="p-2 rounded-lg bg-amber-950/30 border border-amber-900/60 text-[11px] space-y-0.5"
                >
                  <div className="font-semibold text-amber-200 flex items-center justify-between">
                    <span>{h.location}</span>
                    <span className="text-[9px] uppercase font-bold text-amber-400">
                      {h.severity} Alert
                    </span>
                  </div>
                  <div className="text-slate-300 text-[10px]">{h.description}</div>
                  <div className="text-amber-300/80 text-[10px] font-medium pt-0.5">
                    Directive: {h.mitigationAdvice}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommended Vehicles */}
          <div className="pt-2 border-t border-slate-800/80 text-[11px]">
            <div className="text-[10px] text-slate-400 uppercase mb-1">
              Authorized Vehicle Profiles:
            </div>
            <div className="flex flex-wrap gap-1">
              {currentRoute.recommendedVehicleTypes.map((v, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px] flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Emergency Broadcast & Field Dispatch Action */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-cyan-400" />
            Field Evacuation Convoy Directive
          </div>
          <div className="text-[11px] text-slate-400">
            Transmit automated route itinerary to district police escorts, NDRF convoy leaders, and public SMS cell broadcast.
          </div>

          <button
            onClick={handleBroadcast}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md ${
              broadcastSent
                ? 'bg-emerald-600 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 active:scale-98'
            }`}
          >
            {broadcastSent ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Dispatched to NDRF Convoys & Public SMS Gateway
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                Broadcast Route Directive to Field Units
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
