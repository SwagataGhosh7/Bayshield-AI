import React, { useState, useEffect } from 'react';
import {
  InfrastructureType,
  InfrastructureNode,
  RiskThresholdSettings,
  CategoryRiskThreshold,
} from '../types/cyclone';
import {
  DEFAULT_RISK_THRESHOLDS,
  STRICT_SAFETY_PRESET,
  RESILIENT_FACILITY_PRESET,
  saveThresholdSettings,
  evaluateInfrastructureBreaches,
} from '../services/riskThresholds';
import {
  X,
  Sliders,
  ShieldAlert,
  Zap,
  Navigation,
  Activity,
  Home,
  Droplets,
  Anchor,
  RotateCcw,
  Save,
  Check,
  AlertTriangle,
  Flame,
  Info,
} from 'lucide-react';

interface CriticalRiskThresholdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  thresholds: RiskThresholdSettings;
  onSaveThresholds: (updated: RiskThresholdSettings) => void;
  infrastructure: InfrastructureNode[];
  totalWaterLevel: number;
  windSpeed: number;
}

export const CriticalRiskThresholdsModal: React.FC<CriticalRiskThresholdsModalProps> = ({
  isOpen,
  onClose,
  thresholds: initialThresholds,
  onSaveThresholds,
  infrastructure,
  totalWaterLevel,
  windSpeed,
}) => {
  const [currentSettings, setCurrentSettings] = useState<RiskThresholdSettings>(initialThresholds);
  const [selectedCategory, setSelectedCategory] = useState<InfrastructureType>('substation');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentSettings(initialThresholds);
      setSaveSuccess(false);
    }
  }, [isOpen, initialThresholds]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Real-time calculation of breaches with current candidate settings
  const currentBreaches = evaluateInfrastructureBreaches(
    infrastructure,
    totalWaterLevel,
    windSpeed,
    currentSettings
  );

  const handleUpdateCategory = (
    category: InfrastructureType,
    updates: Partial<CategoryRiskThreshold>
  ) => {
    setCurrentSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates,
      },
    }));
  };

  const handleApplyPreset = (preset: RiskThresholdSettings) => {
    setCurrentSettings(preset);
  };

  const handleSaveAndApply = () => {
    saveThresholdSettings(currentSettings);
    onSaveThresholds(currentSettings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const getCategoryIcon = (category: InfrastructureType) => {
    switch (category) {
      case 'substation':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'road':
        return <Navigation className="w-4 h-4 text-cyan-400" />;
      case 'hospital':
        return <Activity className="w-4 h-4 text-rose-400" />;
      case 'shelter':
        return <Home className="w-4 h-4 text-emerald-400" />;
      case 'water_plant':
        return <Droplets className="w-4 h-4 text-blue-400" />;
      case 'port':
        return <Anchor className="w-4 h-4 text-purple-400" />;
    }
  };

  const categories: InfrastructureType[] = [
    'substation',
    'road',
    'hospital',
    'shelter',
    'water_plant',
    'port',
  ];

  const activeCategoryConfig = currentSettings[selectedCategory];
  const categoryBreachCount = currentBreaches.filter((b) => b.category === selectedCategory).length;
  const totalInCategory = infrastructure.filter((n) => n.type === selectedCategory).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  Custom Critical Risk Thresholds
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 font-mono font-bold">
                  High-Priority Alert Trigger
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Define category-specific operational thresholds to trigger high-priority alerts in the AdvisoryDispatcher.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Presets & Live Breach Summary Strip */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Presets:</span>
            <button
              onClick={() => handleApplyPreset(DEFAULT_RISK_THRESHOLDS)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition"
            >
              Standard NDMA
            </button>
            <button
              onClick={() => handleApplyPreset(STRICT_SAFETY_PRESET)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-900/50 hover:border-rose-600 text-[11px] font-medium transition"
            >
              Strict Zero-Tolerance
            </button>
            <button
              onClick={() => handleApplyPreset(RESILIENT_FACILITY_PRESET)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-900/50 hover:border-emerald-600 text-[11px] font-medium transition"
            >
              Resilient / Elevated
            </button>
          </div>

          {/* Current Breached Count Live Preview */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold font-mono transition ${
                currentBreaches.length > 0
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>
                {currentBreaches.length} {currentBreaches.length === 1 ? 'Asset Breaching' : 'Assets Breaching'} at {totalWaterLevel.toFixed(1)}m TWL
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body: Left Category Tabs & Right Threshold Configuration */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Category Selector List (Left Column) */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/40 p-2 space-y-1 overflow-y-auto shrink-0">
            <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider px-2 py-1">
              Infrastructure Sectors
            </div>

            {categories.map((catKey) => {
              const cfg = currentSettings[catKey];
              const breachCount = currentBreaches.filter((b) => b.category === catKey).length;
              const isSelected = selectedCategory === catKey;

              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs font-medium transition ${
                    isSelected
                      ? 'bg-slate-800 text-cyan-300 font-semibold border border-cyan-500/40 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {getCategoryIcon(catKey)}
                    <span className="truncate">{cfg.label}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {breachCount > 0 ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                        {breachCount}
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Configuration Form (Right Column) */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {/* Category Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                  {getCategoryIcon(selectedCategory)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">
                    {activeCategoryConfig.label}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {totalInCategory} mapped facilities in operational zone
                  </p>
                </div>
              </div>

              {/* Category Active Monitoring Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <span className="text-slate-400 text-[11px]">Active Alerting:</span>
                <input
                  type="checkbox"
                  checked={activeCategoryConfig.enabled}
                  onChange={(e) =>
                    handleUpdateCategory(selectedCategory, { enabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 relative" />
              </label>
            </div>

            {/* Threshold Sliders & Settings */}
            <div className="space-y-4 text-xs">
              {/* 1. Critical Water Inundation Depth Threshold */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Critical Inundation Depth Threshold</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    +{activeCategoryConfig.criticalWaterDepthMeters.toFixed(2)}m
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Site water depth above facility ground elevation that triggers immediate critical status.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] text-slate-500 font-mono">0.10m</span>
                  <input
                    type="range"
                    min="0.10"
                    max="2.00"
                    step="0.05"
                    value={activeCategoryConfig.criticalWaterDepthMeters}
                    onChange={(e) =>
                      handleUpdateCategory(selectedCategory, {
                        criticalWaterDepthMeters: parseFloat(e.target.value),
                      })
                    }
                    className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">2.00m</span>
                </div>
              </div>

              {/* 2. Critical Risk Score Threshold */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Critical Risk Score Threshold</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    {activeCategoryConfig.criticalRiskScore}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Composite vulnerability score (flood depth + windshear force) triggering a critical alert.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] text-slate-500 font-mono">30%</span>
                  <input
                    type="range"
                    min="30"
                    max="95"
                    step="5"
                    value={activeCategoryConfig.criticalRiskScore}
                    onChange={(e) =>
                      handleUpdateCategory(selectedCategory, {
                        criticalRiskScore: parseInt(e.target.value, 10),
                      })
                    }
                    className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">95%</span>
                </div>
              </div>

              {/* 3. Gale / Wind Speed Threshold */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-rose-400" />
                    <span>Structural Wind Velocity Threshold</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                    {activeCategoryConfig.criticalWindSpeedKmh} km/h
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Sustained cyclonic wind velocity threshold inducing structural failure or roof shear.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] text-slate-500 font-mono">60 km/h</span>
                  <input
                    type="range"
                    min="60"
                    max="180"
                    step="5"
                    value={activeCategoryConfig.criticalWindSpeedKmh}
                    onChange={(e) =>
                      handleUpdateCategory(selectedCategory, {
                        criticalWindSpeedKmh: parseInt(e.target.value, 10),
                      })
                    }
                    className="flex-1 accent-rose-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">180 km/h</span>
                </div>
              </div>

              {/* Priority Tier & Custom Operational Action */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium text-[11px]">
                    Alert Priority Tier:
                  </label>
                  <select
                    value={activeCategoryConfig.priorityLevel}
                    onChange={(e) =>
                      handleUpdateCategory(selectedCategory, {
                        priorityLevel: e.target.value as 'CRITICAL' | 'HIGH',
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CRITICAL">CRITICAL (Immediate Action)</option>
                    <option value="HIGH">HIGH (Precautionary)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium text-[11px]">
                    Automated SOP Directive on Breach:
                  </label>
                  <input
                    type="text"
                    value={activeCategoryConfig.operationalDirective}
                    onChange={(e) =>
                      handleUpdateCategory(selectedCategory, {
                        operationalDirective: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                    placeholder="Immediate tactical directive dispatched to emergency cells..."
                  />
                </div>
              </div>

              {/* Status for Current Category */}
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  categoryBreachCount > 0
                    ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                    : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {categoryBreachCount > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span>
                    {categoryBreachCount > 0
                      ? `${categoryBreachCount} of ${totalInCategory} ${activeCategoryConfig.label} breach these parameters at current TWL (+${totalWaterLevel.toFixed(1)}m).`
                      : `All ${totalInCategory} ${activeCategoryConfig.label} remain within safe operating thresholds at current TWL.`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800">
          <button
            onClick={() => handleApplyPreset(DEFAULT_RISK_THRESHOLDS)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
            >
              Cancel
            </button>

            <button
              onClick={handleSaveAndApply}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg active:scale-95"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Thresholds Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save & Apply Thresholds</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
