import React, { useState } from 'react';
import {
  CycloneScenario,
  HistoricalCycloneEvent,
} from '../types/cyclone';
import { HISTORICAL_CYCLONES } from '../data/historicalCyclones';
import { compareHistoricalCyclone } from '../services/historicalComparison';
import {
  History,
  X,
  Waves,
  Wind,
  Gauge,
  DollarSign,
  Zap,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  MapPin,
  Compass,
} from 'lucide-react';

interface HistoricalComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScenario: CycloneScenario;
  totalWaterLevel: number;
  criticalSubstationsCount?: number;
  selectedHistoricalEvent: HistoricalCycloneEvent | null;
  onSelectHistoricalEvent: (event: HistoricalCycloneEvent | null) => void;
  isMapOverlayActive: boolean;
  onToggleMapOverlay: (active: boolean) => void;
}

export const HistoricalComparisonModal: React.FC<HistoricalComparisonModalProps> = ({
  isOpen,
  onClose,
  currentScenario,
  totalWaterLevel,
  criticalSubstationsCount = 4,
  selectedHistoricalEvent,
  onSelectHistoricalEvent,
  isMapOverlayActive,
  onToggleMapOverlay,
}) => {
  const [activeEventId, setActiveEventId] = useState<string>(
    selectedHistoricalEvent?.id || HISTORICAL_CYCLONES[0].id
  );

  if (!isOpen) return null;

  const currentHistorical =
    HISTORICAL_CYCLONES.find((h) => h.id === activeEventId) || HISTORICAL_CYCLONES[0];

  const comparison = compareHistoricalCyclone(
    currentScenario,
    totalWaterLevel,
    currentHistorical,
    criticalSubstationsCount
  );

  const handleSelectEvent = (event: HistoricalCycloneEvent) => {
    setActiveEventId(event.id);
    onSelectHistoricalEvent(event);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-100">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100">
                  Bay of Bengal Historical Cyclone Benchmark Comparison
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                  Multi-Decadal Audit
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Contrast storm surge bathymetry, grid substation exposures & physical damages
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Cyclone Selector Strip */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Select Historical Benchmark Event:</span>
              <span className="text-purple-400 font-mono text-[10px]">
                {HISTORICAL_CYCLONES.length} Major Landfalls Documented
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {HISTORICAL_CYCLONES.map((event) => {
                const isSelected = event.id === currentHistorical.id;
                return (
                  <button
                    key={event.id}
                    onClick={() => handleSelectEvent(event)}
                    className={`p-2 rounded-xl text-left border transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-950/60 border-purple-400 text-purple-200 ring-2 ring-purple-500/40 shadow-lg'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs truncate text-slate-100">
                        {event.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {event.month} {event.year}
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] font-semibold text-cyan-400">
                      TWL: {event.totalWaterLevelMeters}m
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map Overlay Action Strip */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-slate-200">GISMap Historical Track Overlay:</span>{' '}
                <span className="text-slate-400">
                  Render {currentHistorical.name} ({currentHistorical.year}) storm eye path on the map
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                const nextState = !isMapOverlayActive;
                onToggleMapOverlay(nextState);
                if (nextState) onSelectHistoricalEvent(currentHistorical);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
                isMapOverlayActive
                  ? 'bg-purple-600 hover:bg-purple-500 text-white ring-2 ring-purple-400/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {isMapOverlayActive ? 'Disable Map Overlay' : 'Overlay Historical Track on Map'}
            </button>
          </div>

          {/* Side-by-Side Comparison Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Active Current Scenario Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-3">
              <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                    Active Scenario
                  </span>
                  <h4 className="font-extrabold text-base text-slate-100 flex items-center gap-1.5">
                    {currentScenario.name}
                  </h4>
                  <div className="text-[11px] text-slate-400">{currentScenario.category}</div>
                </div>
                <div className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-xs font-mono font-bold">
                  Target: {currentScenario.landfallTarget.split('(')[0]}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                    <Waves className="w-3 h-3 text-cyan-400" />
                    Peak Total Water Level
                  </div>
                  <div className="text-xl font-extrabold font-mono text-cyan-300">
                    {totalWaterLevel.toFixed(1)}m <span className="text-xs font-normal text-slate-400">TWL</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Surge: {currentScenario.peakSurge}m + Tide
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                    <Wind className="w-3 h-3 text-rose-400" />
                    Sustained Max Winds
                  </div>
                  <div className="text-xl font-extrabold font-mono text-rose-300">
                    {currentScenario.windSpeed} <span className="text-xs font-normal text-slate-400">km/h</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Gusts: {currentScenario.gusts} km/h
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-amber-400" />
                    Central Pressure
                  </div>
                  <div className="text-base font-extrabold font-mono text-amber-300">
                    {currentScenario.centralPressure} <span className="text-xs font-normal text-slate-400">hPa</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Core Barometric Minimum</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Critical Substations
                  </div>
                  <div className="text-base font-extrabold font-mono text-amber-300">
                    {criticalSubstationsCount} Nodes <span className="text-xs font-normal text-slate-400">At Risk</span>
                  </div>
                  <div className="text-[10px] text-slate-500">132kV/33kV Switchyards</div>
                </div>
              </div>

              {/* Loss Estimation */}
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Modeled Economic Loss:
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ${comparison.modeledCurrentEconomicLossBillion}B USD
                </span>
              </div>
            </div>

            {/* Selected Historical Benchmark Event Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-3">
              <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                    Historical Benchmark
                  </span>
                  <h4 className="font-extrabold text-base text-slate-100 flex items-center gap-1.5">
                    {currentHistorical.name}
                  </h4>
                  <div className="text-[11px] text-slate-400">
                    {currentHistorical.timelineDates} · {currentHistorical.category}
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono font-bold">
                  {currentHistorical.year}
                </div>
              </div>

              {/* Metrics with Delta Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Waves className="w-3 h-3 text-cyan-400" />
                      Peak TWL Surge
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1 rounded font-mono ${
                        comparison.surgeDeltaMeters >= 0
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {comparison.surgeDeltaMeters >= 0
                        ? `+${comparison.surgeDeltaMeters}m`
                        : `${comparison.surgeDeltaMeters}m`}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold font-mono text-purple-300">
                    {currentHistorical.totalWaterLevelMeters}m <span className="text-xs font-normal text-slate-400">TWL</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Pure Surge: {currentHistorical.peakSurgeMeters}m
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Wind className="w-3 h-3 text-rose-400" />
                      Peak Winds
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1 rounded font-mono ${
                        comparison.windDeltaKmh >= 0
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {comparison.windDeltaKmh >= 0
                        ? `+${comparison.windDeltaKmh} km/h`
                        : `${comparison.windDeltaKmh} km/h`}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold font-mono text-purple-300">
                    {currentHistorical.peakWindsKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Embankments: {currentHistorical.embankmentBreachKm}km breached
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-amber-400" />
                      Pressure
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Δ {comparison.pressureDeltaHpa} hPa
                    </span>
                  </div>
                  <div className="text-base font-extrabold font-mono text-purple-300">
                    {currentHistorical.centralPressureHpa} <span className="text-xs font-normal text-slate-400">hPa</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Historical Minima</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Substations Tripped
                  </div>
                  <div className="text-base font-extrabold font-mono text-purple-300">
                    {currentHistorical.substationsAffected} Substations
                  </div>
                  <div className="text-[10px] text-slate-500">Actual Outage Record</div>
                </div>
              </div>

              {/* Actual Damage */}
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                  <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                  Recorded Economic Damage:
                </span>
                <span className="font-mono font-bold text-purple-300 text-sm">
                  ${currentHistorical.economicDamageBillionUsd}B USD
                </span>
              </div>
            </div>
          </div>

          {/* Hydrodynamic & Structural Vulnerability Verdict */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-cyan-400" />
              Comparative Hydrodynamic & Tactical Analysis
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="p-1 rounded bg-cyan-950 text-cyan-400 font-bold text-[10px] mt-0.5">
                  SURGE
                </span>
                <div className="text-slate-200 leading-relaxed">
                  {comparison.surgeComparisonVerdict}
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-slate-800">
                <span className="p-1 rounded bg-amber-950 text-amber-400 font-bold text-[10px] mt-0.5">
                  WIND/GRID
                </span>
                <div className="text-slate-200 leading-relaxed">
                  {comparison.infrastructureComparisonVerdict}
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-slate-800">
                <span className="p-1 rounded bg-purple-950 text-purple-400 font-bold text-[10px] mt-0.5">
                  SIGNATURE
                </span>
                <div className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>{currentHistorical.name} Impact Footprint:</strong>{' '}
                  {currentHistorical.primaryDisruptionSignature}
                </div>
              </div>
            </div>
          </div>

          {/* Evolution of Resilience & Disaster Mitigations */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Institutional Resilience Evolution (Lessons Applied)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {comparison.resilienceEvolutionNotes.map((note, index) => (
                <div
                  key={index}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-purple-400" />
            <span>Landfall: {currentHistorical.landfallLocation}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
