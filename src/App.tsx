/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  CycloneScenario,
  InfrastructureNode,
  EvacuationCorridor,
  GEESatelliteFeed,
  ParametricInsurancePolicy,
} from './types/cyclone';
import {
  CYCLONE_SCENARIOS,
  CRITICAL_INFRASTRUCTURE_NODES,
  EVACUATION_CORRIDORS,
  GEE_SATELLITE_FEEDS,
  PARAMETRIC_INSURANCE_PORTFOLIO,
} from './data/cycloneScenarios';
import { calculateSurgePhysics } from './services/surgePhysics';
import { GISMap } from './components/GISMap';
import { SurgeSimulationTimeline } from './components/SurgeSimulationTimeline';
import { InfrastructurePanel } from './components/InfrastructurePanel';
import { GEEFeedsPanel } from './components/GEEFeedsPanel';
import { AdvisoryDispatcher } from './components/AdvisoryDispatcher';
import { ScenarioControls } from './components/ScenarioControls';
import { GeminiCommanderModal } from './components/GeminiCommanderModal';
import {
  ShieldAlert,
  Brain,
  Layers,
  Satellite,
  Radio,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  Waves,
  Users,
  Coins,
  Compass,
  Download,
  Navigation,
  History,
} from 'lucide-react';
import { downloadInfrastructureRiskCsv } from './utils/exportCsv';
import { COASTAL_SURGE_ZONES } from './data/cycloneScenarios';
import { EvacuationRoutePlanner } from './components/EvacuationRoutePlanner';
import { HistoricalComparisonModal } from './components/HistoricalComparisonModal';
import { TideObserverModal } from './components/TideObserverModal';
import { INITIAL_TIDE_STATIONS } from './services/tideObserverService';
import {
  EvacuationRoute,
  HistoricalCycloneEvent,
  RiskThresholdSettings,
  MapStickyNote,
} from './types/cyclone';
import { ImpactSummaryReport } from './components/ImpactSummaryReport';
import { CriticalRiskThresholdsModal } from './components/CriticalRiskThresholdsModal';
import { SensitivityAnalysisPanel } from './components/SensitivityAnalysisPanel';
import { BayShieldLogo } from './components/BayShieldLogo';
import { loadThresholdSettings, evaluateInfrastructureBreaches } from './services/riskThresholds';
import { FileText, Sliders } from 'lucide-react';
import { calculateEvacuationRoutes, EVACUATION_ORIGINS, EVACUATION_DESTINATIONS } from './services/evacuationRouting';
import { HISTORICAL_CYCLONES } from './data/historicalCyclones';
import { loadSessionStickyNotes, saveSessionStickyNotes } from './services/stickyNotesService';
import { StickyNoteModal } from './components/StickyNoteModal';
import { StickyNotesListModal } from './components/StickyNotesListModal';

export default function App() {
  const [currentScenario, setCurrentScenario] = useState<CycloneScenario>(CYCLONE_SCENARIOS[0]);
  const [isCustom, setIsCustom] = useState(false);
  const [timeOffset, setTimeOffset] = useState<number>(0); // 0 = Landfall T-0
  const [mangroveOverride, setMangroveOverride] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<InfrastructureNode | null>(null);
  const [satelliteFeeds, setSatelliteFeeds] = useState<GEESatelliteFeed[]>(GEE_SATELLITE_FEEDS);
  const [isCommanderOpen, setIsCommanderOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'infrastructure' | 'routing' | 'sensitivity' | 'gee' | 'advisories' | 'summary'>('infrastructure');
  const [activeEvacuationRoute, setActiveEvacuationRoute] = useState<EvacuationRoute | null>(null);

  const handleApplySensitivityParams = (windSpeed: number, tide: number, mangrove: boolean) => {
    setMangroveOverride(mangrove);
    setCurrentScenario((prev) => ({
      ...prev,
      windSpeed,
      astronomicalTideMeters: tide,
      mangroveBuffer: mangrove,
    }));
    setIsCustom(true);
  };
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  const [selectedHistoricalEvent, setSelectedHistoricalEvent] = useState<HistoricalCycloneEvent | null>(HISTORICAL_CYCLONES[0]);
  const [isHistoricalMapOverlayActive, setIsHistoricalMapOverlayActive] = useState(false);
  const [customThresholds, setCustomThresholds] = useState<RiskThresholdSettings>(loadThresholdSettings);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [showDensityHeatmap, setShowDensityHeatmap] = useState(false);
  const [isTideObserverOpen, setIsTideObserverOpen] = useState(false);
  const [isLiveTideSyncActive, setIsLiveTideSyncActive] = useState(false);
  const [liveObservedTide, setLiveObservedTide] = useState<number>(INITIAL_TIDE_STATIONS[0].observedWaterLevelMeters);

  // Session Map Sticky Notes
  const [stickyNotes, setStickyNotes] = useState<MapStickyNote[]>(() => loadSessionStickyNotes());
  const [isStickyNoteModalOpen, setIsStickyNoteModalOpen] = useState(false);
  const [isStickyNotesListOpen, setIsStickyNotesListOpen] = useState(false);
  const [stickyNoteToEdit, setStickyNoteToEdit] = useState<MapStickyNote | null>(null);
  const [newStickyNoteCoord, setNewStickyNoteCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [stickyNoteNodeNameHint, setStickyNoteNodeNameHint] = useState<string | null>(null);
  const [stickyNoteNodeIdHint, setStickyNoteNodeIdHint] = useState<string | null>(null);

  useEffect(() => {
    saveSessionStickyNotes(stickyNotes);
  }, [stickyNotes]);

  const handleAddStickyNote = (coord: { lat: number; lng: number }, nodeName?: string, nodeId?: string) => {
    setStickyNoteToEdit(null);
    setNewStickyNoteCoord(coord);
    setStickyNoteNodeNameHint(nodeName || null);
    setStickyNoteNodeIdHint(nodeId || null);
    setIsStickyNoteModalOpen(true);
  };

  const handleEditStickyNote = (note: MapStickyNote) => {
    setStickyNoteToEdit(note);
    setNewStickyNoteCoord(null);
    setStickyNoteNodeNameHint(note.nodeName || null);
    setStickyNoteNodeIdHint(note.nodeId || null);
    setIsStickyNoteModalOpen(true);
  };

  const handleSaveStickyNote = (savedNote: MapStickyNote) => {
    setStickyNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === savedNote.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedNote;
        return copy;
      }
      return [savedNote, ...prev];
    });
  };

  const handleDeleteStickyNote = (id: string) => {
    setStickyNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Dynamic physics calculation based on scenario, current timeline step, mangrove barrier, and real-time live astronomical tide
  const surgeMetrics = useMemo(() => {
    const astroTideOverride = isLiveTideSyncActive ? liveObservedTide : undefined;
    return calculateSurgePhysics(currentScenario, timeOffset, mangroveOverride, astroTideOverride);
  }, [currentScenario, timeOffset, mangroveOverride, isLiveTideSyncActive, liveObservedTide]);

  // Real-time evaluation of custom critical risk threshold breaches across infrastructure
  const customThresholdBreaches = useMemo(() => {
    return evaluateInfrastructureBreaches(
      CRITICAL_INFRASTRUCTURE_NODES,
      surgeMetrics.totalWaterLevelMeters,
      currentScenario.windSpeed,
      customThresholds
    );
  }, [surgeMetrics.totalWaterLevelMeters, currentScenario.windSpeed, customThresholds]);

  // Initial calculation of evacuation route if not set
  useEffect(() => {
    const res = calculateEvacuationRoutes({
      originId: EVACUATION_ORIGINS[0].id,
      destinationId: EVACUATION_DESTINATIONS[0].id,
      totalWaterLevel: surgeMetrics.totalWaterLevelMeters,
      windSpeedKmh: currentScenario.windSpeed,
      objective: 'safest',
    });
    setActiveEvacuationRoute(res.routes.find((r) => r.id === res.recommendedRouteId) || res.routes[0]);
  }, [currentScenario.id, surgeMetrics.totalWaterLevelMeters]);

  const toggleFeed = (feedId: string) => {
    setSatelliteFeeds((prev) =>
      prev.map((f) => (f.id === feedId ? { ...f, active: !f.active } : f))
    );
  };

  const handleUpdateCustomScenario = (updated: CycloneScenario) => {
    setCurrentScenario(updated);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Application Header */}
      <header className="h-14 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <BayShieldLogo size="md" animatePulse={true} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-slate-100 flex items-center gap-1.5">
                BayShield <span className="text-cyan-400">AI</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                  Track 5
                </span>
              </h1>
              <span className="hidden md:inline-block text-slate-600">|</span>
              <span className="hidden md:inline-block text-xs text-slate-400">
                Cyclone Impact & Infrastructure Vulnerability Forecaster
              </span>
            </div>
            <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-2">
              <span>Bay of Bengal & Coastal APAC Incident Command</span>
              <span>·</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                GEE Satellite Multi-Sensor Live
              </span>
            </div>
          </div>
        </div>

        {/* Global Summary Metric Badges & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Population At Risk Chip */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Exposed:</span>
            <span className="font-bold text-slate-200">
              {surgeMetrics.populationAtRisk.toLocaleString()}
            </span>
          </div>

          {/* Modeled Surge Depth */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 hidden sm:inline">Surge Mark:</span>
            <span className="font-bold text-cyan-300">
              {surgeMetrics.totalWaterLevelMeters.toFixed(1)}m TWL
            </span>
          </div>

          {/* Real-Time Tide Observer Button */}
          <button
            onClick={() => setIsTideObserverOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm active:scale-95 ${
              isLiveTideSyncActive
                ? 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.35)] ring-1 ring-cyan-400/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
            title="Real-Time Tide Observer: Live INCOIS / Regional Gauge Network Telemetry"
          >
            <Waves className={`w-3.5 h-3.5 ${isLiveTideSyncActive ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Tide</span> Observer
            <span className="font-mono text-[10px] text-cyan-300 font-bold ml-0.5">
              {isLiveTideSyncActive
                ? `${liveObservedTide > 0 ? `+${liveObservedTide.toFixed(2)}` : liveObservedTide.toFixed(2)}m`
                : `${surgeMetrics.astronomicalTideMeters > 0 ? `+${surgeMetrics.astronomicalTideMeters.toFixed(1)}` : surgeMetrics.astronomicalTideMeters.toFixed(1)}m`}
            </span>
            {isLiveTideSyncActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping ml-0.5" />
            )}
          </button>

          {/* Custom Risk Thresholds Settings Button */}
          <button
            onClick={() => setIsThresholdModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm active:scale-95 ${
              customThresholdBreaches.length > 0
                ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-200 border-rose-700 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
            title="Define custom Critical Risk thresholds per infrastructure category"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Risk</span> Thresholds
            {customThresholdBreaches.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-rose-500 text-white animate-pulse">
                {customThresholdBreaches.length}
              </span>
            )}
          </button>

          {/* Quick Export CSV Button */}
          <button
            onClick={() =>
              downloadInfrastructureRiskCsv({
                scenario: currentScenario,
                totalWaterLevel: surgeMetrics.totalWaterLevelMeters,
                pureSurge: surgeMetrics.pureSurgeMeters,
                astronomicalTide: surgeMetrics.astronomicalTideMeters,
                timeOffset,
                infrastructure: CRITICAL_INFRASTRUCTURE_NODES,
                corridors: EVACUATION_CORRIDORS,
                coastalZones: COASTAL_SURGE_ZONES,
                mangroveOverride,
              })
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition shadow-sm active:scale-95"
            title="Export Offline Incident Brief (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export</span> CSV
          </button>

          {/* Historical Comparison Benchmark Button */}
          <button
            onClick={() => setIsHistoricalModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 border border-purple-800 text-xs font-medium transition shadow-sm active:scale-95"
            title="Historical Comparison: Benchmark against Cyclone Amphan, Yaas, 1999 Odisha Super Cyclone, Aila, Sidr"
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Historical</span> Benchmark
            {isHistoricalMapOverlayActive && selectedHistoricalEvent && (
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Gemini AI Commander Launch Button */}
          <button
            onClick={() => setIsCommanderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-950/40"
          >
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gemini 3.7 Flash</span> Commander
          </button>
        </div>
      </header>

      {/* Secondary Scenario & Meteorological Parameters Toolbar */}
      <ScenarioControls
        currentScenario={currentScenario}
        onSelectScenario={(sc) => {
          setCurrentScenario(sc);
          setTimeOffset(0);
        }}
        onUpdateCustomScenario={handleUpdateCustomScenario}
        isCustom={isCustom}
        setIsCustom={setIsCustom}
      />

      {/* Main Workspace (GIS Map on Left/Center, Responsive Operations Panel on Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Map & Simulation Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          {/* Leaflet GIS Map Component */}
          <div className="flex-1 relative">
            <GISMap
              scenario={currentScenario}
              timeOffset={timeOffset}
              totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
              infrastructure={CRITICAL_INFRASTRUCTURE_NODES}
              corridors={EVACUATION_CORRIDORS}
              satelliteFeeds={satelliteFeeds}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              mangroveOverride={mangroveOverride}
              activeEvacuationRoute={activeEvacuationRoute}
              onSelectEvacuationRoute={setActiveEvacuationRoute}
              onToggleRoutePlanner={() => setRightPanelTab('routing')}
              historicalOverlayEvent={selectedHistoricalEvent}
              showHistoricalOverlay={isHistoricalMapOverlayActive}
              onToggleHistoricalOverlay={setIsHistoricalMapOverlayActive}
              onOpenHistoricalModal={() => setIsHistoricalModalOpen(true)}
              showDensityHeatmap={showDensityHeatmap}
              onToggleDensityHeatmap={() => setShowDensityHeatmap((prev) => !prev)}
              stickyNotes={stickyNotes}
              onAddStickyNote={handleAddStickyNote}
              onEditStickyNote={handleEditStickyNote}
              onOpenStickyNotesList={() => setIsStickyNotesListOpen(true)}
            />
          </div>

          {/* Pre-landfall Countdown & Surge Simulation Timeline Scrubber */}
          <div className="shrink-0 z-10">
            <SurgeSimulationTimeline
              scenario={currentScenario}
              timeOffset={timeOffset}
              onTimeOffsetChange={setTimeOffset}
              pureSurge={surgeMetrics.pureSurgeMeters}
              astronomicalTide={surgeMetrics.astronomicalTideMeters}
              totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
              isLiveTideSyncActive={isLiveTideSyncActive}
              onOpenTideObserver={() => setIsTideObserverOpen(true)}
              mangroveOverride={mangroveOverride}
            />
          </div>
        </div>

        {/* Right Operations Panel (Width ~440px on desktop) */}
        <div className="w-full lg:w-[440px] xl:w-[460px] h-[45vh] lg:h-full shrink-0 flex flex-col bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 z-10">
          {/* Operations Panel Tabs */}
          <div className="flex items-center bg-slate-950 px-2 pt-2 gap-1 border-b border-slate-800 text-xs shrink-0 overflow-x-auto">
            <button
              onClick={() => setRightPanelTab('infrastructure')}
              className={`flex-1 py-2 px-1.5 border-b-2 font-medium transition flex items-center justify-center gap-1 whitespace-nowrap ${
                rightPanelTab === 'infrastructure'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Infrastructure
            </button>

            <button
              onClick={() => setRightPanelTab('routing')}
              className={`flex-1 py-2 px-1.5 border-b-2 font-medium transition flex items-center justify-center gap-1 whitespace-nowrap ${
                rightPanelTab === 'routing'
                  ? 'border-emerald-400 text-emerald-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              Evac Routes
            </button>

            <button
              onClick={() => setRightPanelTab('sensitivity')}
              className={`flex-1 py-2 px-1.5 border-b-2 font-medium transition flex items-center justify-center gap-1 whitespace-nowrap ${
                rightPanelTab === 'sensitivity'
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Sensitivity
            </button>

            <button
              onClick={() => setRightPanelTab('gee')}
              className={`flex-1 py-2 px-1.5 border-b-2 font-medium transition flex items-center justify-center gap-1 whitespace-nowrap ${
                rightPanelTab === 'gee'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Satellite className="w-3.5 h-3.5" />
              GEE Feeds
            </button>

            <button
              onClick={() => setRightPanelTab('advisories')}
              className={`flex-1 py-2 px-1.5 border-b-2 font-medium transition flex items-center justify-center gap-1 whitespace-nowrap ${
                rightPanelTab === 'advisories'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Advisories
            </button>

            <button
              onClick={() => setRightPanelTab('summary')}
              className={`flex-1 py-2 px-1.5 border-b-2 font-medium transition flex items-center justify-center gap-1 whitespace-nowrap ${
                rightPanelTab === 'summary'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Summary
            </button>
          </div>

          {/* Operations Panel Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {rightPanelTab === 'infrastructure' && (
              <InfrastructurePanel
                infrastructure={CRITICAL_INFRASTRUCTURE_NODES}
                corridors={EVACUATION_CORRIDORS}
                parametricPolicies={PARAMETRIC_INSURANCE_PORTFOLIO}
                totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
                pureSurge={surgeMetrics.pureSurgeMeters}
                astronomicalTide={surgeMetrics.astronomicalTideMeters}
                timeOffset={timeOffset}
                mangroveOverride={mangroveOverride}
                scenario={currentScenario}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                showDensityHeatmap={showDensityHeatmap}
                onToggleDensityHeatmap={() => setShowDensityHeatmap((prev) => !prev)}
              />
            )}

            {rightPanelTab === 'routing' && (
              <EvacuationRoutePlanner
                totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
                windSpeedKmh={currentScenario.windSpeed}
                activeRoute={activeEvacuationRoute}
                onSelectRoute={setActiveEvacuationRoute}
              />
            )}

            {rightPanelTab === 'sensitivity' && (
              <SensitivityAnalysisPanel
                currentScenario={currentScenario}
                infrastructure={CRITICAL_INFRASTRUCTURE_NODES}
                timeOffset={timeOffset}
                mangroveOverride={mangroveOverride}
                totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
                pureSurge={surgeMetrics.pureSurgeMeters}
                astronomicalTide={surgeMetrics.astronomicalTideMeters}
                onApplyParameters={handleApplySensitivityParams}
              />
            )}

            {rightPanelTab === 'gee' && (
              <div className="p-3">
                <GEEFeedsPanel
                  satelliteFeeds={satelliteFeeds}
                  onToggleFeed={toggleFeed}
                  mangroveOverride={mangroveOverride}
                  onToggleMangrove={() => setMangroveOverride(!mangroveOverride)}
                />
              </div>
            )}

            {rightPanelTab === 'advisories' && (
              <div className="p-3">
                <AdvisoryDispatcher
                  scenario={currentScenario}
                  totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
                  infrastructure={CRITICAL_INFRASTRUCTURE_NODES}
                  timeOffset={timeOffset}
                  mangroveOverride={mangroveOverride}
                  customThresholds={customThresholds}
                  onOpenThresholdModal={() => setIsThresholdModalOpen(true)}
                />
              </div>
            )}

            {rightPanelTab === 'summary' && (
              <div className="p-3">
                <ImpactSummaryReport
                  scenario={currentScenario}
                  surgeMetrics={surgeMetrics}
                  infrastructure={CRITICAL_INFRASTRUCTURE_NODES}
                  timeOffset={timeOffset}
                  mangroveOverride={mangroveOverride}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gemini 3.7 Flash Incident Commander Modal */}
      <GeminiCommanderModal
        isOpen={isCommanderOpen}
        onClose={() => setIsCommanderOpen(false)}
        scenario={currentScenario}
        totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
        infrastructure={CRITICAL_INFRASTRUCTURE_NODES}
        timeOffset={timeOffset}
        mangroveOverride={mangroveOverride}
      />

      {/* Historical Cyclone Benchmark Comparison Overlay Modal */}
      <HistoricalComparisonModal
        isOpen={isHistoricalModalOpen}
        onClose={() => setIsHistoricalModalOpen(false)}
        currentScenario={currentScenario}
        totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
        selectedHistoricalEvent={selectedHistoricalEvent}
        onSelectHistoricalEvent={setSelectedHistoricalEvent}
        isMapOverlayActive={isHistoricalMapOverlayActive}
        onToggleMapOverlay={setIsHistoricalMapOverlayActive}
      />

      {/* Custom Critical Risk Thresholds Settings Modal */}
      <CriticalRiskThresholdsModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        thresholds={customThresholds}
        onSaveThresholds={(updated) => setCustomThresholds(updated)}
        infrastructure={CRITICAL_INFRASTRUCTURE_NODES}
        totalWaterLevel={surgeMetrics.totalWaterLevelMeters}
        windSpeed={currentScenario.windSpeed}
      />

      {/* Real-Time Tide Observer & External Telemetry Modal */}
      <TideObserverModal
        isOpen={isTideObserverOpen}
        onClose={() => setIsTideObserverOpen(false)}
        isLiveSyncActive={isLiveTideSyncActive}
        onToggleLiveSync={setIsLiveTideSyncActive}
        onUpdateLiveTide={(val) => setLiveObservedTide(val)}
        baseSurgeMeters={surgeMetrics.pureSurgeMeters}
        timeOffset={timeOffset}
      />

      {/* Sticky Note Creator & Editor Modal */}
      <StickyNoteModal
        isOpen={isStickyNoteModalOpen}
        onClose={() => setIsStickyNoteModalOpen(false)}
        noteToEdit={stickyNoteToEdit}
        newCoordinates={newStickyNoteCoord}
        nodeNameHint={stickyNoteNodeNameHint}
        nodeIdHint={stickyNoteNodeIdHint}
        onSaveNote={handleSaveStickyNote}
        onDeleteNote={handleDeleteStickyNote}
      />

      {/* Session Sticky Notes Management List Modal */}
      <StickyNotesListModal
        isOpen={isStickyNotesListOpen}
        onClose={() => setIsStickyNotesListOpen(false)}
        stickyNotes={stickyNotes}
        onSelectNoteToEdit={handleEditStickyNote}
        onDeleteNote={handleDeleteStickyNote}
        onFocusCoordinate={(coord) => {
          setSelectedNode(null);
        }}
        onAddNewNote={() => {
          handleAddStickyNote(
            { lat: currentScenario.landfallCoordinates.lat, lng: currentScenario.landfallCoordinates.lng },
            'Coastline Landfall Coordinate'
          );
        }}
      />
    </div>
  );
}
