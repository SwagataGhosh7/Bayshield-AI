import React, { useState, useEffect, useMemo } from 'react';
import {
  CycloneScenario,
  InfrastructureNode,
  InfrastructureType,
} from '../types/cyclone';
import { CalculatedSurgeMetrics, evaluateNodeVulnerability } from '../services/surgePhysics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  FileText,
  Sparkles,
  Download,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Droplets,
  Wind,
  Users,
  Building,
  CheckCircle2,
  Clock,
  Share2,
  BarChart3,
  Zap,
  Navigation,
  HeartPulse,
  Home,
  Anchor,
  TrendingUp,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ImpactSummaryReportProps {
  scenario: CycloneScenario;
  surgeMetrics: CalculatedSurgeMetrics;
  infrastructure: InfrastructureNode[];
  timeOffset: number;
  mangroveOverride: boolean;
}

export const ImpactSummaryReport: React.FC<ImpactSummaryReportProps> = ({
  scenario,
  surgeMetrics,
  infrastructure,
  timeOffset,
  mangroveOverride,
}) => {
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [generatedTimestamp, setGeneratedTimestamp] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [focusMode, setFocusMode] = useState<'comprehensive' | 'executive' | 'infrastructure' | 'humanitarian'>('comprehensive');
  const [generatedForHash, setGeneratedForHash] = useState<string>('');
  const [chartMetricMode, setChartMetricMode] = useState<'statusCounts' | 'riskAndSurge'>('statusCounts');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<InfrastructureType | null>(null);
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(true);

  // Quantitative category damage metrics for Recharts visualization
  const categoryDamageData = useMemo(() => {
    const categoryDefs: Array<{
      type: InfrastructureType;
      label: string;
      shortLabel: string;
      color: string;
    }> = [
      { type: 'substation', label: 'Power Grid Substations', shortLabel: 'Power', color: '#f59e0b' },
      { type: 'road', label: 'Arterials & Causeways', shortLabel: 'Roads', color: '#38bdf8' },
      { type: 'hospital', label: 'Hospitals & Medical', shortLabel: 'Hospitals', color: '#f43f5e' },
      { type: 'shelter', label: 'Cyclone Shelters', shortLabel: 'Shelters', color: '#10b981' },
      { type: 'water_plant', label: 'Water Treatment', shortLabel: 'Water', color: '#60a5fa' },
      { type: 'port', label: 'Ports & Marine Docks', shortLabel: 'Ports', color: '#c084fc' },
    ];

    return categoryDefs.map((cat) => {
      const nodes = infrastructure.filter((n) => n.type === cat.type);
      const evaluated = nodes.map((node) => {
        const vuln = evaluateNodeVulnerability(node, surgeMetrics.totalWaterLevelMeters, scenario.windSpeed);
        return {
          ...node,
          vuln,
          floodDepthMeters: vuln.floodDepthMeters,
          riskScore: vuln.riskScore,
          status: vuln.status,
          urgentRecommendation: vuln.urgentRecommendation,
        };
      });

      const totalNodes = nodes.length;
      const criticalNodes = evaluated.filter(
        (n) => n.status === 'critical' || n.status === 'de_energized' || n.riskScore >= 75
      ).length;
      const warningNodes = evaluated.filter(
        (n) =>
          (n.status === 'warning' || n.status === 'flooded' || n.riskScore >= 50) &&
          !(n.status === 'critical' || n.status === 'de_energized' || n.riskScore >= 75)
      ).length;
      const safeNodes = Math.max(0, totalNodes - criticalNodes - warningNodes);

      const avgRiskScore = totalNodes > 0
        ? Math.round(evaluated.reduce((acc, n) => acc + n.riskScore, 0) / totalNodes)
        : 0;

      const maxFloodDepth = totalNodes > 0
        ? Number(Math.max(0, ...evaluated.map((n) => n.floodDepthMeters)).toFixed(2))
        : 0;

      const inundatedCount = evaluated.filter((n) => n.vuln.isInundated || n.floodDepthMeters > 0).length;

      return {
        category: cat.type,
        categoryLabel: cat.label,
        shortLabel: cat.shortLabel,
        color: cat.color,
        totalNodes,
        criticalNodes,
        warningNodes,
        safeNodes,
        avgRiskScore,
        maxFloodDepth,
        inundatedCount,
        evaluatedNodes: evaluated,
      };
    });
  }, [infrastructure, surgeMetrics.totalWaterLevelMeters, scenario.windSpeed]);

  const highestRiskCategory = useMemo(() => {
    if (categoryDamageData.length === 0) return null;
    return [...categoryDamageData].sort((a, b) => b.avgRiskScore - a.avgRiskScore)[0];
  }, [categoryDamageData]);

  const totalCriticalNodes = useMemo(() => {
    return categoryDamageData.reduce((acc, c) => acc + c.criticalNodes, 0);
  }, [categoryDamageData]);

  const totalWarningNodes = useMemo(() => {
    return categoryDamageData.reduce((acc, c) => acc + c.warningNodes, 0);
  }, [categoryDamageData]);

  // Calculate current vulnerable nodes
  const vulnerableNodes = infrastructure
    .map((node) => {
      const vuln = evaluateNodeVulnerability(node, surgeMetrics.totalWaterLevelMeters, scenario.windSpeed);
      return {
        ...node,
        floodDepthMeters: vuln.floodDepthMeters,
        isInundated: vuln.isInundated,
        riskScore: vuln.riskScore,
        status: vuln.status,
        urgentRecommendation: vuln.urgentRecommendation,
      };
    })
    .filter((n) => n.isInundated || n.riskScore >= 60);

  // Compute a state hash to detect when metrics have updated
  const currentMetricsHash = `${scenario.id}-${timeOffset}-${surgeMetrics.totalWaterLevelMeters}-${mangroveOverride}-${focusMode}`;
  const isStale = generatedForHash !== '' && generatedForHash !== currentMetricsHash;

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gemini/generate-impact-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: {
            id: scenario.id,
            name: scenario.name,
            category: scenario.category,
            windSpeed: scenario.windSpeed,
            centralPressure: scenario.centralPressure,
            forwardSpeed: scenario.forwardSpeed,
            landfallTarget: scenario.landfallTarget,
            landfallETA: scenario.landfallETA,
          },
          surgeMetrics: {
            totalWaterLevelMeters: surgeMetrics.totalWaterLevelMeters,
            pureSurgeMeters: surgeMetrics.pureSurgeMeters,
            astronomicalTideMeters: surgeMetrics.astronomicalTideMeters,
            inverseBarometerMeters: surgeMetrics.inverseBarometerMeters,
            windSetupMeters: surgeMetrics.windSetupMeters,
            bathymetricAmplificationFactor: surgeMetrics.bathymetricAmplificationFactor,
            populationAtRisk: surgeMetrics.populationAtRisk,
            inundationAreaSqKm: surgeMetrics.inundationAreaSqKm,
          },
          vulnerableInfrastructure: vulnerableNodes.map((n) => ({
            name: n.name,
            type: n.type,
            elevationMeters: n.elevationMeters,
            floodDepthMeters: n.floodDepthMeters,
            status: n.status,
            riskScore: n.riskScore,
            recommendedAction: n.urgentRecommendation,
          })),
          timeOffset,
          mangroveOverride,
          focusMode,
        }),
      });

      const json = await res.json();
      if (json.data && json.data.reportMarkdown) {
        setReportMarkdown(json.data.reportMarkdown);
        setModelUsed(json.data.modelUsed || 'gemini-3.8-flash');
        setGeneratedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setGeneratedForHash(currentMetricsHash);
      }
    } catch (err) {
      console.error('Failed to generate impact summary report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate on first mount if not yet generated
  useEffect(() => {
    if (!reportMarkdown && !isLoading) {
      handleGenerateReport();
    }
  }, []);

  const handleCopy = () => {
    if (!reportMarkdown) return;
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!reportMarkdown) return;
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impact_assessment_${scenario.id}_T${timeOffset >= 0 ? `+${timeOffset}` : timeOffset}h.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Human-readable formatted renderer for Markdown
  const renderFormattedReport = (markdown: string) => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let tableHeader: string[] = [];

    const flushTable = (key: number) => {
      if (tableHeader.length > 0 || tableRows.length > 0) {
        elements.push(
          <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs border-collapse">
              {tableHeader.length > 0 && (
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-300 font-semibold">
                    {tableHeader.map((th, i) => (
                      <th key={i} className="py-2 px-3">{th.trim()}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-slate-900/60 hover:bg-slate-900/40">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 text-slate-300">
                        {renderInlineFormatted(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeader = [];
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Table row detection
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cols = trimmed.slice(1, -1).split('|');
        // Check if separator row
        if (cols.every((c) => c.trim().match(/^:?-+:?$/))) {
          return;
        }
        if (tableHeader.length === 0 && tableRows.length === 0) {
          tableHeader = cols;
        } else {
          tableRows.push(cols);
        }
        return;
      } else if (inTable) {
        flushTable(index);
      }

      if (trimmed === '---') {
        elements.push(<hr key={index} className="my-3 border-slate-800" />);
        return;
      }

      // Headers
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-base font-bold text-slate-100 flex items-center gap-2 mt-4 mb-2 pb-1.5 border-b border-slate-800">
            {trimmed.replace('# ', '')}
          </h1>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-sm font-bold text-cyan-300 flex items-center gap-1.5 mt-3 mb-1.5 pt-1">
            {trimmed.replace('## ', '')}
          </h2>
        );
      } else if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-xs font-semibold text-amber-300 uppercase tracking-wider mt-2.5 mb-1">
            {trimmed.replace('### ', '')}
          </h3>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.replace(/^[-*]\s+/, '');
        elements.push(
          <div key={index} className="flex items-start gap-2 my-1 text-xs text-slate-300 pl-1 leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
            <div>{renderInlineFormatted(bulletText)}</div>
          </div>
        );
      } else if (trimmed.match(/^\d+\.\s+/)) {
        const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberMatch) {
          elements.push(
            <div key={index} className="flex items-start gap-2 my-1 text-xs text-slate-300 pl-1 leading-relaxed">
              <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.2 rounded shrink-0">
                {numberMatch[1]}
              </span>
              <div>{renderInlineFormatted(numberMatch[2])}</div>
            </div>
          );
        }
      } else if (trimmed === '') {
        elements.push(<div key={index} className="h-1.5" />);
      } else {
        elements.push(
          <p key={index} className="text-xs text-slate-300 my-1 leading-relaxed">
            {renderInlineFormatted(trimmed)}
          </p>
        );
      }
    });

    if (inTable) {
      flushTable(lines.length);
    }

    return elements;
  };

  // Inline formatting helper for **bold**, *italic*, and `code`
  const renderInlineFormatted = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className="italic text-slate-300">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="font-mono text-[11px] bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-amber-300">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-3.5 text-slate-200">
      {/* Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                AI Impact Assessment Summary
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Text-based human-readable operational brief synthesized from live hydrodynamics & vulnerable infrastructure
              </p>
            </div>
          </div>
        </div>

        {/* Live Metrics Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1">
              <Droplets className="w-3 h-3 text-cyan-400" />
              Total Water Level
            </div>
            <div className="font-mono font-bold text-sm text-cyan-300 mt-0.5">
              {surgeMetrics.totalWaterLevelMeters.toFixed(2)}m
            </div>
            <div className="text-[10px] text-slate-400">
              Surge: +{surgeMetrics.pureSurgeMeters.toFixed(1)}m | Tide: +{surgeMetrics.astronomicalTideMeters.toFixed(1)}m
            </div>
          </div>

          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1">
              <Wind className="w-3 h-3 text-amber-400" />
              Sustained Winds
            </div>
            <div className="font-mono font-bold text-sm text-amber-300 mt-0.5">
              {scenario.windSpeed} km/h
            </div>
            <div className="text-[10px] text-slate-400">
              Gusts: {Math.round(scenario.windSpeed * 1.25)} km/h
            </div>
          </div>

          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-purple-400" />
              Exposed Population
            </div>
            <div className="font-mono font-bold text-sm text-purple-300 mt-0.5">
              {surgeMetrics.populationAtRisk.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400">
              Over {surgeMetrics.inundationAreaSqKm} sq km
            </div>
          </div>

          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              Assets In Hazard
            </div>
            <div className="font-mono font-bold text-sm text-rose-300 mt-0.5">
              {vulnerableNodes.length} Critical
            </div>
            <div className="text-[10px] text-slate-400">
              Substations, roads, clinics
            </div>
          </div>
        </div>

        {/* Quantitative Infrastructure Damage Risk by Sector (Recharts Bar Chart) */}
        <div className="mt-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 shadow-md">
          {/* Chart Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
                  Infrastructure Damage Risk by Sector
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Recharts
                  </span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Quantitative vulnerability across critical asset classes under active surge (+{surgeMetrics.totalWaterLevelMeters.toFixed(1)}m TWL)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Metric Mode Switcher */}
              <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px]">
                <button
                  onClick={() => setChartMetricMode('statusCounts')}
                  className={`px-2 py-1 rounded transition font-medium ${
                    chartMetricMode === 'statusCounts'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="View distribution of Critical, Warning, and Safe asset counts"
                >
                  Asset Status
                </button>
                <button
                  onClick={() => setChartMetricMode('riskAndSurge')}
                  className={`px-2 py-1 rounded transition font-medium ${
                    chartMetricMode === 'riskAndSurge'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="View Average Composite Risk Score (%) and Peak Inundation (m)"
                >
                  Risk % & Flood
                </button>
              </div>

              {/* Collapse/Expand Toggle */}
              <button
                onClick={() => setIsChartExpanded(!isChartExpanded)}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
                title={isChartExpanded ? 'Collapse Chart' : 'Expand Chart'}
              >
                {isChartExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isChartExpanded && (
            <>
              {/* Quick Stat Pill Bar */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/80">
                  <div className="text-[9px] uppercase text-slate-500 font-semibold tracking-wider">
                    Highest Risk Sector
                  </div>
                  <div className="font-bold text-xs text-rose-400 truncate mt-0.5">
                    {highestRiskCategory ? `${highestRiskCategory.shortLabel} (${highestRiskCategory.avgRiskScore}%)` : 'N/A'}
                  </div>
                </div>

                <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/80">
                  <div className="text-[9px] uppercase text-slate-500 font-semibold tracking-wider">
                    Critical / De-Energized
                  </div>
                  <div className="font-bold text-xs text-amber-400 font-mono mt-0.5">
                    {totalCriticalNodes} Facilities
                  </div>
                </div>

                <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/80">
                  <div className="text-[9px] uppercase text-slate-500 font-semibold tracking-wider">
                    Warning / Vulnerable
                  </div>
                  <div className="font-bold text-xs text-cyan-300 font-mono mt-0.5">
                    {totalWarningNodes} Facilities
                  </div>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="h-56 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetricMode === 'statusCounts' ? (
                    <BarChart
                      data={categoryDamageData}
                      margin={{ top: 12, right: 10, left: -22, bottom: 4 }}
                      onClick={(e: any) => {
                        const payload = e?.activePayload;
                        if (payload && payload.length > 0) {
                          const cat = payload[0].payload.category;
                          setSelectedCategoryFilter(selectedCategoryFilter === cat ? null : cat);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                        allowDecimals={false}
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
                        formatter={(value: any, name: any) => [value, name]}
                        labelFormatter={(label) => {
                          const item = categoryDamageData.find((d) => d.shortLabel === label);
                          return item ? `${item.categoryLabel} (${item.totalNodes} Total Assets)` : label;
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                        iconSize={8}
                      />
                      <Bar
                        dataKey="criticalNodes"
                        name="Critical / De-Energized"
                        stackId="status"
                        fill="#ef4444"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="warningNodes"
                        name="Warning / Compromised"
                        stackId="status"
                        fill="#f59e0b"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="safeNodes"
                        name="Operational / Safe"
                        stackId="status"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  ) : (
                    <BarChart
                      data={categoryDamageData}
                      margin={{ top: 12, right: 10, left: -16, bottom: 4 }}
                      onClick={(e: any) => {
                        const payload = e?.activePayload;
                        if (payload && payload.length > 0) {
                          const cat = payload[0].payload.category;
                          setSelectedCategoryFilter(selectedCategoryFilter === cat ? null : cat);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="risk"
                        domain={[0, 100]}
                        tick={{ fill: '#f59e0b', fontSize: 10 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="depth"
                        orientation="right"
                        tick={{ fill: '#38bdf8', fontSize: 10 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                      />
                      <ReferenceLine
                        yAxisId="risk"
                        y={70}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        label={{
                          value: '70% Critical Breach',
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
                        formatter={(value: any, name: any) => {
                          if (name === 'Avg Risk Score (%)') return [`${value}%`, name];
                          if (name === 'Max Flood Depth (m)') return [`+${value}m`, name];
                          return [value, name];
                        }}
                        labelFormatter={(label) => {
                          const item = categoryDamageData.find((d) => d.shortLabel === label);
                          return item ? item.categoryLabel : label;
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                        iconSize={8}
                      />
                      <Bar
                        yAxisId="risk"
                        dataKey="avgRiskScore"
                        name="Avg Risk Score (%)"
                        radius={[4, 4, 0, 0]}
                      >
                        {categoryDamageData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.avgRiskScore >= 75
                                ? '#ef4444'
                                : entry.avgRiskScore >= 50
                                ? '#f59e0b'
                                : '#10b981'
                            }
                          />
                        ))}
                      </Bar>
                      <Bar
                        yAxisId="depth"
                        dataKey="maxFloodDepth"
                        name="Max Flood Depth (m)"
                        fill="#06b6d4"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Category Filter Chips / Mini Drill-down */}
              <div className="pt-1 border-t border-slate-900/80">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    <span>Sector Drill-down (click to inspect facilities):</span>
                  </span>
                  {selectedCategoryFilter && (
                    <button
                      onClick={() => setSelectedCategoryFilter(null)}
                      className="text-cyan-400 hover:underline font-mono"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {categoryDamageData.map((cat) => {
                    const isSelected = selectedCategoryFilter === cat.category;
                    return (
                      <button
                        key={cat.category}
                        onClick={() =>
                          setSelectedCategoryFilter(isSelected ? null : cat.category)
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition flex items-center gap-1 border ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              cat.criticalNodes > 0
                                ? '#ef4444'
                                : cat.warningNodes > 0
                                ? '#f59e0b'
                                : '#10b981',
                          }}
                        />
                        <span>{cat.shortLabel}</span>
                        <span className="font-mono text-[9px] text-slate-500">
                          ({cat.criticalNodes + cat.warningNodes}/{cat.totalNodes})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Filtered Asset List Preview */}
                {selectedCategoryFilter && (
                  <div className="mt-2 p-2 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1.5 text-xs animate-in fade-in">
                    <div className="font-semibold text-slate-200 text-[11px] flex items-center justify-between border-b border-slate-800/60 pb-1">
                      <span>
                        {categoryDamageData.find((d) => d.category === selectedCategoryFilter)?.categoryLabel} ({categoryDamageData.find((d) => d.category === selectedCategoryFilter)?.totalNodes} Facilities)
                      </span>
                      <span className="text-[10px] text-amber-300 font-mono font-bold">
                        Avg Risk: {categoryDamageData.find((d) => d.category === selectedCategoryFilter)?.avgRiskScore}%
                      </span>
                    </div>

                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {categoryDamageData
                        .find((d) => d.category === selectedCategoryFilter)
                        ?.evaluatedNodes.map((n) => (
                          <div
                            key={n.id}
                            className="p-1.5 rounded bg-slate-950 border border-slate-800/60 flex items-center justify-between text-[11px]"
                          >
                            <div className="truncate mr-2">
                              <span className="font-medium text-slate-200">{n.name}</span>
                              <div className="text-[10px] text-slate-400 truncate">
                                Elev: {n.elevationMeters}m | Flood: +{n.floodDepthMeters}m
                              </div>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0 ${
                                n.status === 'critical' || n.status === 'de_energized'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : n.status === 'warning' || n.status === 'flooded'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {n.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Focus Selector & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          {/* Focus Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5 text-xs">
            <button
              onClick={() => setFocusMode('comprehensive')}
              className={`px-2 py-1 rounded font-medium transition ${
                focusMode === 'comprehensive'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Comprehensive
            </button>
            <button
              onClick={() => setFocusMode('executive')}
              className={`px-2 py-1 rounded font-medium transition ${
                focusMode === 'executive'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Executive
            </button>
            <button
              onClick={() => setFocusMode('infrastructure')}
              className={`px-2 py-1 rounded font-medium transition ${
                focusMode === 'infrastructure'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Utilities & Grid
            </button>
            <button
              onClick={() => setFocusMode('humanitarian')}
              className={`px-2 py-1 rounded font-medium transition ${
                focusMode === 'humanitarian'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Humanitarian
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={handleGenerateReport}
              disabled={isLoading}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 transition shadow disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{reportMarkdown ? 'Refresh Report' : 'Generate Report'}</span>
                </>
              )}
            </button>

            {reportMarkdown && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition"
                  title="Copy formatted markdown to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition"
                  title="Download Markdown Report"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stale Metrics Notice */}
        {isStale && (
          <div className="p-2 rounded bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Surge metrics or timeline shifted since last report generation.</span>
            </div>
            <button
              onClick={handleGenerateReport}
              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-semibold transition"
            >
              Update Now
            </button>
          </div>
        )}
      </div>

      {/* Report Reader Card */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="relative">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-200 text-sm">
              Synthesizing Multi-Hazard Impact Assessment...
            </h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Analyzing shallow-shelf wind setup, polder overtopping dynamics, switchyard plinth levels, and population isolation cutoffs with Gemini 3.8 Flash.
            </p>
          </div>
        </div>
      ) : reportMarkdown ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 shadow-md">
          {/* Metadata Subheader */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Generated at {generatedTimestamp || 'Live'}</span>
              <span>•</span>
              <span className="font-mono text-cyan-400">{modelUsed}</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Standard Operations Bulletin</span>
            </div>
          </div>

          {/* Formatted Markdown Body */}
          <div className="prose prose-invert prose-sm max-w-none text-slate-300">
            {renderFormattedReport(reportMarkdown)}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center text-slate-400 space-y-2">
          <FileText className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-xs">No impact assessment generated yet.</p>
          <button
            onClick={handleGenerateReport}
            className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition"
          >
            Generate Impact Assessment
          </button>
        </div>
      )}
    </div>
  );
};
