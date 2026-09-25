import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Waves,
  Zap,
  Wind,
  Flame,
  X,
  RotateCcw,
} from 'lucide-react';

interface InteractiveMapLegendProps {
  totalWaterLevel: number;
  activeFilter?: string | null;
  onSelectFilter?: (filter: string | null) => void;
  mangroveOverride?: boolean;
  showHeatmap?: boolean;
  onToggleHeatmap?: () => void;
}

export const InteractiveMapLegend: React.FC<InteractiveMapLegendProps> = ({
  totalWaterLevel,
  activeFilter = null,
  onSelectFilter,
  mangroveOverride = true,
  showHeatmap = false,
  onToggleHeatmap,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'surge' | 'infrastructure' | 'wind' | 'heatmap'>('surge');
  const [hoveredItem, setHoveredItem] = useState<{
    title: string;
    description: string;
    action: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent Leaflet map click, zoom, pan, or wheel scroll propagation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);

    const handleWheel = (e: WheelEvent) => {
      // Prevent Leaflet from intercepting mousewheel to zoom the map
      e.stopPropagation();
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleFilterClick = (e: React.MouseEvent, filterKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onSelectFilter) return;
    if (activeFilter === filterKey) {
      onSelectFilter(null);
    } else {
      onSelectFilter(filterKey);
    }
  };

  const handleClearFilter = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSelectFilter) {
      onSelectFilter(null);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="interactive-map-legend absolute bottom-4 right-4 z-20 max-w-[340px] w-full text-xs font-sans pointer-events-auto select-none"
    >
      {/* Legend Card Container */}
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/5 transition-all duration-200">
        {/* Header Bar */}
        <div
          onClick={handleToggleExpand}
          className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/90 cursor-pointer border-b border-slate-800/80 hover:bg-slate-950 transition select-none"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-slate-100 text-xs">Interactive Map Legend</span>
              <span className="text-[10px] text-cyan-400 font-mono ml-2">
                {totalWaterLevel.toFixed(1)}m TWL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            {activeFilter && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="text-[9px] bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 px-1.5 py-0.5 rounded font-mono flex items-center gap-1 transition"
                title="Clear Active Map Filter"
              >
                <span>Filter: {activeFilter}</span>
                <X className="w-2.5 h-2.5 text-cyan-400" />
              </button>
            )}
            <div
              className="p-1 text-slate-400 hover:text-slate-200 transition-colors pointer-events-none"
              aria-hidden="true"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Expanded Body */}
        {isExpanded && (
          <div className="p-3 space-y-2.5">
            {/* Category Switcher Tabs */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('surge');
                }}
                className={`flex-1 py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
                  activeTab === 'surge'
                    ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Waves className="w-3 h-3" />
                <span>Surge</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('infrastructure');
                }}
                className={`flex-1 py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
                  activeTab === 'infrastructure'
                    ? 'bg-slate-800 text-amber-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Assets</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('wind');
                }}
                className={`flex-1 py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
                  activeTab === 'wind'
                    ? 'bg-slate-800 text-rose-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wind className="w-3 h-3" />
                <span>Wind</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('heatmap');
                }}
                className={`flex-1 py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
                  activeTab === 'heatmap'
                    ? 'bg-slate-800 text-orange-400 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3 h-3 text-orange-400" />
                <span>Heatmap</span>
              </button>
            </div>

            {/* Scrollable Tab Content Container */}
            <div className="max-h-[240px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
              {/* TAB 1: SURGE INTENSITY & FLOOD CONTOURS */}
              {activeTab === 'surge' && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between pb-0.5">
                    <span>Surge Depth & Inundation Severity</span>
                    <span className="text-[9px] text-slate-500">Click to filter</span>
                  </div>

                  {/* Surge Levels */}
                  {[
                    {
                      key: 'catastrophic',
                      label: '>3.5m Critical Surge',
                      range: '3.5m - 5.5m+',
                      color: 'bg-red-600',
                      border: 'border-red-400',
                      desc: 'Full overtopping of coastal polder earthen embankments.',
                      action: 'Mandatory zero-casualty forced evacuation within 6h.',
                    },
                    {
                      key: 'severe',
                      label: '2.0m - 3.5m Severe Surge',
                      range: '2.0m - 3.5m',
                      color: 'bg-orange-600',
                      border: 'border-orange-400',
                      desc: 'Primary arterial roads and agricultural lowlands inundated.',
                      action: 'Substation sectional de-energization and road diversions.',
                    },
                    {
                      key: 'moderate',
                      label: '1.0m - 2.0m Moderate Surge',
                      range: '1.0m - 2.0m',
                      color: 'bg-yellow-600',
                      border: 'border-yellow-400',
                      desc: 'Estuary backwater choking and localized causeway flooding.',
                      action: 'Standby pump deployment and small craft harbor moorings.',
                    },
                    {
                      key: 'low',
                      label: '<1.0m Low Inundation',
                      range: '0.3m - 1.0m',
                      color: 'bg-emerald-600',
                      border: 'border-emerald-400',
                      desc: 'High astronomical tidal splash contained within seawalls.',
                      action: 'Monitoring of sluice gates and drainage channels.',
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      onMouseEnter={() =>
                        setHoveredItem({
                          title: item.label,
                          description: item.desc,
                          action: item.action,
                        })
                      }
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={(e) => handleFilterClick(e, item.key)}
                      className={`flex items-center justify-between p-1.5 rounded-lg border transition cursor-pointer select-none ${
                        activeFilter === item.key
                          ? 'bg-slate-800 border-cyan-400 ring-1 ring-cyan-500/50 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded ${item.color} border ${item.border} shadow-sm shrink-0`} />
                        <span className="text-slate-200 font-medium text-[11px]">{item.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{item.range}</span>
                    </div>
                  ))}

                  {/* Mangrove Bioshield Row */}
                  <div
                    onMouseEnter={() =>
                      setHoveredItem({
                        title: 'Sundarbans & Coastal Mangrove Bioshield',
                        description: 'Dense Rhizophora/Avicennia mangrove root complex creates hydrodynamic drag.',
                        action: mangroveOverride
                          ? 'Active nature-based defense reduces surge kinetic wave energy by -0.85m.'
                          : 'Degraded buffer provides zero attenuation.',
                      })
                    }
                    onMouseLeave={() => setHoveredItem(null)}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded bg-emerald-600/60 border border-emerald-400 shrink-0" />
                      <span className="text-emerald-300 font-medium">Mangrove Bioshield</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {mangroveOverride ? '-0.85m Energy Damping' : 'Degraded'}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 2: INFRASTRUCTURE ASSETS & STATUS */}
              {activeTab === 'infrastructure' && (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between pb-0.5">
                    <span>Sector Facility Icons</span>
                    <span className="text-[9px] text-slate-500">Filter on map</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {
                        key: 'substation',
                        symbol: '⚡',
                        label: 'Substation',
                        color: 'bg-amber-600/30 border-amber-500 text-amber-300',
                        desc: 'High-voltage grid distribution node feeding coastal blocks.',
                        action: 'Mandatory de-energization when water depth >0.8m.',
                      },
                      {
                        key: 'road',
                        symbol: '🛣',
                        label: 'Arterial Road',
                        color: 'bg-sky-600/30 border-sky-500 text-sky-300',
                        desc: 'Designated green corridor for evacuation and military convoys.',
                        action: 'Closed when culvert overtopping exceeds 0.4m.',
                      },
                      {
                        key: 'shelter',
                        symbol: '⌂',
                        label: 'Cyclone Shelter',
                        color: 'bg-cyan-600/30 border-cyan-500 text-cyan-300',
                        desc: 'Engineered multi-purpose reinforced concrete shelter.',
                        action: 'Level 2 vertical evacuation upon 1.5m flood stage.',
                      },
                      {
                        key: 'hospital',
                        symbol: '✚',
                        label: 'Hospital',
                        color: 'bg-rose-600/30 border-rose-500 text-rose-300',
                        desc: 'District hospital with trauma surgery & cold-chain storage.',
                        action: 'Elevate oxygen cylinders & switch to rooftop auxiliary diesel.',
                      },
                      {
                        key: 'water_plant',
                        symbol: '💧',
                        label: 'Water Plant',
                        color: 'bg-blue-600/30 border-blue-500 text-blue-300',
                        desc: 'Potable water desalination and pipeline distribution.',
                        action: 'Seal reservoirs to prevent saline aquifer contamination.',
                      },
                      {
                        key: 'port',
                        symbol: '⚓',
                        label: 'Port / Maritime',
                        color: 'bg-purple-600/30 border-purple-500 text-purple-300',
                        desc: 'Commercial river/sea port handling fuel, coal & cargo.',
                        action: 'Hoist Great Danger Signal No. 10; moor all barges.',
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        onMouseEnter={() =>
                          setHoveredItem({
                            title: item.label,
                            description: item.desc,
                            action: item.action,
                          })
                        }
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={(e) => handleFilterClick(e, item.key)}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition cursor-pointer select-none ${
                          activeFilter === item.key
                            ? 'bg-slate-800 border-cyan-400 ring-1 ring-cyan-500/50 shadow-sm'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${item.color} font-bold shrink-0`}
                        >
                          {item.symbol}
                        </div>
                        <span className="text-[11px] text-slate-200 truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Status Color Key */}
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      Operational Status Markers
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-400" />
                        <span>Operational</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-400" />
                        <span>Warning</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-rose-400" />
                        <span>Submerged</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: WIND RADII & METEOROLOGICAL ZONES */}
              {activeTab === 'wind' && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider pb-0.5">
                    Meteorological Radii & Eye Structure
                  </div>

                  {[
                    {
                      title: 'Eye of Cyclone',
                      icon: '◎',
                      color: 'border-cyan-400 bg-cyan-500/20 text-cyan-300',
                      desc: 'Calm center with lowest barometric pressure; eyewall replacement zone.',
                    },
                    {
                      title: '64-knot Hurricane Core (118+ km/h)',
                      icon: '🔴',
                      color: 'border-red-500 bg-red-950/40 text-red-300',
                      desc: 'Catastrophic destructuring of kutcha dwellings, uprooted transmission towers.',
                    },
                    {
                      title: '34-knot Gale Force Field (63+ km/h)',
                      icon: '🔵',
                      color: 'border-sky-500 bg-sky-950/40 text-sky-300',
                      desc: 'Threshold for suspending outdoor vehicle transit and small ferry operations.',
                    },
                    {
                      title: 'GPM Precipitation Rainband (>50 mm/h)',
                      icon: '🌊',
                      color: 'border-cyan-500 bg-cyan-950/40 text-cyan-300',
                      desc: 'High deluge spirals compounding river backwater flood choking.',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      onMouseEnter={() =>
                        setHoveredItem({
                          title: item.title,
                          description: item.desc,
                          action: 'Monitored continuously via ISRO INSAT-3DR & Sentinel-1 SAR.',
                        })
                      }
                      onMouseLeave={() => setHoveredItem(null)}
                      className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] space-y-0.5"
                    >
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <span>{item.icon}</span>
                        <span>{item.title}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">{item.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: D3 DAMAGE HEATMAP SPECTRUM */}
              {activeTab === 'heatmap' && (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between pb-0.5">
                    <span>D3.js Dynamic Damage Surface</span>
                    {onToggleHeatmap && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleHeatmap();
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono transition ${
                          showHeatmap
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {showHeatmap ? 'Layer ON' : 'Turn ON'}
                      </button>
                    )}
                  </div>

                  {/* Thermal Color Gradient Strip */}
                  <div className="space-y-1">
                    <div className="h-3 rounded-md w-full bg-gradient-to-r from-[#000004] via-[#721f81] via-[#cd4071] via-[#fd9668] to-[#fcfdbf] border border-slate-700/80 shadow-inner" />
                    <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                      <span>0% (Intact)</span>
                      <span>35% (Warning)</span>
                      <span>70% (Severe)</span>
                      <span>100% (Critical)</span>
                    </div>
                  </div>

                  {/* Heatmap Spectrum Breakdown */}
                  {[
                    {
                      level: 'Critical (80% - 100%)',
                      color: 'bg-[#fcfdbf] text-slate-950 font-bold',
                      border: 'border-yellow-200',
                      desc: 'Combined eyewall windshear & >3m surge overtopping.',
                      action: 'Complete polder breach and substation explosion threshold.',
                    },
                    {
                      level: 'Severe (50% - 80%)',
                      color: 'bg-[#cd4071] text-white',
                      border: 'border-rose-400',
                      desc: 'Primary arterial causeways impassable. Transformer de-energization.',
                      action: 'High-axle disaster rescue convoys and emergency pumps.',
                    },
                    {
                      level: 'Moderate (25% - 50%)',
                      color: 'bg-[#721f81] text-purple-200',
                      border: 'border-purple-500',
                      desc: 'Estuary backwater ponding, saline ingress into drinking ponds.',
                      action: 'Pre-emptive evacuation of vulnerable thatched dwellings.',
                    },
                    {
                      level: 'Baseline (<25%)',
                      color: 'bg-[#000004] text-slate-400',
                      border: 'border-slate-800',
                      desc: 'Peripheral tropical-depression wind & high astronomical tide splash.',
                      action: 'Continuous satellite scatterometer and radar tracking.',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      onMouseEnter={() =>
                        setHoveredItem({
                          title: item.level,
                          description: item.desc,
                          action: item.action,
                        })
                      }
                      onMouseLeave={() => setHoveredItem(null)}
                      className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] space-y-0.5"
                    >
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded ${item.color} border ${item.border} shrink-0`} />
                        <span>{item.level}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">{item.desc}</div>
                    </div>
                  ))}

                  <div className="p-1.5 rounded bg-orange-950/20 border border-orange-800/40 text-[10px] text-orange-300">
                    ⚡ Updates dynamically at 60 FPS in synchronization with the surge timeline slider.
                  </div>
                </div>
              )}
            </div>

            {/* FIXED-HEIGHT HOVER TOOLTIP CARD: Strictly 60px height to prevent any layout jumping / flicker */}
            <div className="h-[60px] min-h-[60px] max-h-[60px] overflow-hidden p-2 rounded-lg bg-slate-950/90 border border-slate-800 flex flex-col justify-center text-[10px] text-slate-400 transition-colors">
              {hoveredItem ? (
                <div className="space-y-0.5 animate-in fade-in duration-100">
                  <div className="font-semibold text-cyan-300 flex items-center gap-1.5 text-[11px] leading-none">
                    <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{hoveredItem.title}</span>
                  </div>
                  <div className="text-slate-300 text-[10px] leading-tight truncate">
                    {hoveredItem.description}
                  </div>
                  <div className="text-amber-300 text-[10px] font-medium leading-tight truncate">
                    ⚡ {hoveredItem.action}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 italic text-center py-1 select-none text-[10px]">
                  Hover items for operational details · Click to filter map
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
