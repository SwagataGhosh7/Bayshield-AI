import React, { useState, useMemo } from 'react';
import {
  HistoricalBreachAlertRecord,
  BreachSeverityLevel,
  InfrastructureType,
} from '../types/cyclone';
import {
  ShieldAlert,
  Flame,
  AlertTriangle,
  Clock,
  Download,
  Trash2,
  Search,
  Filter,
  ArrowUpDown,
  Zap,
  Activity,
  Navigation,
  Building,
  Anchor,
  Droplet,
  Home,
  CheckCircle2,
  Calendar,
  AlertOctagon,
  Layers,
  Info,
} from 'lucide-react';
import { downloadBreachAlertHistoryCsv } from '../utils/exportCsv';

interface AlertHistoryTabProps {
  alertHistory: HistoricalBreachAlertRecord[];
  onClearHistory: () => void;
  currentScenarioName: string;
  currentTimelineHour: number;
}

export const AlertHistoryTab: React.FC<AlertHistoryTabProps> = ({
  alertHistory,
  onClearHistory,
  currentScenarioName,
  currentTimelineHour,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'severity'>('newest');
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  // Statistics KPI calculation
  const stats = useMemo(() => {
    const total = alertHistory.length;
    const catastrophic = alertHistory.filter((r) => r.severity === 'CATASTROPHIC').length;
    const critical = alertHistory.filter((r) => r.severity === 'CRITICAL').length;
    const severe = alertHistory.filter((r) => r.severity === 'SEVERE').length;
    const warning = alertHistory.filter((r) => r.severity === 'WARNING').length;

    const uniqueNodes = new Set(alertHistory.map((r) => r.nodeId)).size;

    return { total, catastrophic, critical, severe, warning, uniqueNodes };
  }, [alertHistory]);

  // Filtered & sorted records
  const filteredRecords = useMemo(() => {
    return alertHistory
      .filter((record) => {
        // Severity filter
        if (selectedSeverity !== 'ALL' && record.severity !== selectedSeverity) {
          return false;
        }

        // Category filter
        if (selectedCategory !== 'ALL' && record.nodeType !== selectedCategory) {
          return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = record.nodeName.toLowerCase().includes(q);
          const matchDistrict = record.district.toLowerCase().includes(q);
          const matchDirective = record.operationalDirective.toLowerCase().includes(q);
          const matchReasons = record.breachReasons.some((r) => r.toLowerCase().includes(q));
          if (!matchName && !matchDistrict && !matchDirective && !matchReasons) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') {
          return b.sessionRelativeSeconds - a.sessionRelativeSeconds;
        }
        if (sortOrder === 'oldest') {
          return a.sessionRelativeSeconds - b.sessionRelativeSeconds;
        }
        if (sortOrder === 'severity') {
          const weight = (s: BreachSeverityLevel) => {
            if (s === 'CATASTROPHIC') return 4;
            if (s === 'CRITICAL') return 3;
            if (s === 'SEVERE') return 2;
            return 1;
          };
          return weight(b.severity) - weight(a.severity);
        }
        return 0;
      });
  }, [alertHistory, selectedSeverity, selectedCategory, searchQuery, sortOrder]);

  const getNodeIcon = (type: InfrastructureType | string) => {
    switch (type) {
      case 'substation':
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'hospital':
        return <Activity className="w-3.5 h-3.5 text-rose-400" />;
      case 'road':
        return <Navigation className="w-3.5 h-3.5 text-cyan-400" />;
      case 'water_plant':
        return <Droplet className="w-3.5 h-3.5 text-blue-400" />;
      case 'port':
        return <Anchor className="w-3.5 h-3.5 text-purple-400" />;
      case 'shelter':
        return <Home className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Building className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getSeverityBadge = (severity: BreachSeverityLevel) => {
    switch (severity) {
      case 'CATASTROPHIC':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase bg-red-950 text-red-300 border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] flex items-center gap-1 animate-pulse">
            <Flame className="w-3 h-3 text-red-400" />
            Catastrophic
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-950 text-rose-300 border border-rose-600 flex items-center gap-1">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            Critical
          </span>
        );
      case 'SEVERE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-amber-950 text-amber-300 border border-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Severe
          </span>
        );
      case 'WARNING':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-yellow-950/80 text-yellow-300 border border-yellow-700 flex items-center gap-1">
            <Info className="w-3 h-3 text-yellow-400" />
            Warning
          </span>
        );
    }
  };

  const handleExport = () => {
    if (alertHistory.length === 0) return;
    downloadBreachAlertHistoryCsv(alertHistory);
  };

  return (
    <div className="space-y-3.5 text-xs text-slate-200">
      {/* Session KPI Summary Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-0.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Total Events</span>
            <Clock className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-xl font-extrabold font-mono text-cyan-300">{stats.total}</div>
          <div className="text-[10px] text-slate-500 truncate">Current simulation session</div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-red-900/50 space-y-0.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Catastrophic</span>
            <Flame className="w-3 h-3 text-red-400" />
          </div>
          <div className="text-xl font-extrabold font-mono text-red-400">{stats.catastrophic}</div>
          <div className="text-[10px] text-red-400/70 truncate">Overtopping &gt;1.5m</div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-rose-900/50 space-y-0.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Critical</span>
            <AlertOctagon className="w-3 h-3 text-rose-400" />
          </div>
          <div className="text-xl font-extrabold font-mono text-rose-300">{stats.critical}</div>
          <div className="text-[10px] text-rose-400/70 truncate">Immediate directive breach</div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-0.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Unique Assets</span>
            <ShieldAlert className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold font-mono text-amber-300">{stats.uniqueNodes}</div>
          <div className="text-[10px] text-slate-500 truncate">Facilities impacted</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, and Export Actions */}
      <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Live Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search breach history by asset, district, or directive..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExport}
              disabled={alertHistory.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition shadow-sm active:scale-95"
              title="Download RFC 4180 CSV audit log of all logged infrastructure breaches"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>

            {confirmClear ? (
              <div className="flex items-center gap-1 bg-red-950 p-0.5 rounded-lg border border-red-700">
                <button
                  onClick={() => {
                    onClearHistory();
                    setConfirmClear(false);
                  }}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] transition"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-1.5 py-1 rounded text-slate-300 hover:text-white text-[10px]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={alertHistory.length === 0}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                title="Clear current simulation session breach history log"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
          {/* Severity Filters */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-slate-500 text-[10px] uppercase font-bold mr-1">Severity:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'CATASTROPHIC', label: 'Catastrophic', color: 'text-red-400' },
              { id: 'CRITICAL', label: 'Critical', color: 'text-rose-400' },
              { id: 'SEVERE', label: 'Severe', color: 'text-amber-400' },
              { id: 'WARNING', label: 'Warning', color: 'text-yellow-400' },
            ].map((sev) => (
              <button
                key={sev.id}
                onClick={() => setSelectedSeverity(sev.id)}
                className={`px-2 py-0.5 rounded font-medium transition text-[10px] ${
                  selectedSeverity === sev.id
                    ? 'bg-slate-800 text-white font-bold border border-slate-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={sev.color || ''}>{sev.label}</span>
              </button>
            ))}
          </div>

          {/* Category & Sorting Selectors */}
          <div className="flex items-center gap-2">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Categories</option>
              <option value="substation">Substations (Grid)</option>
              <option value="hospital">Hospitals (Medical)</option>
              <option value="road">Arterial Roads (Highways)</option>
              <option value="water_plant">Water Plants (Civic)</option>
              <option value="port">Ports (Maritime)</option>
              <option value="shelter">Cyclone Shelters</option>
            </select>

            {/* Sort Order Toggle */}
            <button
              onClick={() => {
                if (sortOrder === 'newest') setSortOrder('oldest');
                else if (sortOrder === 'oldest') setSortOrder('severity');
                else setSortOrder('newest');
              }}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1 transition"
              title="Toggle sort order between Newest, Oldest, and Highest Severity"
            >
              <ArrowUpDown className="w-3 h-3 text-cyan-400" />
              <span>
                {sortOrder === 'newest'
                  ? 'Newest'
                  : sortOrder === 'oldest'
                  ? 'Oldest'
                  : 'By Severity'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Log Feed List */}
      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <div
              key={record.id}
              className={`p-3 rounded-xl border transition space-y-2 select-text ${
                record.severity === 'CATASTROPHIC'
                  ? 'bg-slate-950/95 border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                  : record.severity === 'CRITICAL'
                  ? 'bg-slate-950/90 border-rose-600/60 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                  : record.severity === 'SEVERE'
                  ? 'bg-slate-950/80 border-amber-600/50'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              {/* Event Header: Timestamp, Timeline, Scenario & Severity */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Timestamp & Elapsed */}
                  <span className="font-mono text-[11px] font-bold text-slate-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    {record.timestamp}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    (Session +{record.sessionRelativeSeconds}s)
                  </span>

                  {/* Timeline Scrubber Phase */}
                  <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-slate-800 text-cyan-300 border border-slate-700">
                    {record.timelineLabel}
                  </span>

                  {/* Scenario Name Tag */}
                  <span className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]">
                    {record.scenarioName}
                  </span>
                </div>

                {/* Severity Badge */}
                <div>{getSeverityBadge(record.severity)}</div>
              </div>

              {/* Facility Identity Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0">
                    {getNodeIcon(record.nodeType)}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-100 text-xs">{record.nodeName}</h5>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {record.nodeType.replace('_', ' ')} · {record.district}
                    </div>
                  </div>
                </div>

                {/* Risk Score Pill */}
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono font-bold text-xs ${
                      record.riskScore >= 80
                        ? 'text-rose-400'
                        : record.riskScore >= 50
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {record.riskScore}
                    <span className="text-[9px] text-slate-500">/100</span>
                  </span>
                </div>
              </div>

              {/* Quantitative Physical Telemetry Metrics */}
              <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[10px]">
                <div>
                  <span className="text-slate-500 block">Total Water Level:</span>
                  <strong className="text-cyan-300 font-mono">
                    {record.totalWaterLevelMeters.toFixed(2)}m
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Flood Inundation:</span>
                  <strong
                    className={`font-mono font-bold ${
                      record.floodDepthMeters > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {record.floodDepthMeters > 0
                      ? `+${record.floodDepthMeters.toFixed(2)}m`
                      : '0.00m Dry'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Cyclone Wind:</span>
                  <strong className="text-rose-300 font-mono">{record.windSpeedKmh} km/h</strong>
                </div>
              </div>

              {/* Breach Reasons */}
              {record.breachReasons && record.breachReasons.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Breach Criteria:
                  </div>
                  {record.breachReasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300 leading-tight">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Operational Directive Box */}
              {record.operationalDirective && (
                <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/60 text-[11px] text-rose-200 leading-tight">
                  <strong className="text-rose-300 uppercase tracking-wider text-[10px] block mb-0.5">
                    Operational Directive:
                  </strong>
                  {record.operationalDirective}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              {searchQuery || selectedSeverity !== 'ALL' || selectedCategory !== 'ALL' ? (
                <Filter className="w-5 h-5 text-slate-400" />
              ) : (
                <Clock className="w-5 h-5 text-slate-400" />
              )}
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-slate-200 text-xs">
                {searchQuery || selectedSeverity !== 'ALL' || selectedCategory !== 'ALL'
                  ? 'No Breach Alerts Match Filter'
                  : 'No Infrastructure Breaches Logged Yet'}
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                {searchQuery || selectedSeverity !== 'ALL' || selectedCategory !== 'ALL'
                  ? 'Try clearing the search query or changing the severity / category filters above.'
                  : 'As the cyclone simulation runs or as you scrub the timeline towards peak surge (T-0h Landfall), all infrastructure safety threshold breaches are recorded here in real-time.'}
              </p>
            </div>

            {(searchQuery || selectedSeverity !== 'ALL' || selectedCategory !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSeverity('ALL');
                  setSelectedCategory('ALL');
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium transition"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
