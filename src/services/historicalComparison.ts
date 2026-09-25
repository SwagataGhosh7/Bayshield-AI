import { CycloneScenario, HistoricalCycloneEvent } from '../types/cyclone';

export interface HistoricalComparisonResult {
  historicalEvent: HistoricalCycloneEvent;
  currentScenario: CycloneScenario;
  surgeDeltaMeters: number; // positive = current is higher, negative = historical was higher
  windDeltaKmh: number;
  pressureDeltaHpa: number;
  modeledCurrentEconomicLossBillion: number;
  modeledCurrentSubstationsAtRisk: number;
  economicDeltaBillion: number;
  surgeComparisonVerdict: string;
  infrastructureComparisonVerdict: string;
  resilienceEvolutionNotes: string[];
}

export function compareHistoricalCyclone(
  currentScenario: CycloneScenario,
  currentWaterLevel: number,
  historicalEvent: HistoricalCycloneEvent,
  criticalSubstationsCount: number = 4
): HistoricalComparisonResult {
  const surgeDeltaMeters = Number((currentWaterLevel - historicalEvent.totalWaterLevelMeters).toFixed(2));
  const windDeltaKmh = currentScenario.windSpeed - historicalEvent.peakWindsKmh;
  const pressureDeltaHpa = currentScenario.centralPressure - historicalEvent.centralPressureHpa;

  // Approximate current economic exposure based on peak surge TWL
  const modeledCurrentEconomicLossBillion = Number(
    (0.8 + Math.pow(currentWaterLevel, 1.85) * 0.45).toFixed(2)
  );
  const economicDeltaBillion = Number(
    (modeledCurrentEconomicLossBillion - historicalEvent.economicDamageBillionUsd).toFixed(2)
  );

  // Dynamic surge comparison verdict
  let surgeComparisonVerdict = '';
  if (surgeDeltaMeters > 0.3) {
    surgeComparisonVerdict = `Active scenario total water level (${currentWaterLevel.toFixed(1)}m) EXCEEDS ${historicalEvent.name} (${historicalEvent.totalWaterLevelMeters.toFixed(1)}m) by +${surgeDeltaMeters}m. Severe embankment crest overtopping expected across low-lying polders.`;
  } else if (surgeDeltaMeters < -0.3) {
    surgeComparisonVerdict = `Active scenario total water level (${currentWaterLevel.toFixed(1)}m) is ${Math.abs(surgeDeltaMeters)}m LOWER than ${historicalEvent.name}'s peak surge mark (${historicalEvent.totalWaterLevelMeters.toFixed(1)}m). Embankments with crests >${currentWaterLevel.toFixed(1)}m are projected to hold.`;
  } else {
    surgeComparisonVerdict = `Active scenario total water level (${currentWaterLevel.toFixed(1)}m) closely MIRRORS ${historicalEvent.name} (${historicalEvent.totalWaterLevelMeters.toFixed(1)}m) within ±0.3m tolerance. Hydrodynamic runup will follow similar littoral inundation pathways.`;
  }

  // Dynamic infrastructure comparison verdict
  let infrastructureComparisonVerdict = '';
  if (windDeltaKmh > 20) {
    infrastructureComparisonVerdict = `Current system has stronger maximum sustained winds (+${windDeltaKmh} km/h), elevating structural threat to 33kV distribution poles and non-engineered cyclone shelter roofs compared to ${historicalEvent.name}.`;
  } else if (windDeltaKmh < -20) {
    infrastructureComparisonVerdict = `Current winds are ${Math.abs(windDeltaKmh)} km/h lighter than ${historicalEvent.name}, shifting primary tactical threat from wide-scale wind shear to tidal waterlogging and saline contamination.`;
  } else {
    infrastructureComparisonVerdict = `Wind intensity is comparable to ${historicalEvent.name} (±20 km/h), requiring identical high-wind protocol enforcement and ferry suspension.`;
  }

  // Modern resiliency advancements
  const resilienceEvolutionNotes = [
    `Early Warning Lead-Time: Modernized from 24h manual forecasts in ${historicalEvent.year} to 72h multi-satellite GEE hydrodynamic modeling today.`,
    `Evacuation Corridors: Automated routing routes evacuees away from low-elevation culverts prone to washouts identified during ${historicalEvent.name}.`,
    `Grid Protection: Pre-emptive sectional load de-energization prevents the cascade transformer arc-flashes that crippled ${historicalEvent.substationsAffected} substations during ${historicalEvent.name}.`,
    `Nature-Based Bioshield: Sundarbans & Bhitarkanika mangrove conservation now delivers an active -0.85m wave attenuation factor not factored in older emergency operations plans.`,
  ];

  return {
    historicalEvent,
    currentScenario,
    surgeDeltaMeters,
    windDeltaKmh,
    pressureDeltaHpa,
    modeledCurrentEconomicLossBillion,
    modeledCurrentSubstationsAtRisk: criticalSubstationsCount,
    economicDeltaBillion,
    surgeComparisonVerdict,
    infrastructureComparisonVerdict,
    resilienceEvolutionNotes,
  };
}
