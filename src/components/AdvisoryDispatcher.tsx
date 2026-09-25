import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  EarlyWarningAdvisory,
  CycloneScenario,
  InfrastructureNode,
  IdentifiedHighRiskNode,
  RiskThresholdSettings,
  ThresholdBreachDetail,
  HistoricalBreachAlertRecord,
  BreachSeverityLevel,
} from '../types/cyclone';
import { CRITICAL_INFRASTRUCTURE_NODES } from '../data/cycloneScenarios';
import { evaluateNodeVulnerability } from '../services/surgePhysics';
import { alertAudio } from '../services/alertAudio';
import {
  loadThresholdSettings,
  evaluateInfrastructureBreaches,
} from '../services/riskThresholds';
import { AlertHistoryTab } from './AlertHistoryTab';
import {
  Send,
  Volume2,
  VolumeX,
  FileCode,
  CheckCircle,
  AlertOctagon,
  Languages,
  Users,
  Smartphone,
  Copy,
  Radio,
  Loader2,
  Bell,
  BellOff,
  BellRing,
  ShieldAlert,
  Zap,
  Activity,
  Navigation,
  Building,
  Sliders,
  Flame,
  AlertTriangle,
  Settings,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';

interface AdvisoryDispatcherProps {
  scenario: CycloneScenario;
  totalWaterLevel: number;
  infrastructure?: InfrastructureNode[];
  timeOffset?: number;
  mangroveOverride?: boolean;
  customThresholds?: RiskThresholdSettings;
  onOpenThresholdModal?: () => void;
}

export const AdvisoryDispatcher: React.FC<AdvisoryDispatcherProps> = ({
  scenario,
  totalWaterLevel,
  infrastructure = CRITICAL_INFRASTRUCTURE_NODES,
  timeOffset = 0,
  mangroveOverride = true,
  customThresholds,
  onOpenThresholdModal,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [recipientRole, setRecipientRole] = useState('District Magistrate & Municipal Authority');
  const [advisory, setAdvisory] = useState<EarlyWarningAdvisory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanningNodes, setIsScanningNodes] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [showCapXml, setShowCapXml] = useState(false);
  const [isBreachListExpanded, setIsBreachListExpanded] = useState(true);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  // Tab State: Live Dispatcher vs Alert History
  const [activeTab, setActiveTab] = useState<'dispatch' | 'history'>('dispatch');

  // Session Alert History Logging
  const [alertHistory, setAlertHistory] = useState<HistoricalBreachAlertRecord[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const loggedKeysRef = useRef<Set<string>>(new Set());

  // Audio alert settings and trigger state
  const [isAudioMuted, setIsAudioMuted] = useState(alertAudio.getMuted());
  const [audioVolume, setAudioVolume] = useState(alertAudio.getVolume());
  const [alertPulse, setAlertPulse] = useState(false);
  const [lastAlertCount, setLastAlertCount] = useState<number | null>(null);
  const [identifiedNodes, setIdentifiedNodes] = useState<IdentifiedHighRiskNode[]>([]);

  // Effective thresholds: props or loaded from localStorage
  const activeThresholds = useMemo(() => {
    return customThresholds || loadThresholdSettings();
  }, [customThresholds]);

  // Compute live custom threshold breaches
  const customBreaches: ThresholdBreachDetail[] = useMemo(() => {
    return evaluateInfrastructureBreaches(
      infrastructure,
      totalWaterLevel,
      scenario.windSpeed,
      activeThresholds
    );
  }, [infrastructure, totalWaterLevel, scenario.windSpeed, activeThresholds]);

  // Reset dismissed state whenever breaches count changes
  useEffect(() => {
    if (customBreaches.length > 0) {
      setIsAlertDismissed(false);
    }
  }, [customBreaches.length, scenario.id, timeOffset]);

  // Automatically log all infrastructure breaches into the session alert history
  useEffect(() => {
    if (customBreaches.length === 0) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toISOString().slice(0, 10);
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000));
    const stepLabel = timeOffset === 0 ? 'T-0h Landfall' : `T${timeOffset > 0 ? '+' : ''}${timeOffset}h`;

    const newRecords: HistoricalBreachAlertRecord[] = [];

    customBreaches.forEach((b) => {
      const dedupKey = `${scenario.id}_${timeOffset}_${b.nodeId}_${Math.round(totalWaterLevel * 10)}`;
      if (loggedKeysRef.current.has(dedupKey)) return;
      loggedKeysRef.current.add(dedupKey);

      let severity: BreachSeverityLevel = 'WARNING';
      if (b.riskScore >= 85 || b.floodDepthMeters >= 1.5) {
        severity = 'CATASTROPHIC';
      } else if (b.riskScore >= 70 || b.priorityLevel === 'CRITICAL') {
        severity = 'CRITICAL';
      } else if (b.riskScore >= 45 || b.floodDepthMeters >= 0.4) {
        severity = 'SEVERE';
      }

      const matchingNode = infrastructure.find((n) => n.id === b.nodeId);

      newRecords.push({
        id: `breach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: timeStr,
        dateStr,
        sessionRelativeSeconds: sessionElapsedSec,
        timelineStepHour: timeOffset,
        timelineLabel: stepLabel,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        nodeId: b.nodeId,
        nodeName: b.nodeName,
        nodeType: b.category,
        district: matchingNode?.district || 'Coastal District',
        totalWaterLevelMeters: totalWaterLevel,
        windSpeedKmh: scenario.windSpeed,
        floodDepthMeters: b.floodDepthMeters,
        riskScore: b.riskScore,
        severity,
        breachReasons: b.breachReasons,
        operationalDirective: b.operationalDirective,
      });
    });

    if (newRecords.length > 0) {
      setAlertHistory((prev) => [...newRecords, ...prev]);
    }
  }, [customBreaches, scenario.id, scenario.name, timeOffset, totalWaterLevel, infrastructure]);

  // Subscribe to alert audio changes
  useEffect(() => {
    const unsubscribe = alertAudio.subscribe(() => {
      setIsAudioMuted(alertAudio.getMuted());
      setAudioVolume(alertAudio.getVolume());
    });
    return unsubscribe;
  }, []);

  // Trigger subtle audio notification when high risk nodes or custom breaches are identified
  const triggerAudioAlert = (count: number) => {
    if (count > 0) {
      const played = alertAudio.playSubtleNotification();
      if (played || !isAudioMuted) {
        setAlertPulse(true);
        setLastAlertCount(count);
        setTimeout(() => setAlertPulse(false), 2400);
      }
    }
  };

  const handleToggleMute = () => {
    const nextMuted = alertAudio.toggleMute();
    setIsAudioMuted(nextMuted);
  };

  const handleTestChime = () => {
    if (isAudioMuted) {
      alertAudio.setMuted(false);
      setIsAudioMuted(false);
    }
    alertAudio.playSubtleNotification();
    setAlertPulse(true);
    setTimeout(() => setAlertPulse(false), 2000);
  };

  const handleVolumePreset = (vol: number) => {
    alertAudio.setVolume(vol);
    setAudioVolume(vol);
    if (isAudioMuted) {
      alertAudio.setMuted(false);
      setIsAudioMuted(false);
    }
    alertAudio.playSubtleNotification(vol);
  };

  // Dedicated AI Scan of infrastructure nodes against current cyclone & surge conditions
  const handleScanInfrastructureThreats = async () => {
    setIsScanningNodes(true);
    try {
      const evaluated = infrastructure.map((node) => {
        const vuln = evaluateNodeVulnerability(node, totalWaterLevel, scenario.windSpeed);
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          riskScore: vuln.riskScore,
          threatSummary: vuln.isInundated
            ? `Inundation depth +${vuln.floodDepthMeters}m exceeds critical asset threshold (${node.floodCriticalHeightMeters}m).`
            : `Severe cyclone wind shear (${scenario.windSpeed} km/h) threatening structural integrity.`,
          recommendedAction: vuln.urgentRecommendation,
          floodDepthMeters: vuln.floodDepthMeters,
          status: vuln.status,
        };
      });

      const highRisk = evaluated.filter(
        (n) => n.riskScore >= 70 || n.status === 'de_energized' || n.status === 'critical'
      );
      setIdentifiedNodes(highRisk);

      // Log scanned threats into session alert history
      if (highRisk.length > 0) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toISOString().slice(0, 10);
        const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000));
        const stepLabel = timeOffset === 0 ? 'T-0h Landfall' : `T${timeOffset > 0 ? '+' : ''}${timeOffset}h`;

        const scanRecords: HistoricalBreachAlertRecord[] = [];
        highRisk.forEach((n) => {
          const dedupKey = `scan_${scenario.id}_${timeOffset}_${n.id}_${Math.round(totalWaterLevel * 10)}`;
          if (loggedKeysRef.current.has(dedupKey)) return;
          loggedKeysRef.current.add(dedupKey);

          const matchingNode = infrastructure.find((inf) => inf.id === n.id);
          const floodDepth = n.floodDepthMeters || Math.max(0, Number((totalWaterLevel - (matchingNode?.elevationMeters || 0)).toFixed(2)));

          let severity: BreachSeverityLevel = 'WARNING';
          if (n.riskScore >= 85 || floodDepth >= 1.5) {
            severity = 'CATASTROPHIC';
          } else if (n.riskScore >= 70 || n.status === 'de_energized' || n.status === 'critical') {
            severity = 'CRITICAL';
          } else if (n.riskScore >= 50) {
            severity = 'SEVERE';
          }

          scanRecords.push({
            id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: timeStr,
            dateStr,
            sessionRelativeSeconds: sessionElapsedSec,
            timelineStepHour: timeOffset,
            timelineLabel: stepLabel,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            nodeId: n.id,
            nodeName: n.name,
            nodeType: n.type,
            district: matchingNode?.district || 'Coastal District',
            totalWaterLevelMeters: totalWaterLevel,
            windSpeedKmh: scenario.windSpeed,
            floodDepthMeters: floodDepth,
            riskScore: n.riskScore,
            severity,
            breachReasons: [n.threatSummary],
            operationalDirective: n.recommendedAction,
          });
        });

        if (scanRecords.length > 0) {
          setAlertHistory((prev) => [...scanRecords, ...prev]);
        }
      }

      const totalAlerts = Math.max(highRisk.length, customBreaches.length);
      if (totalAlerts > 0) {
        triggerAudioAlert(totalAlerts);
      }
    } catch (err) {
      console.error('Failed to scan infrastructure:', err);
    } finally {
      setIsScanningNodes(false);
    }
  };

  const handleGenerateAdvisory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gemini/generate-advisories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cyclone: {
            name: scenario.name,
            windSpeed: scenario.windSpeed,
            peakSurge: totalWaterLevel,
            landfallETA: scenario.landfallETA,
            landfallTarget: scenario.landfallTarget,
          },
          language: selectedLanguage,
          recipientRole,
          infrastructure: infrastructure.map((node) => ({
            id: node.id,
            name: node.name,
            type: node.type,
            elevationMeters: node.elevationMeters,
            floodCriticalHeightMeters: node.floodCriticalHeightMeters,
            district: node.district,
          })),
          customThresholdBreaches: customBreaches.map((b) => ({
            nodeId: b.nodeId,
            nodeName: b.nodeName,
            category: b.category,
            breachReasons: b.breachReasons,
            priorityLevel: b.priorityLevel,
            operationalDirective: b.operationalDirective,
          })),
        }),
      });

      const result = await response.json();
      if (result.data) {
        setAdvisory(result.data);

        if (result.data.highRiskInfrastructure && Array.isArray(result.data.highRiskInfrastructure)) {
          setIdentifiedNodes(result.data.highRiskInfrastructure);
          triggerAudioAlert(result.data.highRiskInfrastructure.length);
        } else {
          const highRisk = infrastructure
            .filter((node) => totalWaterLevel > node.elevationMeters || scenario.windSpeed >= 160)
            .map((node) => ({
              id: node.id,
              name: node.name,
              type: node.type,
              riskScore: 85,
              threatSummary: `Modeled storm surge (${totalWaterLevel}m) overtops ground elevation (${node.elevationMeters}m).`,
              recommendedAction: node.recommendedAction || 'Execute mandatory protection and emergency protocol.',
            }));
          setIdentifiedNodes(highRisk);
          if (highRisk.length > 0) {
            triggerAudioAlert(highRisk.length);
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate advisory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudioBroadcast = async () => {
    if (!advisory) return;

    if (isPlayingAudio) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);

    try {
      const res = await fetch('/api/gemini/tts-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${advisory.headline}. ${advisory.actionDirectives.slice(0, 2).join('. ')}`,
          voice: 'Zephyr',
        }),
      });
      const data = await res.json();

      if (data.success && data.audioData) {
        const audioSrc = `data:audio/mp3;base64,${data.audioData}`;
        const audio = new Audio(audioSrc);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => fallbackSpeech();
        audio.play().catch(() => fallbackSpeech());
        return;
      }
    } catch (e) {
      console.warn('Gemini TTS fallback to browser speech synthesis', e);
    }

    fallbackSpeech();

    function fallbackSpeech() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const textToSpeak = `${advisory?.headline}. Emergency Alert. ${advisory?.broadcastContent?.slice(0, 200)}`;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingAudio(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2000);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'substation':
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'hospital':
        return <Activity className="w-3.5 h-3.5 text-rose-400" />;
      case 'road':
        return <Navigation className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Building className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-rose-400" />
          <h3 className="font-semibold text-sm text-slate-100">
            Automated Early-Warning Advisory Dispatcher
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {onOpenThresholdModal && (
            <button
              onClick={onOpenThresholdModal}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border transition shadow-sm ${
                customBreaches.length > 0
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700 hover:bg-rose-900'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title="Configure custom Critical Risk thresholds per category"
            >
              <Sliders className="w-3 h-3 text-amber-400" />
              <span>Thresholds</span>
              {customBreaches.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" />
              )}
            </button>
          )}

          <span className="text-xs text-rose-400 font-mono bg-rose-950/50 border border-rose-800/60 px-2 py-0.5 rounded">
            CAP v1.2 Standard
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Generate and broadcast multi-lingual, targeted incident response directives to municipal, defense, and public utility command cells.
      </p>

      {/* Dispatcher Mode Tabs: Live Dispatch vs Alert History */}
      <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('dispatch')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'dispatch'
              ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/80 ring-1 ring-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-rose-400" />
          <span>Live Dispatcher</span>
          {customBreaches.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'history'
              ? 'bg-slate-800 text-amber-300 shadow-sm border border-slate-700/80 ring-1 ring-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5 text-amber-400" />
          <span>Alert History</span>
          <span
            className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
              alertHistory.length > 0
                ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                : 'bg-slate-900 text-slate-500'
            }`}
          >
            {alertHistory.length}
          </span>
        </button>
      </div>

      {activeTab === 'history' ? (
        <AlertHistoryTab
          alertHistory={alertHistory}
          onClearHistory={() => {
            setAlertHistory([]);
            loggedKeysRef.current.clear();
          }}
          currentScenarioName={scenario.name}
          currentTimelineHour={timeOffset}
        />
      ) : (
        <>
          {/* 🚨 HIGH-PRIORITY VISUAL ALERT: CUSTOM RISK THRESHOLD BREACH BANNER */}
          {customBreaches.length > 0 && !isAlertDismissed && (
        <div className="p-3.5 rounded-xl border-2 border-rose-500 bg-gradient-to-br from-rose-950/95 via-red-950/80 to-slate-900 shadow-[0_0_25px_rgba(244,63,94,0.4)] ring-1 ring-rose-400/50 space-y-3 animate-in fade-in duration-300">
          {/* Header of Alert */}
          <div className="flex items-start justify-between gap-2 border-b border-rose-800/60 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/60 flex items-center justify-center text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]">
                  <AlertOctagon className="w-5 h-5 animate-pulse" />
                </div>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm text-white tracking-wide flex items-center gap-1.5">
                    CRITICAL RISK THRESHOLD BREACH
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500 text-white shadow-sm uppercase tracking-wider animate-pulse">
                    {customBreaches.length} {customBreaches.length === 1 ? 'Asset Breached' : 'Assets Breached'}
                  </span>
                </div>
                <p className="text-[11px] text-rose-200/90 mt-0.5 font-medium">
                  Infrastructure nodes exceed user-defined safety limits under current surge ({totalWaterLevel.toFixed(1)}m TWL).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onOpenThresholdModal && (
                <button
                  onClick={onOpenThresholdModal}
                  className="px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700/80 text-[10px] font-bold transition flex items-center gap-1"
                  title="Configure threshold parameters"
                >
                  <Sliders className="w-3 h-3 text-amber-300" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              )}
              <button
                onClick={() => setIsBreachListExpanded(!isBreachListExpanded)}
                className="p-1 rounded bg-rose-900/50 hover:bg-rose-900 text-rose-300 transition"
                title={isBreachListExpanded ? 'Collapse Breach Details' : 'Expand Breach Details'}
              >
                {isBreachListExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* List of Breached Infrastructure Nodes */}
          {isBreachListExpanded && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {customBreaches.map((breach) => (
                <div
                  key={breach.nodeId}
                  className="p-2.5 rounded-lg bg-slate-950/80 border border-rose-800/80 hover:border-rose-600 transition space-y-1.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(breach.category)}
                      <span className="font-bold text-slate-100 text-xs">{breach.nodeName}</span>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        breach.priorityLevel === 'CRITICAL'
                          ? 'bg-rose-600 text-white shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {breach.priorityLevel}
                    </span>
                  </div>

                  {/* Breach Reasons List */}
                  <div className="space-y-0.5 text-[11px] text-rose-200/95 font-medium pl-1">
                    {breach.breachReasons.map((reason, rIdx) => (
                      <div key={rIdx} className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>

                  {/* Operational SOP Directive */}
                  <div className="text-[11px] text-cyan-200 bg-cyan-950/40 border border-cyan-800/60 p-1.5 rounded flex items-start gap-1.5">
                    <strong className="text-cyan-400 shrink-0 font-semibold">Directive:</strong>
                    <span>{breach.operationalDirective}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Alert Quick Action Footer */}
          <div className="flex flex-wrap items-center justify-between pt-1 border-t border-rose-800/60 gap-2 text-xs">
            <div className="text-[11px] text-rose-200/80 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping shrink-0" />
              <span>Directives will be incorporated into the AI Operational Dispatch.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alertAudio.playSubtleNotification()}
                className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700/80 text-[10px] font-semibold flex items-center gap-1 transition"
                title="Play subtle notification chime for threshold breach"
              >
                <Volume2 className="w-3 h-3 text-amber-300" />
                <span>Replay Alert</span>
              </button>

              <button
                onClick={() => setIsAlertDismissed(true)}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] transition"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Alert System Controls Strip */}
      <div
        className={`p-2.5 rounded-lg border transition-all duration-300 ${
          alertPulse
            ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
            : 'bg-slate-950/80 border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div className="relative">
              {isAudioMuted ? (
                <BellOff className="w-4 h-4 text-slate-500" />
              ) : (
                <BellRing
                  className={`w-4 h-4 text-amber-400 ${alertPulse ? 'animate-bounce text-amber-300' : ''}`}
                />
              )}
              {!isAudioMuted && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Audio Alert System</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                    isAudioMuted
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {isAudioMuted ? 'MUTED' : 'ACTIVE'}
                </span>
                {customBreaches.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono font-bold">
                    BREACH DETECTED
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                {isAudioMuted
                  ? 'Notification sound disabled for high-risk assets'
                  : 'Plays subtle harmonic chime when AI or custom thresholds detect compromised infrastructure'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Test Chime Button */}
            <button
              onClick={handleTestChime}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/50 text-[11px] font-medium transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Test the subtle, non-intrusive notification chime"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Test Chime</span>
            </button>

            {/* Mute/Unmute Toggle */}
            <button
              onClick={handleToggleMute}
              className={`px-2 py-1 rounded border text-[11px] font-medium transition flex items-center gap-1 shadow-sm active:scale-95 ${
                isAudioMuted
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:text-white'
              }`}
              title={isAudioMuted ? 'Enable Audio Alert Sound' : 'Mute Audio Alert Sound'}
            >
              {isAudioMuted ? <BellOff className="w-3.5 h-3.5 text-rose-400" /> : <Bell className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isAudioMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {/* Volume Presets */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5 text-[10px]">
              <button
                onClick={() => handleVolumePreset(0.15)}
                className={`px-1.5 py-0.5 rounded transition ${
                  audioVolume <= 0.18 && !isAudioMuted ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Subtle Volume (15%)"
              >
                Soft
              </button>
              <button
                onClick={() => handleVolumePreset(0.3)}
                className={`px-1.5 py-0.5 rounded transition ${
                  audioVolume > 0.18 && audioVolume <= 0.35 && !isAudioMuted ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Normal Volume (30%)"
              >
                Med
              </button>
              <button
                onClick={() => handleVolumePreset(0.5)}
                className={`px-1.5 py-0.5 rounded transition ${
                  audioVolume > 0.35 && !isAudioMuted ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Clear Volume (50%)"
              >
                High
              </button>
            </div>
          </div>
        </div>

        {/* Pulse Banner on Alert Trigger */}
        {alertPulse && (
          <div className="mt-2 pt-2 border-t border-amber-500/30 flex items-center justify-between text-[11px] text-amber-300 animate-in fade-in duration-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span>
                <strong>Subtle chime triggered:</strong> {lastAlertCount || 'critical'} high-risk infrastructure nodes identified!
              </span>
            </span>
            <button
              onClick={() => alertAudio.playSubtleNotification()}
              className="text-[10px] underline hover:text-amber-200 font-mono"
            >
              Replay Chime
            </button>
          </div>
        )}
      </div>

      {/* Recipient & Language Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            Target Authority / Cell:
          </label>
          <select
            value={recipientRole}
            onChange={(e) => setRecipientRole(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="District Magistrate & Municipal Authority">
              District Magistrate & Municipal Commissioners (Evacuation)
            </option>
            <option value="Power Grid & Electricity Distribution Authority">
              Power Grid Utilities (Substation Trip & De-energization)
            </option>
            <option value="PWD & Arterial Road Transport Command">
              PWD & Arterial Highway Engineers (Bridge & Road Closures)
            </option>
            <option value="Chief Medical Officer & Public Health">
              Chief Medical Officer (Emergency Trauma & Vaccine Cold-Chain)
            </option>
            <option value="Port Authority & Marine Coast Guard">
              Port Authorities (Great Danger Signal 10 & Vessel Anchorages)
            </option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            Broadcast Language:
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="English">English (Official Standard)</option>
            <option value="Bengali">Bengali (বাংলা — Gangetic Delta & Sundarbans)</option>
            <option value="Odia">Odia (ଓଡ଼ିଆ — Odisha Coastal Belt)</option>
            <option value="Hindi">Hindi (हिन्दी — National Disaster Coordination)</option>
            <option value="Burmese">Burmese (မြန်မာဘာသာ — Rakhine & Arakan Coast)</option>
          </select>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={handleGenerateAdvisory}
          disabled={isLoading}
          className="w-full py-2.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Synthesizing Dispatch...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Generate Operational Dispatch
            </>
          )}
        </button>

        <button
          onClick={handleScanInfrastructureThreats}
          disabled={isScanningNodes}
          className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50"
          title="Scan infrastructure nodes with AI and trigger subtle audio chime for compromised assets"
        >
          {isScanningNodes ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              Analyzing Assets...
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              AI Infrastructure Threat Scan
            </>
          )}
        </button>
      </div>

      {/* AI Identified High-Risk Infrastructure Section */}
      {identifiedNodes.length > 0 && (
        <div className="p-3 rounded-lg border bg-slate-950/90 border-amber-500/40 space-y-2.5 text-xs animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                  AI High-Risk Infrastructure Alert
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-mono font-bold">
                    {identifiedNodes.length} Assets At Risk
                  </span>
                </h4>
                <div className="text-[10px] text-slate-400">
                  Audio chime dispatched for high-vulnerability nodes
                </div>
              </div>
            </div>

            <button
              onClick={() => alertAudio.playSubtleNotification()}
              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1 transition"
              title="Replay subtle notification sound"
            >
              <Volume2 className="w-3 h-3" />
              Replay Sound
            </button>
          </div>

          {/* List of identified nodes */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {identifiedNodes.map((node) => (
              <div
                key={node.id}
                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {getNodeIcon(node.type)}
                    <span className="font-bold text-slate-200 text-xs">{node.name}</span>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      node.riskScore >= 85
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    Risk: {node.riskScore}%
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 leading-snug">
                  <strong className="text-slate-400">Threat:</strong> {node.threatSummary}
                </div>

                <div className="text-[11px] text-cyan-300 leading-snug bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                  <strong className="text-slate-400">Directive:</strong> {node.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Advisory Bulletin Card */}
      {advisory && (
        <div className="mt-3 p-3.5 rounded-lg border bg-slate-950/80 border-slate-800 space-y-3 animate-fade-in text-xs">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-2">
            <div>
              <div className="text-[10px] font-mono text-cyan-400">
                BULLETIN: {advisory.bulletinNumber}
              </div>
              <div className="font-bold text-sm text-slate-100 mt-0.5">{advisory.headline}</div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
              {advisory.severity}
            </span>
          </div>

          {/* Operational Broadcast Content */}
          <div className="p-3 rounded bg-slate-900 border border-slate-800/80 text-slate-300 leading-relaxed font-sans whitespace-pre-line">
            {advisory.broadcastContent}
          </div>

          {/* Action Directives Checklist */}
          {advisory.actionDirectives && advisory.actionDirectives.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                Mandatory Operational Directives:
              </div>
              {advisory.actionDirectives.map((directive, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-300">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{directive}</span>
                </div>
              ))}
            </div>
          )}

          {/* Public Cell-Broadcast SMS Card */}
          {advisory.publicSmsText && (
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-slate-300 font-mono text-[11px] line-clamp-2">
                  {advisory.publicSmsText}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(advisory.publicSmsText)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium transition flex items-center gap-1 shrink-0"
              >
                <Copy className="w-3 h-3" />
                {copiedSms ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          {/* Action Bar (Audio Dispatch & CAP XML Export) */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 gap-2">
            <button
              onClick={handlePlayAudioBroadcast}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                isPlayingAudio
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
              }`}
            >
              {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isPlayingAudio ? 'Stop Siren Broadcast' : 'Play Voice Dispatch Siren'}
            </button>

            <button
              onClick={() => setShowCapXml(!showCapXml)}
              className="px-2.5 py-1.5 rounded text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 flex items-center gap-1.5 transition"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              {showCapXml ? 'Hide CAP XML' : 'View CAP XML'}
            </button>
          </div>

          {/* CAP XML Snippet Drawer */}
          {showCapXml && advisory.capXmlSnippet && (
            <div className="mt-2 p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-400 overflow-x-auto">
              <pre>{advisory.capXmlSnippet}</pre>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};
