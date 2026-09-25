import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Waves,
  Radio,
  Activity,
  Moon,
  ArrowUpRight,
  ArrowDownRight,
  Play,
  Pause,
  FastForward,
  Sliders,
  CheckCircle2,
  RefreshCw,
  X,
  Info,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TideStationReading,
  INITIAL_TIDE_STATIONS,
  LunarPhase,
  TideState,
  calculateHarmonicTide,
  generate24HourTideCurve,
} from '../services/tideObserverService';

interface TideObserverModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLiveSyncActive: boolean;
  onToggleLiveSync: (active: boolean) => void;
  onUpdateLiveTide: (tideMeters: number) => void;
  baseSurgeMeters: number;
  timeOffset: number;
}

export const TideObserverModal: React.FC<TideObserverModalProps> = ({
  isOpen,
  onClose,
  isLiveSyncActive,
  onToggleLiveSync,
  onUpdateLiveTide,
  baseSurgeMeters,
  timeOffset,
}) => {
  const [selectedStationId, setSelectedStationId] = useState<string>('INCOIS-WB-01');
  const [lunarPhase, setLunarPhase] = useState<LunarPhase>('SPRING_TIDE');
  const [simulationSpeed, setSimulationSpeed] = useState<'1x' | '10x' | '60x' | 'PAUSED'>('1x');
  const [manualOffsetMeters, setManualOffsetMeters] = useState<number>(0);
  const [virtualElapsedHours, setVirtualElapsedHours] = useState<number>(0);
  const [stations, setStations] = useState<TideStationReading[]>(INITIAL_TIDE_STATIONS);
  const [telemetryTick, setTelemetryTick] = useState<number>(0);

  const virtualHoursRef = useRef<number>(virtualElapsedHours);
  virtualHoursRef.current = virtualElapsedHours;

  const currentStation = useMemo(() => {
    return stations.find((s) => s.stationId === selectedStationId) || stations[0];
  }, [stations, selectedStationId]);

  // Real-time telemetry simulation ticker
  useEffect(() => {
    if (simulationSpeed === 'PAUSED') return;

    let stepHours = 0.05; // ~3 minutes per tick in 1x
    let intervalMs = 1800; // 1.8 seconds per tick

    if (simulationSpeed === '10x') {
      stepHours = 0.25; // ~15 minutes per tick
      intervalMs = 1200;
    } else if (simulationSpeed === '60x') {
      stepHours = 0.8; // ~48 minutes per tick
      intervalMs = 800;
    }

    const timer = setInterval(() => {
      setVirtualElapsedHours((prev) => prev + stepHours);
      setTelemetryTick((prev) => prev + 1);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [simulationSpeed]);

  // Recalculate station readings on each tick or setting change
  useEffect(() => {
    const updated = stations.map((st, idx) => {
      // Station specific base amplitude and slight spatial lag
      const baseAmp = st.stationId === 'BIWTA-BD-02' ? 1.7 : st.stationId === 'INCOIS-WB-01' ? 1.55 : 1.35;
      const phaseLag = idx * 0.45;
      const calc = calculateHarmonicTide(
        virtualElapsedHours + phaseLag,
        baseAmp,
        lunarPhase,
        manualOffsetMeters
      );

      return {
        ...st,
        observedWaterLevelMeters: calc.observed,
        predictedAstroTideMeters: calc.predicted,
        surgeResidualMeters: Number((calc.observed - calc.predicted).toFixed(2)),
        rateOfChangeCmPerHour: calc.rateCmPerHour,
        tideState: calc.state,
        lastPingTimestamp: 'Just now',
      };
    });

    setStations(updated);

    // If live sync is active, propagate current station's observed tide to application state
    const activeSt = updated.find((s) => s.stationId === selectedStationId) || updated[0];
    if (isLiveSyncActive) {
      onUpdateLiveTide(activeSt.observedWaterLevelMeters);
    }
  }, [
    virtualElapsedHours,
    lunarPhase,
    manualOffsetMeters,
    selectedStationId,
    isLiveSyncActive,
    onUpdateLiveTide,
  ]);

  // Dynamic 24-hour curve
  const curveData = useMemo(() => {
    const baseAmp = currentStation.stationId === 'BIWTA-BD-02' ? 1.7 : 1.55;
    return generate24HourTideCurve(virtualElapsedHours, baseAmp, lunarPhase, manualOffsetMeters);
  }, [virtualElapsedHours, currentStation, lunarPhase, manualOffsetMeters]);

  if (!isOpen) return null;

  const currentObserved = currentStation.observedWaterLevelMeters;
  const currentPredicted = currentStation.predictedAstroTideMeters;
  const currentResidual = currentStation.surgeResidualMeters;
  const totalCompoundLevel = Number((baseSurgeMeters + currentObserved).toFixed(2));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-cyan-500/20">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Waves className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100">
                  Real-Time Tide Observer
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 animate-ping text-cyan-400" />
                  INCOIS Telemetry
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Live coastal acoustic radar & float gauge network monitoring astronomical tide superposition
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Master Live Telemetry Sync Toggle */}
            <button
              onClick={() => {
                const nextState = !isLiveSyncActive;
                onToggleLiveSync(nextState);
                if (nextState) {
                  onUpdateLiveTide(currentObserved);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-sm active:scale-95 ${
                isLiveSyncActive
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isLiveSyncActive ? 'Sync: ACTIVE (Live)' : 'Sync to Total Surge'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Tide Observer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Top Live Gauges Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Primary Water Level Gauge */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                <span>Observed Astronomical Tide</span>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="flex items-baseline gap-1.5 pt-0.5">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-cyan-300">
                  {currentObserved > 0 ? `+${currentObserved.toFixed(2)}` : currentObserved.toFixed(2)}m
                </span>
                <span className="text-xs text-slate-400 font-medium">MSL</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Predicted: {currentPredicted.toFixed(2)}m</span>
                <span className="text-cyan-400 font-mono font-semibold">
                  {currentResidual >= 0 ? `+${currentResidual.toFixed(2)}` : currentResidual.toFixed(2)}m residual
                </span>
              </div>
            </div>

            {/* Total Water Level Compound Level */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                <span>Total Water Level (TWL)</span>
                <span className="text-[10px] font-mono text-rose-400">Pure Surge + Tide</span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-0.5">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-rose-400">
                  {totalCompoundLevel.toFixed(2)}m
                </span>
                <span className="text-xs text-slate-400 font-medium">Crest</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Storm Surge: +{baseSurgeMeters.toFixed(2)}m</span>
                <span
                  className={`font-bold ${
                    totalCompoundLevel >= 3.5 ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {totalCompoundLevel >= 3.5 ? 'Extreme Overtopping' : 'Elevated'}
                </span>
              </div>
            </div>

            {/* Tide State & Rate of Rise */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Tidal Kinematics
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                {currentStation.rateOfChangeCmPerHour >= 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-amber-400" />
                )}
                <span className="font-mono text-lg font-bold text-slate-100">
                  {currentStation.tideState === 'FLOODING'
                    ? 'Incoming Flood'
                    : currentStation.tideState === 'EBBING'
                    ? 'Outgoing Ebb'
                    : currentStation.tideState === 'HIGH_SLACK'
                    ? 'High Slack Water'
                    : 'Low Slack Water'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Velocity:</span>
                <span className="font-mono font-bold text-slate-200">
                  {currentStation.rateOfChangeCmPerHour > 0 ? '+' : ''}
                  {currentStation.rateOfChangeCmPerHour} cm/hr
                </span>
              </div>
            </div>

            {/* Lunar Phase & Range */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <Moon className="w-3 h-3 text-purple-400" />
                <span>Lunar Phase Multiplier</span>
              </div>
              <div className="font-bold text-sm text-purple-300 pt-0.5 truncate">
                {lunarPhase === 'SPRING_TIDE'
                  ? 'Spring Tide (Syzygy)'
                  : lunarPhase === 'EQUINOCTIAL_SUPER_TIDE'
                  ? 'Equinoctial Super-Tide'
                  : lunarPhase === 'PERIGEAN_SPRING'
                  ? 'Perigean Spring Tide'
                  : 'Neap Tide (Quadrature)'}
              </div>
              <div className="text-[11px] text-slate-400">
                Range:{' '}
                {lunarPhase === 'SPRING_TIDE'
                  ? '3.8m – 4.5m Spring Range'
                  : lunarPhase === 'EQUINOCTIAL_SUPER_TIDE'
                  ? '4.6m – 5.2m Maximum'
                  : '1.8m – 2.4m Dampened'}
              </div>
            </div>
          </div>

          {/* 24-Hour Harmonic Tide Prediction Chart */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  24-Hour Harmonic Tide Curve & Landfall Phase Alignment
                </h4>
                <p className="text-[10px] text-slate-400">
                  Astronomical M2/S2 semi-diurnal harmonic superposition vs. real-time acoustic telemetry stream
                </p>
              </div>

              {/* Station Switcher */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                {stations.map((st) => (
                  <button
                    key={st.stationId}
                    onClick={() => setSelectedStationId(st.stationId)}
                    className={`px-2 py-1 rounded font-medium transition ${
                      selectedStationId === st.stationId
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st.stationName.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Harmonic Chart */}
            <div className="h-60 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={curveData}
                  margin={{ top: 12, right: 15, left: -20, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                    domain={[-2.5, 3.5]}
                    label={{
                      value: 'Water Level (m)',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#64748b',
                      fontSize: 10,
                      offset: 12,
                    }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="#475569"
                    strokeDasharray="2 2"
                    label={{
                      value: 'MSL (0.0m)',
                      fill: '#64748b',
                      fontSize: 9,
                      position: 'insideBottomRight',
                    }}
                  />
                  <ReferenceLine
                    y={2.5}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Crest Overtopping Threshold (2.5m)',
                      fill: '#f87171',
                      fontSize: 9,
                      position: 'insideTopLeft',
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f8fafc',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    }}
                    formatter={(value: any, name: any) => [`${value}m`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} iconSize={8} />

                  <Area
                    type="monotone"
                    dataKey="residual"
                    name="Surge Residual Anomaly (m)"
                    fill="#38bdf8"
                    fillOpacity={0.12}
                    stroke="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedTide"
                    name="Predicted Astro Tide (m)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="observedTide"
                    name="Live Observed Tide (m)"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: '#22c55e' }}
                    activeDot={{ r: 5, fill: '#4ade80' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Regional Multi-Station Telemetry Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                Regional Coastal Gauge Stations (INCOIS / Survey of India / BIWTA)
              </span>
              <span className="text-[10px] text-slate-400">
                Click station card to select as active baseline
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {stations.map((st) => {
                const isSelected = st.stationId === selectedStationId;
                return (
                  <div
                    key={st.stationId}
                    onClick={() => setSelectedStationId(st.stationId)}
                    className={`p-3 rounded-xl border cursor-pointer transition text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/40'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-100 flex items-center gap-1">
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                          <span className="truncate">{st.stationName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{st.agency}</div>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {st.signalStrengthPercent}% Sig
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between border-t border-slate-800/80 pt-1.5">
                      <span className="text-slate-400">Water Level:</span>
                      <span className="font-mono font-bold text-sm text-cyan-300">
                        {st.observedWaterLevelMeters > 0 ? `+${st.observedWaterLevelMeters.toFixed(2)}` : st.observedWaterLevelMeters.toFixed(2)}m
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Rate: {st.rateOfChangeCmPerHour > 0 ? `+${st.rateOfChangeCmPerHour}` : st.rateOfChangeCmPerHour} cm/h</span>
                      <span
                        className={`font-semibold ${
                          st.tideState === 'FLOODING' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {st.tideState}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simulator & Stress-Testing Control Panel */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Astronomical Tide Scenario Stress-Testing
              </span>
              <span className="text-[10px] text-slate-400">
                Simulate compound worst-case timing (Cyclone Landfall + Astronomical Spring Crest)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Lunar Phase Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium">Lunar Syzygy Scenario:</label>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <button
                    onClick={() => setLunarPhase('SPRING_TIDE')}
                    className={`py-1.5 px-2 rounded font-medium border text-center transition ${
                      lunarPhase === 'SPRING_TIDE'
                        ? 'bg-purple-950 text-purple-200 border-purple-500 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Spring (+2.6m)
                  </button>
                  <button
                    onClick={() => setLunarPhase('EQUINOCTIAL_SUPER_TIDE')}
                    className={`py-1.5 px-2 rounded font-medium border text-center transition ${
                      lunarPhase === 'EQUINOCTIAL_SUPER_TIDE'
                        ? 'bg-rose-950 text-rose-200 border-rose-500 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Equinoctial (+3.4m)
                  </button>
                  <button
                    onClick={() => setLunarPhase('NEAP_TIDE')}
                    className={`py-1.5 px-2 rounded font-medium border text-center transition ${
                      lunarPhase === 'NEAP_TIDE'
                        ? 'bg-cyan-950 text-cyan-200 border-cyan-500 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Neap Mid (+1.0m)
                  </button>
                  <button
                    onClick={() => setLunarPhase('PERIGEAN_SPRING')}
                    className={`py-1.5 px-2 rounded font-medium border text-center transition ${
                      lunarPhase === 'PERIGEAN_SPRING'
                        ? 'bg-amber-950 text-amber-200 border-amber-500 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Perigean (+3.0m)
                  </button>
                </div>
              </div>

              {/* Simulation Telemetry Playback Speed */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium">Telemetry Polling Rate:</label>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  <button
                    onClick={() => setSimulationSpeed('PAUSED')}
                    className={`py-1.5 rounded font-medium border transition flex items-center justify-center gap-1 ${
                      simulationSpeed === 'PAUSED'
                        ? 'bg-slate-800 text-white border-slate-600 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Pause className="w-2.5 h-2.5" /> Hold
                  </button>
                  <button
                    onClick={() => setSimulationSpeed('1x')}
                    className={`py-1.5 rounded font-medium border transition ${
                      simulationSpeed === '1x'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    1x
                  </button>
                  <button
                    onClick={() => setSimulationSpeed('10x')}
                    className={`py-1.5 rounded font-medium border transition ${
                      simulationSpeed === '10x'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    10x
                  </button>
                  <button
                    onClick={() => setSimulationSpeed('60x')}
                    className={`py-1.5 rounded font-medium border transition ${
                      simulationSpeed === '60x'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    60x
                  </button>
                </div>
                <div className="text-[10px] text-slate-400">
                  Virtual Time: {virtualElapsedHours.toFixed(1)}h elapsed (Tick #{telemetryTick})
                </div>
              </div>

              {/* Manual Coastal Anomaly Offset */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Estuary Resonance Bias:</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {manualOffsetMeters > 0 ? `+${manualOffsetMeters.toFixed(2)}` : manualOffsetMeters.toFixed(2)}m
                  </span>
                </div>
                <input
                  type="range"
                  min="-1.5"
                  max="1.5"
                  step="0.05"
                  value={manualOffsetMeters}
                  onChange={(e) => setManualOffsetMeters(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
                <div className="flex items-center justify-between text-[9px] text-slate-500">
                  <span>-1.5m (Damping)</span>
                  <button
                    onClick={() => setManualOffsetMeters(0)}
                    className="text-slate-400 hover:text-cyan-400 transition"
                  >
                    Reset 0.0m
                  </button>
                  <span>+1.5m (Funneling)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-950 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              {isLiveSyncActive
                ? `Synchronized: Live tide (+${currentObserved.toFixed(2)}m) actively overrides astronomical tide across all risk models.`
                : 'Offline mode: Application is using baseline theoretical scenario astronomical tide.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setVirtualElapsedHours(0);
                setManualOffsetMeters(0);
                setLunarPhase('SPRING_TIDE');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs"
            >
              Reset Stream
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition text-xs shadow"
            >
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
