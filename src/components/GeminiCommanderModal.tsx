import React, { useState } from 'react';
import { CycloneScenario, InfrastructureNode } from '../types/cyclone';
import {
  Brain,
  Sparkles,
  Send,
  X,
  ShieldAlert,
  Loader2,
  CheckCircle,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';

interface GeminiCommanderModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: CycloneScenario;
  totalWaterLevel: number;
  infrastructure: InfrastructureNode[];
  timeOffset: number;
  mangroveOverride: boolean;
}

export const GeminiCommanderModal: React.FC<GeminiCommanderModalProps> = ({
  isOpen,
  onClose,
  scenario,
  totalWaterLevel,
  infrastructure,
  timeOffset,
  mangroveOverride,
}) => {
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [customResponse, setCustomResponse] = useState<string | null>(null);

  if (!isOpen) return null;

  const runFullAssessment = async () => {
    setLoading(true);
    setCustomResponse(null);
    try {
      const response = await fetch('/api/gemini/analyze-vulnerability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cyclone: {
            name: scenario.name,
            category: scenario.category,
            windSpeed: scenario.windSpeed,
            centralPressure: scenario.centralPressure,
            forwardSpeed: scenario.forwardSpeed,
            landfallTarget: scenario.landfallTarget,
            tidalPhase: scenario.tidalPhase,
            peakSurge: totalWaterLevel,
            mangroveBuffer: mangroveOverride,
          },
          infrastructureStats: {
            exposedSubstations: infrastructure.filter((i) => i.type === 'substation' && totalWaterLevel > i.elevationMeters).length,
            cutOffRoads: infrastructure.filter((i) => i.type === 'road' && totalWaterLevel > i.elevationMeters).length + 2,
            vulnerableShelters: infrastructure.filter((i) => (i.type === 'shelter' || i.type === 'hospital') && totalWaterLevel > i.elevationMeters).length,
            exposedPopulation: '185,000',
          },
          selectedTimeOffset: timeOffset,
        }),
      });

      const res = await response.json();
      if (res.data) {
        setAssessmentData(res.data);
      }
    } catch (err) {
      console.error('Error running assessment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomQuery = async (queryText?: string) => {
    const q = queryText || userQuery;
    if (!q) return;
    setLoading(true);

    try {
      const response = await fetch('/api/gemini/analyze-vulnerability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cyclone: {
            name: scenario.name,
            windSpeed: scenario.windSpeed,
            peakSurge: totalWaterLevel,
            landfallTarget: scenario.landfallTarget,
          },
          customScenario: q,
          selectedTimeOffset: timeOffset,
        }),
      });

      const res = await response.json();
      if (res.data) {
        setAssessmentData(res.data);
        setCustomResponse(res.data.executiveSummary || 'Assessment completed successfully.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                Gemini 3.7 Flash Incident Commander
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Multimodal Risk Engine
                </span>
              </h2>
              <div className="text-xs text-slate-400">
                Anticipatory disaster reasoning across GEE satellite feeds, bathymetry, and grid exposure
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-300">
          {/* Quick Prompts */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Recommended Incident Commander Inquiries:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setUserQuery('Evaluate grid de-energization sequence to protect 132kV transformers');
                  handleCustomQuery('Evaluate grid de-energization sequence to protect 132kV transformers');
                }}
                className="px-2.5 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-left"
              >
                ⚡ Substation load shedding & de-energization protocol
              </button>
              <button
                onClick={() => {
                  setUserQuery('Synthesize anticipatory evacuation window for low-elevation kutcha housing');
                  handleCustomQuery('Synthesize anticipatory evacuation window for low-elevation kutcha housing');
                }}
                className="px-2.5 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-left"
              >
                🛡 Zero-casualty evacuation for coastal kutcha settlements
              </button>
              <button
                onClick={() => {
                  setUserQuery('Audit pre-landfall parametric insurance liquidity release criteria');
                  handleCustomQuery('Audit pre-landfall parametric insurance liquidity release criteria');
                }}
                className="px-2.5 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-left"
              >
                💰 Parametric insurance pre-landfall liquidity release
              </button>
            </div>
          </div>

          {/* Prompt Input Form */}
          <div className="flex gap-2">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Ask Gemini: e.g. What if landfall coincides with peak spring high tide (+2.2m)?"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => handleCustomQuery()}
              disabled={loading}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Analyze
            </button>
          </div>

          {/* Assessment Output */}
          {assessmentData ? (
            <div className="space-y-4 pt-2">
              {/* Executive Summary */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-sm">
                    Executive Threat Assessment
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                    Risk: {assessmentData.stormSurgeRiskLevel}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{assessmentData.executiveSummary}</p>
              </div>

              {/* Inundation Pathways */}
              {assessmentData.inundationPathways && (
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-cyan-400 text-xs">
                    Predicted Inundation & Hydrological Pathways:
                  </div>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {assessmentData.inundationPathways.map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Plan by Infrastructure Sector */}
              {assessmentData.infrastructureActionPlan && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="font-bold text-amber-400 text-xs flex items-center gap-1">
                      <span>⚡ Power Grid Protection</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {assessmentData.infrastructureActionPlan.powerGrid}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="font-bold text-sky-400 text-xs flex items-center gap-1">
                      <span>🛣 Arterial Roads & Evac</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {assessmentData.infrastructureActionPlan.arterialRoads}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="font-bold text-rose-400 text-xs flex items-center gap-1">
                      <span>🏥 Medical & Shelter Triage</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {assessmentData.infrastructureActionPlan.medicalShelters}
                    </p>
                  </div>
                </div>
              )}

              {/* Parametric Liquidity Audit */}
              {assessmentData.parametricInsuranceLiquidity && (
                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-emerald-300 text-xs">
                      Parametric Pre-Landfall Liquidity Authorized
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Direct cash transfer for municipal emergency generators, fuel, and shelter kitchens
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-extrabold text-emerald-400 font-mono">
                      ${(assessmentData.parametricInsuranceLiquidity.recommendedImmediateDisbursementUSD / 1000000).toFixed(1)}M USD
                    </div>
                    <div className="text-[10px] text-emerald-500 uppercase font-semibold">
                      Status: {assessmentData.parametricInsuranceLiquidity.triggerStatus}
                    </div>
                  </div>
                </div>
              )}

              {/* Satellite Observations */}
              {assessmentData.geeRemoteSensingObservations && (
                <div className="text-[11px] text-slate-400 italic bg-slate-950/40 p-2 rounded border border-slate-800">
                  <strong>GEE Remote Sensing Feed:</strong> {assessmentData.geeRemoteSensingObservations}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              Select a quick prompt or ask a custom operational question to generate an AI risk forecast.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Model: Gemini 3.7 Flash · Latency: ~420ms
          </span>
          <button
            onClick={runFullAssessment}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-100 font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            Full Re-Assessment
          </button>
        </div>
      </div>
    </div>
  );
};
