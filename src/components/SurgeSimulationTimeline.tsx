import React, { useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  AlertCircle,
  Waves,
  Wind,
  ShieldAlert,
  AlertTriangle,
  Flame,
  Zap,
} from 'lucide-react';
import { CycloneScenario } from '../types/cyclone';
import { calculateSurgePhysics } from '../services/surgePhysics';

interface SurgeSimulationTimelineProps {
  scenario: CycloneScenario;
  timeOffset: number;
  onTimeOffsetChange: (offset: number) => void;
  pureSurge: number;
  astronomicalTide: number;
  totalWaterLevel: number;
  isLiveTideSyncActive?: boolean;
  onOpenTideObserver?: () => void;
  mangroveOverride?: boolean;
}

const TIMELINE_STEPS = [-48, -36, -24, -18, -12, -6, 0, 6, 12, 18, 24];

export const SurgeSimulationTimeline: React.FC<SurgeSimulationTimelineProps> = ({
  scenario,
  timeOffset,
  onTimeOffsetChange,
  pureSurge,
  astronomicalTide,
  totalWaterLevel,
  isLiveTideSyncActive = false,
  onOpenTideObserver,
  mangroveOverride,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [criticalThreshold, setCriticalThreshold] = useState<number>(3.0);

  // Playback timer loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        const currentIndex = TIMELINE_STEPS.indexOf(timeOffset);
        if (currentIndex < TIMELINE_STEPS.length - 1) {
          onTimeOffsetChange(TIMELINE_STEPS[currentIndex + 1]);
        } else {
          setIsPlaying(false);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeOffset, onTimeOffsetChange]);

  const formatStepLabel = (offset: number) => {
    if (offset === 0) return 'T-0 Landfall';
    if (offset < 0) return `T${offset}h`;
    return `T+${offset}h`;
  };

  // Compute exact hydrodynamic surge metrics across all timeline steps
  const stepMetrics = useMemo(() => {
    return TIMELINE_STEPS.map((step, index) => {
      const physics = calculateSurgePhysics(scenario, step, mangroveOverride);
      const isExtreme = physics.totalWaterLevelMeters >= 3.5;
      const isCritical = physics.totalWaterLevelMeters >= criticalThreshold;
      const isWarning = physics.totalWaterLevelMeters >= 2.5;

      return {
        step,
        index,
        pct: (index / (TIMELINE_STEPS.length - 1)) * 100,
        totalWaterLevel: physics.totalWaterLevelMeters,
        pureSurge: physics.pureSurgeMeters,
        astronomicalTide: physics.astronomicalTideMeters,
        isExtreme,
        isCritical,
        isWarning,
      };
    });
  }, [scenario, mangroveOverride, criticalThreshold]);

  // Compute the continuous 'Danger Zone' interval on the scrub bar
  const dangerInterval = useMemo(() => {
    const dangerSteps = stepMetrics.filter((s) => s.isCritical);
    if (dangerSteps.length === 0) return null;

    const firstIndex = dangerSteps[0].index;
    const lastIndex = dangerSteps[dangerSteps.length - 1].index;

    const startStep = dangerSteps[0].step;
    const endStep = dangerSteps[dangerSteps.length - 1].step;

    const totalSteps = TIMELINE_STEPS.length - 1;
    // Apply slight shoulder padding for smooth visual coverage over the step anchors
    const leftPct = Math.max(0, ((firstIndex - 0.35) / totalSteps) * 100);
    const rightPct = Math.min(100, ((lastIndex + 0.35) / totalSteps) * 100);
    const widthPct = Math.max(8, rightPct - leftPct);

    const peakStep = [...dangerSteps].sort((a, b) => b.totalWaterLevel - a.totalWaterLevel)[0];

    return {
      startStep,
      endStep,
      leftPct,
      widthPct,
      peakTotalWaterLevel: peakStep.totalWaterLevel,
      peakStepHour: peakStep.step,
      durationHours: Math.abs(endStep - startStep),
      dangerStepsCount: dangerSteps.length,
    };
  }, [stepMetrics]);

  // Secondary broad caution interval (≥2.5m)
  const warningInterval = useMemo(() => {
    if (criticalThreshold <= 2.5) return null;
    const warningSteps = stepMetrics.filter((s) => s.isWarning);
    if (warningSteps.length === 0) return null;

    const firstIndex = warningSteps[0].index;
    const lastIndex = warningSteps[warningSteps.length - 1].index;
    const totalSteps = TIMELINE_STEPS.length - 1;
    const leftPct = Math.max(0, ((firstIndex - 0.4) / totalSteps) * 100);
    const rightPct = Math.min(100, ((lastIndex + 0.4) / totalSteps) * 100);
    const widthPct = Math.max(6, rightPct - leftPct);

    return {
      startStep: warningSteps[0].step,
      endStep: warningSteps[warningSteps.length - 1].step,
      leftPct,
      widthPct,
    };
  }, [stepMetrics, criticalThreshold]);

  // Check if current scrubber position is inside the active danger zone
  const isCurrentInDangerZone = totalWaterLevel >= criticalThreshold;

  // Current scrub bar progress percentage
  const currentStepIndex = TIMELINE_STEPS.indexOf(timeOffset);
  const currentProgressPct =
    currentStepIndex >= 0 ? (currentStepIndex / (TIMELINE_STEPS.length - 1)) * 100 : 50;

  return (
    <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 text-slate-200 select-none">
      {/* Top Telemetry & Control Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Playback Controls & Phase Status */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition shadow"
            title={isPlaying ? 'Pause Simulation' : 'Play Timeline'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              onTimeOffsetChange(-24);
            }}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Reset to T-24h"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2 pl-1">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-slate-400">Phase:</span>
            <span
              className={`font-semibold text-sm ${
                isCurrentInDangerZone ? 'text-rose-300' : 'text-cyan-300'
              }`}
            >
              {formatStepLabel(timeOffset)}
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              ({timeOffset <= 0 ? `${Math.abs(timeOffset)}h until landfall` : `${timeOffset}h post-landfall`})
            </span>
          </div>
        </div>

        {/* Dynamic Water & Wind Gauges */}
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={onOpenTideObserver}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition cursor-pointer text-left group ${
              isCurrentInDangerZone
                ? 'bg-rose-950/70 border-rose-500/70 shadow-[0_0_12px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/40'
                : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800 hover:border-cyan-500/50'
            }`}
            title="Click to open Real-Time Tide Observer & INCOIS Telemetry"
          >
            <Waves
              className={`w-3.5 h-3.5 ${
                isCurrentInDangerZone
                  ? 'text-rose-400 animate-pulse'
                  : 'text-cyan-400'
              } ${isLiveTideSyncActive ? 'animate-pulse' : 'group-hover:scale-110'} transition-transform`}
            />
            <span className="text-slate-400">Total Water Level:</span>
            <span
              className={`font-bold font-mono ${
                isCurrentInDangerZone ? 'text-rose-300' : 'text-cyan-300'
              }`}
            >
              {totalWaterLevel.toFixed(2)}m
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <span>
                (Surge {pureSurge.toFixed(1)}m + Tide{' '}
                {astronomicalTide > 0 ? `+${astronomicalTide.toFixed(1)}m` : `${astronomicalTide.toFixed(1)}m`})
              </span>
              {isLiveTideSyncActive && (
                <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-950/90 px-1 py-0.2 rounded border border-cyan-800 animate-pulse">
                  LIVE
                </span>
              )}
            </span>
          </button>

          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800">
            <Wind className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-slate-400">Wind:</span>
            <span className="font-bold text-rose-300 font-mono">
              {Math.round(scenario.windSpeed * (timeOffset === 0 ? 1 : 0.85))} km/h
            </span>
          </div>
        </div>

        {/* Danger Zone Controls & Status Banner */}
        <div className="flex items-center gap-2 text-xs">
          {/* Danger Zone Active Alert / Window Pill */}
          {isCurrentInDangerZone ? (
            <div className="flex items-center gap-1.5 text-rose-300 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.35)] animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="font-semibold">
                ACTIVE DANGER ZONE ({totalWaterLevel.toFixed(2)}m &ge; {criticalThreshold.toFixed(1)}m)
              </span>
            </div>
          ) : dangerInterval ? (
            <div className="hidden lg:flex items-center gap-1.5 text-amber-300 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-600/40">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Danger Window: <strong className="text-amber-200">{formatStepLabel(dangerInterval.startStep)} to {formatStepLabel(dangerInterval.endStep)}</strong> (Peak: +{dangerInterval.peakTotalWaterLevel.toFixed(1)}m)
              </span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Surge within safe limits (&lt;{criticalThreshold.toFixed(1)}m)</span>
            </div>
          )}

          {/* Critical Threshold Selector */}
          <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px]">
            <span className="text-slate-400 hidden xl:inline">Threshold:</span>
            {[2.5, 3.0, 3.5].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setCriticalThreshold(lvl)}
                className={`px-1.5 py-0.5 rounded transition font-mono font-medium ${
                  criticalThreshold === lvl
                    ? 'bg-rose-500 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title={`Highlight intervals exceeding ${lvl}m surge depth`}
              >
                {lvl}m
              </button>
            ))}
          </div>

          {/* Quick Jump to Peak Danger Button */}
          {dangerInterval && timeOffset !== dangerInterval.peakStepHour && (
            <button
              onClick={() => {
                setIsPlaying(false);
                onTimeOffsetChange(dangerInterval.peakStepHour);
              }}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80 transition text-[11px] active:scale-95"
              title="Jump scrubber directly to the peak surge danger interval (T-0 Landfall)"
            >
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Jump to Peak</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Step Scrubber Slider with Visual Danger Zone Indicator */}
      <div className="mt-3 relative pt-3 pb-1">
        <div className="relative flex items-center justify-between">
          {/* Base Neutral Track Line */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1.5 bg-slate-800 rounded-full z-0" />

          {/* Warning Interval (Level 1: ≥2.5m) Ambient Glow Track */}
          {warningInterval && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full bg-amber-500/15 border border-amber-500/30 z-1 pointer-events-none transition-all duration-300"
              style={{
                left: `${warningInterval.leftPct}%`,
                width: `${warningInterval.widthPct}%`,
              }}
            />
          )}

          {/* Critical 'Danger Zone' Interval (Level 2: ≥ criticalThreshold) with Hazard Stripes & Glow */}
          {dangerInterval && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 rounded-md border border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.4)] z-2 overflow-visible pointer-events-none transition-all duration-300"
              style={{
                left: `${dangerInterval.leftPct}%`,
                width: `${dangerInterval.widthPct}%`,
                background:
                  'repeating-linear-gradient(45deg, rgba(244, 63, 94, 0.22), rgba(244, 63, 94, 0.22) 6px, rgba(159, 18, 57, 0.42) 6px, rgba(159, 18, 57, 0.42) 12px)',
              }}
            >
              {/* Floating Danger Zone Header Banner Tag */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-950/95 text-rose-200 border border-rose-500 text-[8px] font-mono font-bold uppercase tracking-wider shadow-lg whitespace-nowrap animate-pulse">
                <Flame className="w-2.5 h-2.5 text-rose-400" />
                <span>Danger Zone (&ge;{criticalThreshold}m)</span>
              </div>
            </div>
          )}

          {/* Scrub Bar Progress Line */}
          <div
            className={`absolute top-1/2 left-0 -translate-y-1/2 h-1.5 rounded-full z-3 transition-all duration-300 ${
              isCurrentInDangerZone
                ? 'bg-gradient-to-r from-cyan-600 via-amber-500 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
            }`}
            style={{ width: `${currentProgressPct}%` }}
          />

          {/* Stepper Interactive Mark Buttons */}
          {stepMetrics.map((item) => {
            const isActive = item.step === timeOffset;
            const isPast = item.step <= timeOffset;
            const isDanger = item.isCritical;
            const isWarning = item.isWarning && !item.isCritical;

            return (
              <button
                key={item.step}
                onClick={() => {
                  setIsPlaying(false);
                  onTimeOffsetChange(item.step);
                }}
                className={`relative z-10 flex flex-col items-center group focus:outline-none transition-transform ${
                  isActive ? 'scale-110' : 'hover:scale-105'
                }`}
                title={`${formatStepLabel(item.step)}: TWL +${item.totalWaterLevel.toFixed(2)}m (Surge: +${item.pureSurge.toFixed(1)}m, Tide: ${item.astronomicalTide > 0 ? `+${item.astronomicalTide.toFixed(1)}` : item.astronomicalTide.toFixed(1)}m)${isDanger ? ' — CRITICAL DANGER ZONE' : ''}`}
              >
                {/* Visual Step Marker Anchor Dot */}
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                    isActive
                      ? isDanger
                        ? 'bg-rose-500 border-white ring-4 ring-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                        : 'bg-cyan-400 border-white ring-4 ring-cyan-500/30'
                      : isDanger
                      ? isPast
                        ? 'bg-rose-600 border-rose-300 ring-2 ring-rose-500/50'
                        : 'bg-slate-900 border-rose-500 ring-1 ring-rose-500/40 group-hover:bg-rose-950'
                      : isWarning
                      ? isPast
                        ? 'bg-amber-500 border-slate-900'
                        : 'bg-slate-900 border-amber-500 group-hover:bg-amber-950'
                      : isPast
                      ? 'bg-cyan-500 border-slate-900'
                      : 'bg-slate-800 border-slate-900 group-hover:bg-slate-700'
                  }`}
                >
                  {isDanger && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  )}
                </div>

                {/* Step Phase Label */}
                <span
                  className={`text-[10px] mt-1 transition-colors flex items-center gap-0.5 ${
                    isActive
                      ? isDanger
                        ? 'font-bold text-rose-300'
                        : 'font-bold text-cyan-300'
                      : item.step === 0
                      ? 'font-bold text-rose-400'
                      : isDanger
                      ? 'font-semibold text-rose-400/90'
                      : isWarning
                      ? 'text-amber-300/80'
                      : 'text-slate-400 group-hover:text-slate-300'
                  }`}
                >
                  {formatStepLabel(item.step)}
                </span>

                {/* Quantitative Water Level Subtext */}
                <span
                  className={`text-[8px] font-mono transition-colors ${
                    isDanger
                      ? 'font-bold text-rose-400'
                      : isWarning
                      ? 'text-amber-400 font-medium'
                      : 'text-slate-500'
                  }`}
                >
                  {item.totalWaterLevel.toFixed(1)}m
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
