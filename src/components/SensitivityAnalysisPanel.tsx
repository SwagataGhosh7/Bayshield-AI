import React, { useState, useMemo, useRef } from 'react';
import { CycloneScenario, InfrastructureNode } from '../types/cyclone';
import { evaluateNodeVulnerability } from '../services/surgePhysics';
import {
  Sliders,
  TrendingUp,
  Download,
  Info,
  Layers,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Waves,
  Wind,
  Trees,
  CheckSquare,
  Square,
  Crosshair,
  FileSpreadsheet,
} from 'lucide-react';

interface SensitivityAnalysisPanelProps {
  currentScenario: CycloneScenario;
  infrastructure: InfrastructureNode[];
  timeOffset: number;
  mangroveOverride: boolean;
  totalWaterLevel: number;
  pureSurge: number;
  astronomicalTide: number;
  onApplyParameters?: (windSpeed: number, tide: number, mangrove: boolean) => void;
}

export type XAxisMetric = 'windSpeed' | 'tide' | 'mangrove' | 'twl';
export type YAxisMetric = 'breachedAssets' | 'twl' | 'lossMillions' | 'popAtRisk' | 'inundatedArea';
export type ColorGrouping = 'mangrove' | 'tide' | 'category';

export interface SimulationRunPoint {
  id: string;
  name: string;
  windSpeed: number; // km/h
  tide: number; // m
  mangroveCoverage: number; // 0, 50, 100%
  mangroveLabel: string;
  categoryName: string;
  categoryColor: string;
  // Computed Hydrodynamics & Impacts
  pureSurge: number; // m
  twl: number; // m
  inundatedArea: number; // sq km
  popAtRisk: number; // count
  breachedAssets: number; // count
  deEnergizedSubstations: number; // count
  impassableRoads: number; // count
  criticalHospitals: number; // count
  lossMillions: number; // $M USD
  isCurrentBenchmark?: boolean;
}

const AVAILABLE_WIND_LEVELS = [
  { value: 90, label: '90 km/h (Gale / Cat 1)', shortLabel: '90k', category: 'Cat 1' },
  { value: 130, label: '130 km/h (Severe / Cat 2)', shortLabel: '130k', category: 'Cat 2' },
  { value: 165, label: '165 km/h (Very Severe / Cat 3)', shortLabel: '165k', category: 'Cat 3' },
  { value: 210, label: '210 km/h (Extremely Severe / Cat 4)', shortLabel: '210k', category: 'Cat 4' },
  { value: 250, label: '250 km/h (Super Cyclone / Cat 5)', shortLabel: '250k', category: 'Cat 5' },
];

const AVAILABLE_TIDE_LEVELS = [
  { value: 0.6, label: '0.6m (Neap Low Tide)', shortLabel: '0.6m' },
  { value: 1.2, label: '1.2m (Neap Mean Tide)', shortLabel: '1.2m' },
  { value: 1.85, label: '1.85m (Spring Mean High)', shortLabel: '1.85m' },
  { value: 2.8, label: '2.8m (Equinoctial Spring)', shortLabel: '2.8m' },
  { value: 3.6, label: '3.6m (Perigean King Tide)', shortLabel: '3.6m' },
];

const AVAILABLE_MANGROVE_LEVELS = [
  { value: 100, label: '100% Intact (Biosphere Buffer)', damping: 0.9, color: '#10b981' },
  { value: 50, label: '50% Degraded (Channels / Edge)', damping: 0.45, color: '#f59e0b' },
  { value: 0, label: '0% Deforested (Mud Embankment)', damping: 0.0, color: '#f43f5e' },
];

export const SensitivityAnalysisPanel: React.FC<SensitivityAnalysisPanelProps> = ({
  currentScenario,
  infrastructure,
  timeOffset,
  mangroveOverride,
  totalWaterLevel,
  pureSurge,
  astronomicalTide,
  onApplyParameters,
}) => {
  // Selected Multi-Variable Values (Multi-toggle)
  const [selectedWinds, setSelectedWinds] = useState<number[]>([90, 165, 250]);
  const [selectedTides, setSelectedTides] = useState<number[]>([0.6, 1.85, 2.8]);
  const [selectedMangroves, setSelectedMangroves] = useState<number[]>([100, 50, 0]);

  // Scatter Plot Dimensions
  const [xAxisMetric, setXAxisMetric] = useState<XAxisMetric>('windSpeed');
  const [yAxisMetric, setYAxisMetric] = useState<YAxisMetric>('breachedAssets');
  const [colorGrouping, setColorGrouping] = useState<ColorGrouping>('mangrove');
  const [showTrendLine, setShowTrendLine] = useState<boolean>(true);

  // Hover & Active Inspection
  const [hoveredPoint, setHoveredPoint] = useState<SimulationRunPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SimulationRunPoint | null>(null);
  const [filterMinBreached, setFilterMinBreached] = useState<number>(0);

  // Hydrodynamic Solver for a single parameter point
  const solvePointMetrics = (
    windKmh: number,
    tideMeters: number,
    mangroveCoveragePct: number,
    isCurrent = false
  ): SimulationRunPoint => {
    const windMps = windKmh / 3.6;

    // Inverse Barometer: estimated from empirical central pressure deficit
    // deltaP ~ 0.0017 * wind^2
    const deltaP = Math.min(105, 0.0017 * Math.pow(windKmh, 2));
    const invBarometer = (deltaP * 1.04) / 100;

    // Wind stress setup on shallow Bengal shelf (depth ~28m, fetch ~240km)
    const cd = 0.0026;
    const fetchM = 240000;
    const shelfDepth = 28;
    const g = 9.81;
    const rawWindSetup =
      ((1.2 * cd * Math.pow(windMps, 2) * fetchM) / (1025 * g * shelfDepth)) * 0.045;

    // Funneling amplification
    const funneling = 1.35;
    const rawSurge = (invBarometer + rawWindSetup) * funneling;

    // Mangrove damping factor based on coverage
    const maxDamping = 0.95;
    const damping = (mangroveCoveragePct / 100) * maxDamping;
    const pureSurgeVal = Math.max(0.4, Number((rawSurge - damping).toFixed(2)));

    // Total Water Level = Pure Surge + Astronomical Tide
    const twlVal = Number(Math.max(0, pureSurgeVal + tideMeters).toFixed(2));

    // Spatial impacts
    const inundatedArea = Math.round(180 + Math.pow(twlVal, 2.4) * 45);
    const popAtRisk = Math.round(45000 + Math.pow(twlVal, 2.2) * 28000);

    // Evaluate Infrastructure Breaches
    let breachedAssets = 0;
    let deEnergizedSubstations = 0;
    let impassableRoads = 0;
    let criticalHospitals = 0;

    infrastructure.forEach((node) => {
      const v = evaluateNodeVulnerability(node, twlVal, windKmh);
      if (v.status !== 'normal') {
        breachedAssets++;
      }
      if (node.type === 'substation' && v.status === 'de_energized') {
        deEnergizedSubstations++;
      }
      if (node.type === 'road' && (v.status === 'flooded' || v.floodDepthMeters >= 0.3)) {
        impassableRoads++;
      }
      if ((node.type === 'hospital' || node.type === 'shelter') && v.floodDepthMeters >= 0.2) {
        criticalHospitals++;
      }
    });

    // Parametric insurance & economic loss estimation ($M USD)
    // Baseline asset exposure + non-linear depth damage curve
    const lossMillions = Number(
      Math.min(
        150,
        breachedAssets * 2.8 + Math.pow(twlVal, 1.8) * 4.2 + (windKmh > 180 ? 12 : 0)
      ).toFixed(1)
    );

    let categoryName = 'Gale / Cat 1';
    let categoryColor = '#38bdf8';
    if (windKmh >= 240) {
      categoryName = 'Super Cyclone (Cat 5)';
      categoryColor = '#f43f5e';
    } else if (windKmh >= 180) {
      categoryName = 'Extremely Severe (Cat 4)';
      categoryColor = '#fb923c';
    } else if (windKmh >= 140) {
      categoryName = 'Very Severe (Cat 3)';
      categoryColor = '#facc15';
    } else if (windKmh >= 115) {
      categoryName = 'Severe (Cat 2)';
      categoryColor = '#34d399';
    }

    const mangroveLabel =
      mangroveCoveragePct === 100
        ? '100% Intact'
        : mangroveCoveragePct === 50
        ? '50% Degraded'
        : '0% Deforested';

    return {
      id: `run-${windKmh}-${tideMeters.toFixed(2)}-${mangroveCoveragePct}${isCurrent ? '-current' : ''}`,
      name: `${windKmh}km/h | ${tideMeters}m Tide | ${mangroveCoveragePct}% Mangrove`,
      windSpeed: windKmh,
      tide: tideMeters,
      mangroveCoverage: mangroveCoveragePct,
      mangroveLabel,
      categoryName,
      categoryColor,
      pureSurge: pureSurgeVal,
      twl: twlVal,
      inundatedArea,
      popAtRisk,
      breachedAssets,
      deEnergizedSubstations,
      impassableRoads,
      criticalHospitals,
      lossMillions,
      isCurrentBenchmark: isCurrent,
    };
  };

  // Generate the full Multivariate Sensitivity Run Points
  const simulationPoints = useMemo(() => {
    const points: SimulationRunPoint[] = [];

    // Factorial generation across user-selected variables
    selectedWinds.forEach((wind) => {
      selectedTides.forEach((tide) => {
        selectedMangroves.forEach((mangrove) => {
          points.push(solvePointMetrics(wind, tide, mangrove));
        });
      });
    });

    // Also inject Current Scenario Benchmark Point
    const currentMangrovePct = mangroveOverride ? 100 : 0;
    const currentPoint = solvePointMetrics(
      currentScenario.windSpeed,
      astronomicalTide,
      currentMangrovePct,
      true
    );
    // Overwrite with actual real-time simulated TWL and surge
    currentPoint.twl = totalWaterLevel;
    currentPoint.pureSurge = pureSurge;
    currentPoint.name = `[ACTIVE BENCHMARK] ${currentScenario.name}`;
    points.push(currentPoint);

    return points;
  }, [
    selectedWinds,
    selectedTides,
    selectedMangroves,
    currentScenario,
    astronomicalTide,
    mangroveOverride,
    totalWaterLevel,
    pureSurge,
    infrastructure,
  ]);

  // Filtered Points
  const filteredPoints = useMemo(() => {
    return simulationPoints.filter((p) => p.breachedAssets >= filterMinBreached);
  }, [simulationPoints, filterMinBreached]);

  // Sensitivity Insights / Elasticity calculations
  const insights = useMemo(() => {
    if (simulationPoints.length === 0) return null;

    // 1. Average Mangrove Damping Benefit
    const intact100 = simulationPoints.filter((p) => p.mangroveCoverage === 100 && !p.isCurrentBenchmark);
    const deforested0 = simulationPoints.filter((p) => p.mangroveCoverage === 0 && !p.isCurrentBenchmark);

    let avgTwlIntact = 0;
    let avgTwlDeforested = 0;
    let avgBreachIntact = 0;
    let avgBreachDeforested = 0;

    if (intact100.length > 0 && deforested0.length > 0) {
      avgTwlIntact = intact100.reduce((s, p) => s + p.twl, 0) / intact100.length;
      avgTwlDeforested = deforested0.reduce((s, p) => s + p.twl, 0) / deforested0.length;
      avgBreachIntact = intact100.reduce((s, p) => s + p.breachedAssets, 0) / intact100.length;
      avgBreachDeforested = deforested0.reduce((s, p) => s + p.breachedAssets, 0) / deforested0.length;
    }

    const mangroveTwlSaving = Math.max(0, Number((avgTwlDeforested - avgTwlIntact).toFixed(2)));
    const mangroveBreachSaving = Math.max(0, Math.round(avgBreachDeforested - avgBreachIntact));

    // 2. Tide Impact Multiplier (Neap vs High Spring)
    const lowTidePoints = simulationPoints.filter((p) => p.tide <= 1.0 && !p.isCurrentBenchmark);
    const highTidePoints = simulationPoints.filter((p) => p.tide >= 2.5 && !p.isCurrentBenchmark);

    let tideBreachMultiplier = 1.0;
    if (lowTidePoints.length > 0 && highTidePoints.length > 0) {
      const avgLow = lowTidePoints.reduce((s, p) => s + p.breachedAssets, 0) / lowTidePoints.length;
      const avgHigh = highTidePoints.reduce((s, p) => s + p.breachedAssets, 0) / highTidePoints.length;
      tideBreachMultiplier = avgLow > 0 ? Number((avgHigh / avgLow).toFixed(1)) : 2.5;
    }

    // 3. Max Loss Point
    const maxLossPoint = [...simulationPoints].sort((a, b) => b.lossMillions - a.lossMillions)[0];

    return {
      mangroveTwlSaving,
      mangroveBreachSaving,
      tideBreachMultiplier,
      maxLossPoint,
      totalRuns: simulationPoints.length,
    };
  }, [simulationPoints]);

  // Extract metric values
  const getMetricValue = (point: SimulationRunPoint, metric: XAxisMetric | YAxisMetric): number => {
    switch (metric) {
      case 'windSpeed':
        return point.windSpeed;
      case 'tide':
        return point.tide;
      case 'mangrove':
        return point.mangroveCoverage;
      case 'twl':
        return point.twl;
      case 'breachedAssets':
        return point.breachedAssets;
      case 'lossMillions':
        return point.lossMillions;
      case 'popAtRisk':
        return point.popAtRisk;
      case 'inundatedArea':
        return point.inundatedArea;
      default:
        return 0;
    }
  };

  const getMetricLabel = (metric: XAxisMetric | YAxisMetric): string => {
    switch (metric) {
      case 'windSpeed':
        return 'Wind Speed (km/h)';
      case 'tide':
        return 'Astronomical Tide (m)';
      case 'mangrove':
        return 'Mangrove Coverage (%)';
      case 'twl':
        return 'Total Water Level (m)';
      case 'breachedAssets':
        return 'Breached Critical Assets (Count)';
      case 'lossMillions':
        return 'Est. Economic Loss ($M USD)';
      case 'popAtRisk':
        return 'Exposed Population';
      case 'inundatedArea':
        return 'Flooded Area (km²)';
      default:
        return '';
    }
  };

  // Color mapping function
  const getPointColor = (point: SimulationRunPoint): string => {
    if (point.isCurrentBenchmark) {
      return '#06b6d4'; // Bright Cyan for current active scenario
    }
    if (colorGrouping === 'mangrove') {
      if (point.mangroveCoverage === 100) return '#10b981'; // Emerald
      if (point.mangroveCoverage === 50) return '#f59e0b'; // Amber
      return '#f43f5e'; // Rose / Red
    }
    if (colorGrouping === 'tide') {
      if (point.tide <= 1.0) return '#38bdf8'; // Sky
      if (point.tide <= 2.0) return '#818cf8'; // Indigo
      return '#c084fc'; // Purple
    }
    if (colorGrouping === 'category') {
      return point.categoryColor;
    }
    return '#38bdf8';
  };

  // Quick Preset Actions
  const applyPreset = (presetName: string) => {
    if (presetName === 'all') {
      setSelectedWinds([90, 130, 165, 210, 250]);
      setSelectedTides([0.6, 1.2, 1.85, 2.8, 3.6]);
      setSelectedMangroves([100, 50, 0]);
    } else if (presetName === 'mangrove_loss') {
      setSelectedWinds([165, 210]);
      setSelectedTides([1.85, 2.8]);
      setSelectedMangroves([100, 50, 0]);
      setXAxisMetric('mangrove');
      setYAxisMetric('breachedAssets');
      setColorGrouping('mangrove');
    } else if (presetName === 'tide_resonance') {
      setSelectedWinds([130, 165, 250]);
      setSelectedTides([0.6, 1.2, 1.85, 2.8, 3.6]);
      setSelectedMangroves([100, 0]);
      setXAxisMetric('tide');
      setYAxisMetric('twl');
      setColorGrouping('tide');
    } else if (presetName === 'wind_curve') {
      setSelectedWinds([90, 130, 165, 210, 250]);
      setSelectedTides([1.85]);
      setSelectedMangroves([100, 50, 0]);
      setXAxisMetric('windSpeed');
      setYAxisMetric('breachedAssets');
      setColorGrouping('category');
    }
  };

  // Export CSV of the sensitivity matrix
  const handleExportCsv = () => {
    const headers = [
      'Scenario Run ID',
      'Wind Speed (km/h)',
      'Astronomical Tide (m)',
      'Mangrove Coverage (%)',
      'Total Water Level (m)',
      'Pure Surge (m)',
      'Breached Assets Count',
      'De-energized Substations',
      'Impassable Roads',
      'Hospitals at Risk',
      'Est Economic Loss ($M)',
      'Population Exposed',
      'Is Active Benchmark',
    ];

    const rows = simulationPoints.map((p) => [
      `"${p.name}"`,
      p.windSpeed,
      p.tide,
      p.mangroveCoverage,
      p.twl,
      p.pureSurge,
      p.breachedAssets,
      p.deEnergizedSubstations,
      p.impassableRoads,
      p.criticalHospitals,
      p.lossMillions,
      p.popAtRisk,
      p.isCurrentBenchmark ? 'YES' : 'NO',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `bayshield_sensitivity_analysis_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle helpers
  const toggleWind = (w: number) => {
    if (selectedWinds.includes(w)) {
      if (selectedWinds.length > 1) setSelectedWinds(selectedWinds.filter((v) => v !== w));
    } else {
      setSelectedWinds([...selectedWinds, w].sort((a, b) => a - b));
    }
  };

  const toggleTide = (t: number) => {
    if (selectedTides.includes(t)) {
      if (selectedTides.length > 1) setSelectedTides(selectedTides.filter((v) => v !== t));
    } else {
      setSelectedTides([...selectedTides, t].sort((a, b) => a - b));
    }
  };

  const toggleMangrove = (m: number) => {
    if (selectedMangroves.includes(m)) {
      if (selectedMangroves.length > 1) setSelectedMangroves(selectedMangroves.filter((v) => v !== m));
    } else {
      setSelectedMangroves([...selectedMangroves, m].sort((a, b) => a - b));
    }
  };

  // SVG Scatter Plot Math
  const plotWidth = 380;
  const plotHeight = 240;
  const padding = { top: 20, right: 25, bottom: 42, left: 45 };
  const innerWidth = plotWidth - padding.left - padding.right;
  const innerHeight = plotHeight - padding.top - padding.bottom;

  // Min and max bounds for X & Y
  const xValues = filteredPoints.map((p) => getMetricValue(p, xAxisMetric));
  const yValues = filteredPoints.map((p) => getMetricValue(p, yAxisMetric));

  const minX = Math.min(0, ...xValues);
  const maxX = Math.max(1, ...xValues) * 1.08;

  const minY = 0;
  const maxY = Math.max(1, ...yValues) * 1.15;

  const scaleX = (val: number) => {
    if (maxX === minX) return padding.left + innerWidth / 2;
    return padding.left + ((val - minX) / (maxX - minX)) * innerWidth;
  };

  const scaleY = (val: number) => {
    if (maxY === minY) return padding.top + innerHeight / 2;
    return padding.top + innerHeight - ((val - minY) / (maxY - minY)) * innerHeight;
  };

  // Linear Regression Trendline for sensitivity slope
  const regressionLine = useMemo(() => {
    if (filteredPoints.length < 2 || !showTrendLine) return null;
    const n = filteredPoints.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    filteredPoints.forEach((p) => {
      const x = getMetricValue(p, xAxisMetric);
      const y = getMetricValue(p, yAxisMetric);
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    const startXVal = minX;
    const endXVal = maxX * 0.96;
    const startYVal = slope * startXVal + intercept;
    const endYVal = slope * endXVal + intercept;

    return {
      x1: scaleX(startXVal),
      y1: scaleY(Math.max(0, startYVal)),
      x2: scaleX(endXVal),
      y2: scaleY(Math.max(0, endYVal)),
      slope: Number(slope.toFixed(3)),
    };
  }, [filteredPoints, xAxisMetric, yAxisMetric, showTrendLine, minX, maxX, minY, maxY]);

  // Tick marks
  const xTicks = 5;
  const yTicks = 4;

  const xTickArray = Array.from({ length: xTicks + 1 }, (_, i) => {
    const val = minX + (i / xTicks) * (maxX - minX);
    return {
      val,
      pixel: scaleX(val),
      label: val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(val < 5 ? 1 : 0),
    };
  });

  const yTickArray = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minY + (i / yTicks) * (maxY - minY);
    return {
      val,
      pixel: scaleY(val),
      label: val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(val < 5 && val > 0 ? 1 : 0),
    };
  });

  return (
    <div className="p-3.5 space-y-4 text-xs font-sans text-slate-200">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
              <span>Sensitivity Analysis</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                {simulationPoints.length} Runs
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Multivariate parameter sweep across wind, tide & mangrove coverage
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 text-[11px]"
          title="Export CSV of all sensitivity run results"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* Preset Buttons Bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Presets:</span>
        </span>
        <button
          onClick={() => applyPreset('mangrove_loss')}
          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-900/60 font-medium transition"
        >
          🌿 Mangrove Loss Impact
        </button>
        <button
          onClick={() => applyPreset('tide_resonance')}
          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-900/60 font-medium transition"
        >
          🌊 Tide Resonance
        </button>
        <button
          onClick={() => applyPreset('wind_curve')}
          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-900/60 font-medium transition"
        >
          🌪️ Wind Escalation
        </button>
        <button
          onClick={() => applyPreset('all')}
          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium transition"
        >
          Full Matrix (75 Pts)
        </button>
      </div>

      {/* Multi-Variable Toggle Controls Matrix */}
      <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 space-y-3">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span className="uppercase tracking-wider text-[10px] text-slate-400">
            Multi-Variable Parameter Selection
          </span>
          <span className="text-[10px] font-mono text-cyan-400">
            {selectedWinds.length} Winds × {selectedTides.length} Tides × {selectedMangroves.length} Mangrove States
          </span>
        </div>

        {/* 1. Wind Speed Toggles */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Wind className="w-3 h-3 text-cyan-400" />
              <span>Cyclone Wind Speeds</span>
            </span>
            <span className="font-mono text-slate-400">{selectedWinds.length} Selected</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {AVAILABLE_WIND_LEVELS.map((item) => {
              const isSelected = selectedWinds.includes(item.value);
              return (
                <button
                  key={item.value}
                  onClick={() => toggleWind(item.value)}
                  className={`py-1 px-1 rounded-lg border text-center transition-all ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold shadow-sm ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
                  title={item.label}
                >
                  <div className="text-[11px] font-mono leading-tight">{item.value}</div>
                  <div className="text-[8px] opacity-75 truncate">{item.category}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Astronomical Tide Levels */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Waves className="w-3 h-3 text-sky-400" />
              <span>Astronomical Tidal Phase</span>
            </span>
            <span className="font-mono text-slate-400">{selectedTides.length} Selected</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {AVAILABLE_TIDE_LEVELS.map((item) => {
              const isSelected = selectedTides.includes(item.value);
              return (
                <button
                  key={item.value}
                  onClick={() => toggleTide(item.value)}
                  className={`py-1 px-1 rounded-lg border text-center transition-all ${
                    isSelected
                      ? 'bg-sky-950/80 border-sky-500 text-sky-200 font-bold shadow-sm ring-1 ring-sky-500/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
                  title={item.label}
                >
                  <div className="text-[11px] font-mono leading-tight">+{item.value}m</div>
                  <div className="text-[8px] opacity-75 truncate">{item.label.split(' ')[1] || 'Tide'}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Mangrove Bio-Shield Coverage */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Trees className="w-3 h-3 text-emerald-400" />
              <span>Mangrove Biosphere Buffer</span>
            </span>
            <span className="font-mono text-slate-400">{selectedMangroves.length} Selected</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {AVAILABLE_MANGROVE_LEVELS.map((item) => {
              const isSelected = selectedMangroves.includes(item.value);
              return (
                <button
                  key={item.value}
                  onClick={() => toggleMangrove(item.value)}
                  className={`py-1.5 px-2 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500 text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold">{item.value}%</span>
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                  <div className="text-[9px] opacity-80 leading-tight truncate">
                    {item.value === 100 ? 'Intact (-0.9m)' : item.value === 50 ? 'Degraded (-0.45m)' : 'Deforested (0m)'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scatter Plot Visualizer Controls */}
      <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-slate-200 text-xs">Multivariate Scatter Plot</span>
          </div>

          <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showTrendLine}
              onChange={(e) => setShowTrendLine(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>Trend Curve</span>
          </label>
        </div>

        {/* Axis Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">X-Axis Variable</label>
            <select
              value={xAxisMetric}
              onChange={(e) => setXAxisMetric(e.target.value as XAxisMetric)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="windSpeed">Wind Speed (km/h)</option>
              <option value="tide">Astronomical Tide (m)</option>
              <option value="mangrove">Mangrove Coverage (%)</option>
              <option value="twl">Total Water Level TWL (m)</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Y-Axis Impact</label>
            <select
              value={yAxisMetric}
              onChange={(e) => setYAxisMetric(e.target.value as YAxisMetric)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="breachedAssets">Breached Assets (Count)</option>
              <option value="twl">Total Water Level TWL (m)</option>
              <option value="lossMillions">Est. Loss ($M USD)</option>
              <option value="popAtRisk">Population at Risk</option>
              <option value="inundatedArea">Inundated Area (km²)</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Color Grouping</label>
            <select
              value={colorGrouping}
              onChange={(e) => setColorGrouping(e.target.value as ColorGrouping)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="mangrove">By Mangrove Status</option>
              <option value="tide">By Tidal Level</option>
              <option value="category">By Storm Category</option>
            </select>
          </div>
        </div>

        {/* SVG Scatter Plot Canvas */}
        <div className="relative bg-slate-950 rounded-xl border border-slate-800/80 p-2 overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${plotWidth} ${plotHeight}`}
            className="w-full h-auto overflow-visible"
          >
            {/* Background Grid Lines */}
            {xTickArray.map((t, idx) => (
              <line
                key={`grid-x-${idx}`}
                x1={t.pixel}
                y1={padding.top}
                x2={t.pixel}
                y2={padding.top + innerHeight}
                stroke="#1e293b"
                strokeDasharray="2 3"
                strokeWidth="1"
              />
            ))}
            {yTickArray.map((t, idx) => (
              <line
                key={`grid-y-${idx}`}
                x1={padding.left}
                y1={t.pixel}
                x2={padding.left + innerWidth}
                y2={t.pixel}
                stroke="#1e293b"
                strokeDasharray="2 3"
                strokeWidth="1"
              />
            ))}

            {/* Axes Lines */}
            <line
              x1={padding.left}
              y1={padding.top + innerHeight}
              x2={padding.left + innerWidth}
              y2={padding.top + innerHeight}
              stroke="#475569"
              strokeWidth="1.5"
            />
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + innerHeight}
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* Regression Sensitivity Curve */}
            {regressionLine && (
              <line
                x1={regressionLine.x1}
                y1={regressionLine.y1}
                x2={regressionLine.x2}
                y2={regressionLine.y2}
                stroke="#38bdf8"
                strokeWidth="1.75"
                strokeDasharray="4 4"
                opacity="0.75"
              />
            )}

            {/* X-Axis Tick Labels */}
            {xTickArray.map((t, idx) => (
              <text
                key={`label-x-${idx}`}
                x={t.pixel}
                y={padding.top + innerHeight + 14}
                textAnchor="middle"
                fontSize="8"
                fill="#94a3b8"
                fontFamily="monospace"
              >
                {t.label}
              </text>
            ))}

            {/* Y-Axis Tick Labels */}
            {yTickArray.map((t, idx) => (
              <text
                key={`label-y-${idx}`}
                x={padding.left - 6}
                y={t.pixel + 3}
                textAnchor="end"
                fontSize="8"
                fill="#94a3b8"
                fontFamily="monospace"
              >
                {t.label}
              </text>
            ))}

            {/* Axis Title Labels */}
            <text
              x={padding.left + innerWidth / 2}
              y={plotHeight - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#cbd5e1"
              fontWeight="600"
            >
              {getMetricLabel(xAxisMetric)}
            </text>

            <text
              x={-padding.top - innerHeight / 2}
              y="12"
              transform="rotate(-90)"
              textAnchor="middle"
              fontSize="9"
              fill="#cbd5e1"
              fontWeight="600"
            >
              {getMetricLabel(yAxisMetric)}
            </text>

            {/* Scatter Data Points */}
            {filteredPoints.map((point) => {
              const cx = scaleX(getMetricValue(point, xAxisMetric));
              const cy = scaleY(getMetricValue(point, yAxisMetric));
              const isHovered = hoveredPoint?.id === point.id;
              const isSelected = selectedPoint?.id === point.id;
              const isCurrent = point.isCurrentBenchmark;
              const pointColor = getPointColor(point);

              return (
                <g
                  key={point.id}
                  className="cursor-pointer transition-transform duration-100"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={() => setSelectedPoint(point)}
                >
                  {/* Current Active Scenario Halo & Pulsing Ring */}
                  {isCurrent && (
                    <>
                      <circle
                        cx={cx}
                        cy={cy}
                        r="12"
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                        className="animate-spin"
                        style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: '6s' }}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r="9"
                        fill="#06b6d4"
                        fillOpacity="0.25"
                      />
                    </>
                  )}

                  {/* Highlight Ring for Selected / Hovered */}
                  {(isHovered || isSelected) && !isCurrent && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="9"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Primary Point Marker */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isCurrent ? 6 : isHovered ? 5.5 : 4}
                    fill={pointColor}
                    stroke={isCurrent ? '#ffffff' : '#0f172a'}
                    strokeWidth={isCurrent ? 2 : 1}
                    className="hover:scale-125 transition-transform"
                  />
                </g>
              );
            })}
          </svg>

          {/* Current Benchmark Legend Indicator */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-cyan-500/50 text-[9px] font-mono text-cyan-300 shadow">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Active Scenario Benchmark</span>
          </div>
        </div>

        {/* Active / Hovered Point Detail Inspection Card */}
        {(hoveredPoint || selectedPoint) && (
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2 animate-in fade-in duration-100">
            {(() => {
              const active = hoveredPoint || selectedPoint!;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: getPointColor(active) }}
                      />
                      <strong className="text-xs text-slate-100">{active.name}</strong>
                    </div>
                    {active.isCurrentBenchmark && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700">
                        ACTIVE BENCHMARK
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                    <div className="p-1 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">TWL Peak</span>
                      <span className="font-mono font-bold text-cyan-300">+{active.twl}m</span>
                    </div>

                    <div className="p-1 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Breached Assets</span>
                      <span className={`font-mono font-bold ${active.breachedAssets > 5 ? 'text-rose-400' : 'text-amber-300'}`}>
                        {active.breachedAssets} / {infrastructure.length}
                      </span>
                    </div>

                    <div className="p-1 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Est. Losses</span>
                      <span className="font-mono font-bold text-amber-400">${active.lossMillions}M</span>
                    </div>

                    <div className="p-1 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Exposed Pop</span>
                      <span className="font-mono font-bold text-purple-300">{active.popAtRisk.toLocaleString()}</span>
                    </div>
                  </div>

                  {onApplyParameters && !active.isCurrentBenchmark && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-[10px] text-slate-400 italic">
                        Want to test this condition in the live app?
                      </span>
                      <button
                        onClick={() =>
                          onApplyParameters(
                            active.windSpeed,
                            active.tide,
                            active.mangroveCoverage > 0
                          )
                        }
                        className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 transition shadow-sm"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Apply to Live Simulation</span>
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Statistical Sensitivity & Elasticity Insights */}
      {insights && (
        <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sensitivity & Elasticity Insights</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Regression Slope: {regressionLine?.slope || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
            {/* Mangrove Buffer Benefit */}
            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-900/60 space-y-0.5">
              <div className="text-emerald-400 font-bold flex items-center gap-1">
                <Trees className="w-3.5 h-3.5" />
                <span>Mangrove Mitigation</span>
              </div>
              <div className="text-slate-300 leading-snug">
                Sundarbans buffer averts{' '}
                <strong className="text-emerald-300 font-mono">~{insights.mangroveTwlSaving}m</strong> surge depth and saves an avg of{' '}
                <strong className="text-emerald-300 font-mono">~{insights.mangroveBreachSaving} critical facilities</strong> from breach.
              </div>
            </div>

            {/* Tide Resonance */}
            <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-900/60 space-y-0.5">
              <div className="text-sky-400 font-bold flex items-center gap-1">
                <Waves className="w-3.5 h-3.5" />
                <span>Tidal Risk Factor</span>
              </div>
              <div className="text-slate-300 leading-snug">
                Spring / King high tide increases breached critical assets by{' '}
                <strong className="text-sky-300 font-mono">{insights.tideBreachMultiplier}x</strong> compared to low neap landfall.
              </div>
            </div>

            {/* Worst Case Loss */}
            <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/60 space-y-0.5">
              <div className="text-rose-400 font-bold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Worst-Case Threshold</span>
              </div>
              <div className="text-slate-300 leading-snug">
                Max breach point reaches{' '}
                <strong className="text-rose-300 font-mono">
                  ${insights.maxLossPoint?.lossMillions}M
                </strong>{' '}
                loss at {insights.maxLossPoint?.windSpeed} km/h with 0% mangrove cover.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
