import React, { useState } from 'react';
import { CycloneScenario } from '../types/cyclone';
import { CYCLONE_SCENARIOS } from '../data/cycloneScenarios';
import { Sliders, Wind, Gauge, Compass, Waves, ShieldCheck, RefreshCw, Flame } from 'lucide-react';

interface ScenarioControlsProps {
  currentScenario: CycloneScenario;
  onSelectScenario: (scenario: CycloneScenario) => void;
  onUpdateCustomScenario: (updated: CycloneScenario) => void;
  isCustom: boolean;
  setIsCustom: (v: boolean) => void;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  currentScenario,
  onSelectScenario,
  onUpdateCustomScenario,
  isCustom,
  setIsCustom,
}) => {
  const [showCustomStudio, setShowCustomStudio] = useState(false);

  const handleScenarioChange = (scenarioId: string) => {
    if (scenarioId === 'custom') {
      setIsCustom(true);
      setShowCustomStudio(true);
    } else {
      setIsCustom(false);
      setShowCustomStudio(false);
      const found = CYCLONE_SCENARIOS.find((s) => s.id === scenarioId);
      if (found) onSelectScenario(found);
    }
  };

  const updateParam = (key: keyof CycloneScenario, value: any) => {
    const updated = {
      ...currentScenario,
      [key]: value,
    };
    onUpdateCustomScenario(updated);
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 text-xs text-slate-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Scenario Switcher Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
            Target Scenario:
          </span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {CYCLONE_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => handleScenarioChange(sc.id)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  !isCustom && currentScenario.id === sc.id
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sc.name}
              </button>
            ))}

            <button
              onClick={() => handleScenarioChange('custom')}
              className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                isCustom
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3 h-3" />
              Custom Studio
            </button>
          </div>
        </div>

        {/* Current Meteorological Highlights */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Wind className="w-3.5 h-3.5 text-rose-400" />
            <span>Sustained:</span>
            <strong className="text-rose-400">{currentScenario.windSpeed} km/h</strong>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Central:</span>
            <strong className="text-cyan-300">{currentScenario.centralPressure} hPa</strong>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300 hidden sm:flex">
            <Waves className="w-3.5 h-3.5 text-amber-400" />
            <span>Tide Phase:</span>
            <span className="text-slate-200 font-sans">{currentScenario.tidalPhase}</span>
          </div>

          {isCustom && (
            <button
              onClick={() => setShowCustomStudio(!showCustomStudio)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 font-sans text-[11px]"
            >
              {showCustomStudio ? 'Hide Studio' : 'Tweak Studio'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Custom Cyclone Studio Controls */}
      {isCustom && showCustomStudio && (
        <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-slate-950 rounded-lg">
          {/* Wind Speed Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Max Sustained Wind</span>
              <span className="font-mono text-cyan-400 font-bold">{currentScenario.windSpeed} km/h</span>
            </div>
            <input
              type="range"
              min="90"
              max="260"
              step="5"
              value={currentScenario.windSpeed}
              onChange={(e) => updateParam('windSpeed', Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Cat 1 (90)</span>
              <span>Cat 5 (260 km/h)</span>
            </div>
          </div>

          {/* Central Pressure Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Central Pressure</span>
              <span className="font-mono text-cyan-400 font-bold">{currentScenario.centralPressure} hPa</span>
            </div>
            <input
              type="range"
              min="910"
              max="995"
              step="1"
              value={currentScenario.centralPressure}
              onChange={(e) => updateParam('centralPressure', Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Super (910 hPa)</span>
              <span>Deep Dep (995)</span>
            </div>
          </div>

          {/* Forward Speed Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Forward Speed</span>
              <span className="font-mono text-cyan-400 font-bold">{currentScenario.forwardSpeed} km/h</span>
            </div>
            <input
              type="range"
              min="8"
              max="35"
              step="1"
              value={currentScenario.forwardSpeed}
              onChange={(e) => updateParam('forwardSpeed', Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Stalled (8 km/h)</span>
              <span>Fast (35 km/h)</span>
            </div>
          </div>

          {/* Tidal Phase Preset Selector */}
          <div className="space-y-1">
            <div className="text-slate-400">Astronomical Tide Phase</div>
            <select
              value={currentScenario.astronomicalTideMeters}
              onChange={(e) => {
                const val = Number(e.target.value);
                let label = 'Mean High Tide (+1.2m)';
                if (val >= 1.8) label = 'Spring High Tide (+1.85m)';
                if (val <= 0.5) label = 'Neap Low Tide (+0.4m)';
                updateParam('astronomicalTideMeters', val);
                updateParam('tidalPhase', label);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
            >
              <option value="1.85">Astronomical Spring High Tide (+1.85m)</option>
              <option value="1.2">Mean High Tide (+1.20m)</option>
              <option value="0.4">Neap Low Tide (+0.40m)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
