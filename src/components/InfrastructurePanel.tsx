import React, { useState, useMemo } from 'react';
import {
  InfrastructureNode,
  EvacuationCorridor,
  ParametricInsurancePolicy,
  CycloneScenario,
  CoastalSurgeZone,
} from '../types/cyclone';
import { COASTAL_SURGE_ZONES } from '../data/cycloneScenarios';
import { evaluateNodeVulnerability, calculateZoneSurgeRisk } from '../services/surgePhysics';
import {
  Zap,
  Shield,
  Home,
  HeartPulse,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Truck,
  Droplets,
  ExternalLink,
  Coins,
  ChevronRight,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Flame,
  MapPin,
} from 'lucide-react';
import { downloadInfrastructureRiskCsv } from '../utils/exportCsv';
import { calculateAllZonesDensity } from '../services/spatialDensity';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface InfrastructurePanelProps {
  infrastructure: InfrastructureNode[];
  corridors: EvacuationCorridor[];
  parametricPolicies: ParametricInsurancePolicy[];
  totalWaterLevel: number;
  pureSurge?: number;
  astronomicalTide?: number;
  timeOffset?: number;
  mangroveOverride?: boolean;
  scenario: CycloneScenario;
  selectedNode: InfrastructureNode | null;
  onSelectNode: (node: InfrastructureNode | null) => void;
  showDensityHeatmap?: boolean;
  onToggleDensityHeatmap?: () => void;
}

export const InfrastructurePanel: React.FC<InfrastructurePanelProps> = ({
  infrastructure,
  corridors,
  parametricPolicies,
  totalWaterLevel,
  pureSurge = 3.2,
  astronomicalTide = 1.2,
  timeOffset = 0,
  mangroveOverride = true,
  scenario,
  selectedNode,
  onSelectNode,
  showDensityHeatmap = false,
  onToggleDensityHeatmap,
}) => {
  const [activeTab, setActiveTab] = useState<'impact' | 'zones' | 'power' | 'roads' | 'shelters' | 'insurance'>('impact');
  const [chartViewMode, setChartViewMode] = useState<'sectors' | 'surgeCurve'>('sectors');
  const [isExporting, setIsExporting] = useState(false);

  // Dynamic calculation of Utility Downtime Hours and Economic Loss based on current surge depth
  const sectorImpactData = useMemo(() => {
    return [
      {
        sector: 'Power Grid',
        shortName: 'Power',
        downtimeHours: Math.round(Math.min(240, 24 + Math.pow(totalWaterLevel, 1.85) * 12)),
        economicLossM: Number((12 + Math.pow(totalWaterLevel, 1.95) * 4.8).toFixed(1)),
        criticalThreat: '132kV busbar submergence, transformer de-salinization',
      },
      {
        sector: 'Ports & Marine',
        shortName: 'Ports',
        downtimeHours: Math.round(Math.min(180, 18 + Math.pow(totalWaterLevel, 1.75) * 9)),
        economicLossM: Number((16 + Math.pow(totalWaterLevel, 1.88) * 5.2).toFixed(1)),
        criticalThreat: 'Jetty lock submergence, cargo demurrage, crane motors',
      },
      {
        sector: 'Highway Corridors',
        shortName: 'Roads',
        downtimeHours: Math.round(Math.min(120, 12 + Math.pow(totalWaterLevel, 1.65) * 7)),
        economicLossM: Number((8 + Math.pow(totalWaterLevel, 1.78) * 3.4).toFixed(1)),
        criticalThreat: 'Embankment washouts, culvert scour, silt de-watering',
      },
      {
        sector: 'Water Treatment',
        shortName: 'Water',
        downtimeHours: Math.round(Math.min(144, 16 + Math.pow(totalWaterLevel, 1.68) * 8)),
        economicLossM: Number((6 + Math.pow(totalWaterLevel, 1.72) * 2.6).toFixed(1)),
        criticalThreat: 'Saline contamination of potable municipal reservoirs',
      },
      {
        sector: 'Telecom Cells',
        shortName: 'Telecom',
        downtimeHours: Math.round(Math.min(96, 10 + Math.pow(totalWaterLevel, 1.55) * 5)),
        economicLossM: Number((3 + Math.pow(totalWaterLevel, 1.58) * 1.5).toFixed(1)),
        criticalThreat: 'Base station generator flood, fiber feeder cuts',
      },
      {
        sector: 'Emergency Health',
        shortName: 'Health',
        downtimeHours: Math.round(Math.min(72, 8 + Math.pow(totalWaterLevel, 1.45) * 4)),
        economicLossM: Number((2 + Math.pow(totalWaterLevel, 1.52) * 1.2).toFixed(1)),
        criticalThreat: 'Auxiliary diesel generator elevation, cold-chain backup',
      },
    ];
  }, [totalWaterLevel]);

  const totalEstimatedEconomicLoss = useMemo(() => {
    return Number(sectorImpactData.reduce((acc, curr) => acc + curr.economicLossM, 0).toFixed(1));
  }, [sectorImpactData]);

  const maxDowntimeHours = useMemo(() => {
    return Math.max(...sectorImpactData.map((d) => d.downtimeHours));
  }, [sectorImpactData]);

  // Surge sensitivity escalation curve (0.5m to 5.5m)
  const surgeCurveData = useMemo(() => {
    return [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((depth) => ({
      depth: `${depth}m`,
      surgeMeters: depth,
      lossM: Number((depth * 7.5 + Math.pow(depth, 2.15) * 6.2).toFixed(1)),
      downtimeHours: Math.round(16 + Math.pow(depth, 1.82) * 9.8),
    }));
  }, []);

  // Filter infrastructure by sector
  const powerNodes = infrastructure.filter((n) => n.type === 'substation');
  const shelterNodes = infrastructure.filter((n) => n.type === 'shelter' || n.type === 'hospital');

  const handleExportCsv = () => {
    setIsExporting(true);
    try {
      downloadInfrastructureRiskCsv({
        scenario,
        totalWaterLevel,
        pureSurge,
        astronomicalTide,
        timeOffset,
        infrastructure,
        corridors,
        coastalZones: COASTAL_SURGE_ZONES,
        sectorImpactData,
        mangroveOverride,
      });
    } catch (e) {
      console.error('Failed to export CSV', e);
    } finally {
      setTimeout(() => setIsExporting(false), 800);
    }
  };

  // Aggregated summary counts
  const criticalCount = infrastructure.filter((n) => {
    const v = evaluateNodeVulnerability(n, totalWaterLevel, scenario.windSpeed);
    return v.status === 'critical' || v.status === 'de_energized' || v.status === 'flooded';
  }).length;

  const warningCount = infrastructure.filter((n) => {
    const v = evaluateNodeVulnerability(n, totalWaterLevel, scenario.windSpeed);
    return v.status === 'warning';
  }).length;

  // Dynamic spatial density calculation of critical infrastructure across coastal surge zones
  const zoneDensities = useMemo(() => {
    return calculateAllZonesDensity(
      COASTAL_SURGE_ZONES,
      infrastructure,
      totalWaterLevel,
      scenario.windSpeed
    );
  }, [infrastructure, totalWaterLevel, scenario.windSpeed]);

  const highDensityClusterCount = useMemo(() => {
    return zoneDensities.filter((zd) => zd.densityLevel === 'CRITICAL_CLUSTER' || zd.densityLevel === 'HIGH').length;
  }, [zoneDensities]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-200">
      {/* Sector Navigation Header Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('impact')}
          className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1 transition whitespace-nowrap ${
            activeTab === 'impact'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Damage Impact
        </button>

        <button
          onClick={() => setActiveTab('zones')}
          className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1 transition whitespace-nowrap ${
            activeTab === 'zones'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Surge Zones
        </button>

        <button
          onClick={() => setActiveTab('power')}
          className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1 transition whitespace-nowrap ${
            activeTab === 'power'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Power Grid
        </button>

        <button
          onClick={() => setActiveTab('roads')}
          className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1 transition whitespace-nowrap ${
            activeTab === 'roads'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Arterials
        </button>

        <button
          onClick={() => setActiveTab('shelters')}
          className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1 transition whitespace-nowrap ${
            activeTab === 'shelters'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5" />
          Shelters
        </button>

        <button
          onClick={() => setActiveTab('insurance')}
          className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1 transition whitespace-nowrap ${
            activeTab === 'insurance'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          Parametric
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/40 border-b border-slate-800 text-center text-xs">
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <div className="text-slate-400 text-[10px] uppercase">Critical Assets</div>
          <div className="text-base font-bold text-rose-400 mt-0.5">{criticalCount} Nodes</div>
        </div>
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <div className="text-slate-400 text-[10px] uppercase">Warning Level</div>
          <div className="text-base font-bold text-amber-400 mt-0.5">{warningCount} Nodes</div>
        </div>
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <div className="text-slate-400 text-[10px] uppercase">TWL Surge Mark</div>
          <div className="text-base font-bold text-cyan-400 mt-0.5">{totalWaterLevel.toFixed(1)}m</div>
        </div>
      </div>

      {/* Offline Disaster Report & Density Heatmap Action Bar */}
      <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          onClick={onToggleDensityHeatmap}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition shadow-sm active:scale-95 border ${
            showDensityHeatmap
              ? 'bg-rose-950/90 text-rose-200 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.35)] font-bold ring-1 ring-rose-400/50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title="Toggle choropleth density heatmap of critical nodes in high-risk zones on the GIS map"
        >
          <Flame className={`w-3.5 h-3.5 ${showDensityHeatmap ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
          <span>Density Heatmap</span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
              showDensityHeatmap ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-400'
            }`}
          >
            {showDensityHeatmap ? 'ON' : 'OFF'}
          </span>
          {highDensityClusterCount > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping ml-0.5" />
          )}
        </button>

        <button
          onClick={handleExportCsv}
          disabled={isExporting}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1.5 transition shadow-sm active:scale-95 disabled:opacity-50"
          title="Download complete RFC 4180 CSV risk assessment for local emergency response teams"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          {isExporting ? 'Exporting...' : 'Export Risk CSV'}
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Tab -1: Damage Impact Summary (Recharts) */}
        {activeTab === 'impact' && (
          <div className="space-y-3.5">
            {/* Header with Title & View Switcher */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Damage Impact Summary
                </h4>
                <div className="text-[11px] text-slate-400">
                  Predicted utility downtime & direct economic losses modeled at {totalWaterLevel.toFixed(1)}m surge
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px] shrink-0">
                <button
                  onClick={() => setChartViewMode('sectors')}
                  className={`px-2 py-0.5 rounded transition ${
                    chartViewMode === 'sectors'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sectors
                </button>
                <button
                  onClick={() => setChartViewMode('surgeCurve')}
                  className={`px-2 py-0.5 rounded transition ${
                    chartViewMode === 'surgeCurve'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Curve
                </button>
              </div>
            </div>

            {/* Impact Metric Cards */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" />
                  Total Economic Loss
                </div>
                <div className="text-lg font-mono font-extrabold text-emerald-400">
                  ${totalEstimatedEconomicLoss}M <span className="text-xs font-normal text-slate-400">USD</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Direct assets + commercial outage
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  Max Restoration Time
                </div>
                <div className="text-lg font-mono font-extrabold text-cyan-300">
                  {maxDowntimeHours} <span className="text-xs font-normal text-slate-400">Hours</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Power grid switchyard de-watering
                </div>
              </div>
            </div>

            {/* Recharts Chart Container */}
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-medium">
                  {chartViewMode === 'sectors'
                    ? 'Sector Breakdown: Loss ($M) vs Restoration (Hours)'
                    : 'Surge Sensitivity: Economic Loss & Downtime Escalation'}
                </span>
                <span className="font-mono text-cyan-400 text-[10px]">
                  TWL: {totalWaterLevel.toFixed(1)}m
                </span>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartViewMode === 'sectors' ? (
                    <ComposedChart data={sectorImpactData} margin={{ top: 10, right: 10, left: -18, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="shortName" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis
                        yAxisId="loss"
                        orientation="left"
                        tick={{ fill: '#34d399', fontSize: 10 }}
                        label={{ value: '$M', angle: -90, position: 'insideLeft', fill: '#34d399', fontSize: 10, offset: 12 }}
                      />
                      <YAxis
                        yAxisId="hours"
                        orientation="right"
                        tick={{ fill: '#38bdf8', fontSize: 10 }}
                        label={{ value: 'Hours', angle: 90, position: 'insideRight', fill: '#38bdf8', fontSize: 10, offset: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === 'Economic Loss ($M)') return [`$${value}M USD`, name];
                          if (name === 'Downtime (Hours)') return [`${value} hrs`, name];
                          return [value, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                      <Bar
                        yAxisId="loss"
                        dataKey="economicLossM"
                        name="Economic Loss ($M)"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        opacity={0.85}
                      />
                      <Line
                        yAxisId="hours"
                        type="monotone"
                        dataKey="downtimeHours"
                        name="Downtime (Hours)"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        dot={{ fill: '#0284c7', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  ) : (
                    <ComposedChart data={surgeCurveData} margin={{ top: 10, right: 10, left: -18, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="depth" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis
                        yAxisId="loss"
                        orientation="left"
                        tick={{ fill: '#34d399', fontSize: 10 }}
                        label={{ value: '$M', angle: -90, position: 'insideLeft', fill: '#34d399', fontSize: 10, offset: 12 }}
                      />
                      <YAxis
                        yAxisId="hours"
                        orientation="right"
                        tick={{ fill: '#38bdf8', fontSize: 10 }}
                        label={{ value: 'Hours', angle: 90, position: 'insideRight', fill: '#38bdf8', fontSize: 10, offset: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === 'Projected Loss ($M)') return [`$${value}M USD`, name];
                          if (name === 'Avg Downtime (Hours)') return [`${value} hrs`, name];
                          return [value, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                      <Bar
                        yAxisId="loss"
                        dataKey="lossM"
                        name="Projected Loss ($M)"
                        fill="#059669"
                        radius={[4, 4, 0, 0]}
                        opacity={0.7}
                      />
                      <Line
                        yAxisId="hours"
                        type="monotone"
                        dataKey="downtimeHours"
                        name="Avg Downtime (Hours)"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={{ fill: '#0891b2', r: 4 }}
                      />
                      <ReferenceLine
                        yAxisId="loss"
                        x={`${Math.min(5.5, Math.max(0.5, Math.round(totalWaterLevel * 2) / 2)).toFixed(1)}m`}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label={{ value: 'Current TWL', fill: '#f87171', fontSize: 10 }}
                      />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Utility Disruption Pathways Breakdown */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Critical Utility Disruption Pathways:
              </div>
              {sectorImpactData.map((s, idx) => (
                <div key={idx} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{s.sector}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-emerald-400 font-bold">${s.economicLossM}M</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-cyan-300 font-bold">{s.downtimeHours}h restoration</span>
                    </div>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    {s.criticalThreat}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 0: Coastal Surge Zones Risk Intensity & Critical Node Density */}
        {activeTab === 'zones' && (
          <div className="space-y-3">
            {/* Density Heatmap Banner Card */}
            <div className="p-3 rounded-lg border bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-slate-800 space-y-2 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    <Flame className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                      Critical Node Density Heatmap
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        Choropleth
                      </span>
                    </span>
                    <div className="text-[10px] text-slate-400">
                      Spatial concentration of compromised substations, hospitals, and causeways
                    </div>
                  </div>
                </div>

                <button
                  onClick={onToggleDensityHeatmap}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 border shadow-sm active:scale-95 ${
                    showDensityHeatmap
                      ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  <Flame className="w-3 h-3" />
                  <span>{showDensityHeatmap ? 'Layer ON' : 'Turn ON'}</span>
                </button>
              </div>

              {/* Density Distribution Summary Bar */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/70 p-2 rounded border border-slate-800/80">
                <div className="text-slate-400">
                  Compromised Clusters:{' '}
                  <strong className="text-rose-400 font-mono font-bold">
                    {highDensityClusterCount} Zones
                  </strong>
                </div>
                <div className="text-slate-400">
                  Critical Node Hazards:{' '}
                  <strong className="text-amber-400 font-mono font-bold">
                    {criticalCount} Facilities
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Coastal Surge Risk Intensity by Sector</span>
              <span className="text-[11px] text-rose-400 font-mono">
                {COASTAL_SURGE_ZONES.length} Littoral Zones
              </span>
            </div>

            {/* Ranked Zones List */}
            {COASTAL_SURGE_ZONES.map((zone) => {
              const risk = calculateZoneSurgeRisk(zone, scenario, totalWaterLevel);
              const zd = zoneDensities.find((d) => d.zoneId === zone.id);

              return (
                <div
                  key={zone.id}
                  className="p-3 rounded-lg border bg-slate-950/70 border-slate-800 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                        <ShieldAlert
                          className={`w-3.5 h-3.5 ${
                            risk.riskLevel === 'CATASTROPHIC'
                              ? 'text-rose-400'
                              : risk.riskLevel === 'SEVERE'
                              ? 'text-orange-400'
                              : 'text-amber-400'
                          }`}
                        />
                        {zone.name}
                      </div>
                      <div className="text-xs text-slate-400">{zone.region}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        risk.riskLevel === 'CATASTROPHIC'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : risk.riskLevel === 'SEVERE'
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                          : risk.riskLevel === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {risk.riskLevel}
                    </span>
                  </div>

                  {/* Node Density Indicator Badge */}
                  {zd && (
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800/90 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: zd.densityColor }}
                        />
                        <span className="text-slate-300 font-medium">Critical Node Density:</span>
                        <span className="font-bold text-slate-100 font-mono">
                          {zd.highRiskNodes} / {zd.totalNodes} Compromised
                        </span>
                      </div>

                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded"
                        style={{
                          color: zd.densityBorderColor,
                          backgroundColor: `${zd.densityColor}33`,
                          border: `1px solid ${zd.densityBorderColor}`,
                        }}
                      >
                        {zd.densityLevel.replace('_', ' ')}
                      </span>
                    </div>
                  )}

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] pt-1.5 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500">Local Surge:</span>{' '}
                      <strong className="text-cyan-300 font-mono">{risk.localSurgeMeters}m</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Overtopping:</span>{' '}
                      <strong
                        className={
                          risk.overtoppingDepthMeters > 0
                            ? 'text-rose-400 font-bold font-mono'
                            : 'text-emerald-400 font-mono'
                        }
                      >
                        {risk.overtoppingDepthMeters > 0
                          ? `+${risk.overtoppingDepthMeters}m`
                          : 'Safe'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Risk Score:</span>{' '}
                      <strong
                        className={
                          risk.riskScore >= 75 ? 'text-rose-400 font-mono' : 'text-amber-400 font-mono'
                        }
                      >
                        {risk.riskScore}/100
                      </strong>
                    </div>
                  </div>

                  {/* Breach Probability Bar */}
                  <div className="pt-0.5">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>Embankment Breach Probability:</span>
                      <span className="font-mono font-bold text-rose-400">
                        {risk.breachProbabilityPercent}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded ${
                          risk.breachProbabilityPercent >= 70
                            ? 'bg-rose-500'
                            : risk.breachProbabilityPercent >= 40
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${risk.breachProbabilityPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Mandated Evacuation Action */}
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                    <div className="font-medium text-amber-300 text-[10px] uppercase">
                      Mandate: {risk.evacuationMandate}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-slate-400 text-[10px]">
                      <span>
                        Population at Risk: <strong>{zone.populationAtRisk.toLocaleString()}</strong>
                      </span>
                      <span>
                        Evacuees Required:{' '}
                        <strong className="text-rose-300">
                          {risk.evacueeCount.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 1: Power Grid & Substations */}
        {activeTab === 'power' && (
          <div className="space-y-2.5">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Electrical Grid & Transmission Protection</span>
              <span className="text-[11px] text-amber-400 font-mono">132kV / 33kV Switchyards</span>
            </div>

            {powerNodes.map((node) => {
              const v = evaluateNodeVulnerability(node, totalWaterLevel, scenario.windSpeed);
              const isSelected = selectedNode?.id === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-400 shadow-md ring-1 ring-cyan-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        {node.name}
                      </div>
                      <div className="text-xs text-slate-400">{node.district}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        v.status === 'de_energized'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : v.status === 'warning'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {v.status === 'de_energized' ? 'Trip / De-Energize' : v.status}
                    </span>
                  </div>

                  {/* Metrics bar */}
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-500">Elevation:</span>{' '}
                      <strong className="text-slate-300">{node.elevationMeters}m</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Flood Depth:</span>{' '}
                      <strong className={v.floodDepthMeters > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                        {v.floodDepthMeters > 0 ? `+${v.floodDepthMeters}m` : 'Dry'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Risk Score:</span>{' '}
                      <strong className={v.riskScore >= 75 ? 'text-rose-400' : 'text-amber-400'}>
                        {v.riskScore}/100
                      </strong>
                    </div>
                  </div>

                  {/* Action recommendation */}
                  <div className="mt-2.5 p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{v.urgentRecommendation}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Arterial Roads & Evacuation Corridors */}
        {activeTab === 'roads' && (
          <div className="space-y-2.5">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Evacuation Lifelines & Bridge Chokepoints</span>
              <span className="text-[11px] text-sky-400">Passability Monitoring</span>
            </div>

            {corridors.map((corridor) => (
              <div
                key={corridor.id}
                className="p-3 rounded-lg border bg-slate-950/60 border-slate-800 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm text-slate-100">{corridor.name}</div>
                    <div className="text-xs text-slate-400">
                      {corridor.highwayNumber} · {corridor.from} → {corridor.to}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      corridor.passability === 'impassable'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : corridor.passability === 'caution'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {corridor.passability}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  <div>
                    <span>Elevation:</span> <strong className="text-slate-200">{corridor.elevationMeters}m</strong>
                  </div>
                  <div>
                    <span>Culverts at Risk:</span>{' '}
                    <strong className="text-rose-400">{corridor.culvertRiskCount} points</strong>
                  </div>
                  <div>
                    <span>Capacity:</span>{' '}
                    <strong className="text-slate-200">{corridor.evacuationCapacityVehiclesPerHour}/hr</strong>
                  </div>
                </div>

                {corridor.passability === 'impassable' && (
                  <div className="text-[11px] text-rose-300 bg-rose-950/40 p-2 rounded border border-rose-900/50">
                    Warning: Embankment overtopped by tidal surge. Deploy amphibious boats or divert traffic through northern link road.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Shelters & Healthcare Facilities */}
        {activeTab === 'shelters' && (
          <div className="space-y-2.5">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Medical Facilities & Multi-purpose Cyclone Shelters</span>
              <span className="text-[11px] text-rose-400">Zero-Casualty Protocol</span>
            </div>

            {shelterNodes.map((node) => {
              const v = evaluateNodeVulnerability(node, totalWaterLevel, scenario.windSpeed);

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className="p-3 rounded-lg border bg-slate-950/60 border-slate-800 hover:border-slate-700 cursor-pointer space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                        {node.type === 'hospital' ? (
                          <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Home className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        {node.name}
                      </div>
                      <div className="text-xs text-slate-400">{node.district}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        v.status === 'critical'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : v.status === 'warning'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    <div>
                      <span>Capacity:</span>{' '}
                      <strong className="text-slate-200">
                        {node.capacity} {node.type === 'hospital' ? 'beds' : 'persons'}
                      </strong>
                    </div>
                    <div>
                      <span>Surge Threat:</span>{' '}
                      <strong className={v.floodDepthMeters > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        {v.floodDepthMeters > 0 ? `+${v.floodDepthMeters}m` : 'Safe'}
                      </strong>
                    </div>
                    <div>
                      <span>Generator:</span> <strong className="text-slate-200">Rooftop Aux</strong>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800">
                    {v.urgentRecommendation}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Parametric Insurance & Emergency Liquidity */}
        {activeTab === 'insurance' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400">
              Parametric Disaster Risk Finance (Pre-landfall anticipatory payout triggered upon meteorological thresholds)
            </div>

            {parametricPolicies.map((policy) => {
              const windTriggered = scenario.windSpeed >= policy.windTriggerThresholdKmh;
              const surgeTriggered = totalWaterLevel >= policy.surgeTriggerThresholdMeters;
              const isTriggerActive = windTriggered && surgeTriggered;

              return (
                <div
                  key={policy.policyId}
                  className="p-3.5 rounded-lg border bg-slate-950/70 border-slate-800 space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-emerald-400" />
                        {policy.district}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{policy.policyId}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isTriggerActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isTriggerActive ? 'Pre-Landfall Payout Authorized' : 'Monitoring Gates'}
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Wind Gate (&gt;{policy.windTriggerThresholdKmh} km/h):</span>
                      <span className={`font-mono font-bold ${windTriggered ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {scenario.windSpeed} km/h {windTriggered ? '✓ PASS' : '—'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Surge Gate (&gt;{policy.surgeTriggerThresholdMeters}m):</span>
                      <span className={`font-mono font-bold ${surgeTriggered ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {totalWaterLevel.toFixed(1)}m {surgeTriggered ? '✓ PASS' : '—'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-slate-300 font-medium">Anticipatory Payout:</span>
                      <span className="text-base font-extrabold text-emerald-400">
                        ${(policy.immediatePreLandfallPayoutUSD / 1000000).toFixed(1)}M USD
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Beneficiary Households: <strong>{policy.beneficiaryHouseholds.toLocaleString()}</strong></span>
                    <span>Disbursement Window: <strong>&lt;{policy.settlementSpeedHours} Hours</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
