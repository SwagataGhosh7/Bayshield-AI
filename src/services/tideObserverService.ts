export type TideState = 'FLOODING' | 'EBBING' | 'HIGH_SLACK' | 'LOW_SLACK';

export type LunarPhase = 'SPRING_TIDE' | 'NEAP_TIDE' | 'EQUINOCTIAL_SUPER_TIDE' | 'PERIGEAN_SPRING';

export interface TideStationReading {
  stationId: string;
  stationName: string;
  agency: string;
  location: string;
  lat: number;
  lng: number;
  observedWaterLevelMeters: number;
  predictedAstroTideMeters: number;
  surgeResidualMeters: number;
  rateOfChangeCmPerHour: number;
  tideState: TideState;
  sensorHealth: 'OPTIMAL' | 'DEGRADED' | 'WARNING';
  lastPingTimestamp: string;
  signalStrengthPercent: number;
}

export interface TideCurvePoint {
  hourOffset: number;
  timeLabel: string;
  predictedTide: number;
  observedTide: number;
  residual: number;
  isLandfallAlignment: boolean;
}

export interface TideObserverState {
  isLiveSyncActive: boolean;
  selectedStationId: string;
  currentObservedTide: number;
  predictedAstroTide: number;
  surgeResidualMeters: number;
  rateOfRiseCmPerHour: number;
  tideState: TideState;
  lunarPhase: LunarPhase;
  lunarPhaseLabel: string;
  simulationSpeed: '1x' | '10x' | '60x' | 'PAUSED';
  manualOffsetMeters: number;
  stations: TideStationReading[];
  curvePoints: TideCurvePoint[];
  lastUpdatedTimestamp: string;
}

export const INITIAL_TIDE_STATIONS: TideStationReading[] = [
  {
    stationId: 'INCOIS-WB-01',
    stationName: 'Sagar Island Marine Observatory',
    agency: 'INCOIS / Survey of India',
    location: 'Muriganga Estuary, South 24 Parganas (WB)',
    lat: 21.65,
    lng: 88.08,
    observedWaterLevelMeters: 1.84,
    predictedAstroTideMeters: 1.62,
    surgeResidualMeters: 0.22,
    rateOfChangeCmPerHour: 28,
    tideState: 'FLOODING',
    sensorHealth: 'OPTIMAL',
    lastPingTimestamp: '12 sec ago',
    signalStrengthPercent: 98,
  },
  {
    stationId: 'INCOIS-OD-04',
    stationName: 'Paradip Port Tidal Gauge',
    agency: 'INCOIS / Paradip Port Authority',
    location: 'Mahanadi Outfall, Jagatsinghpur (OD)',
    lat: 20.28,
    lng: 86.68,
    observedWaterLevelMeters: 1.35,
    predictedAstroTideMeters: 1.2,
    surgeResidualMeters: 0.15,
    rateOfChangeCmPerHour: 14,
    tideState: 'FLOODING',
    sensorHealth: 'OPTIMAL',
    lastPingTimestamp: '8 sec ago',
    signalStrengthPercent: 95,
  },
  {
    stationId: 'BIWTA-BD-02',
    stationName: 'Hiron Point Estuarine Sensor',
    agency: 'BIWTA / Bangladesh Hydrographic Cell',
    location: 'Passur River Mouth, Sundarbans (BD)',
    lat: 21.78,
    lng: 89.47,
    observedWaterLevelMeters: 2.15,
    predictedAstroTideMeters: 1.9,
    surgeResidualMeters: 0.25,
    rateOfChangeCmPerHour: 34,
    tideState: 'FLOODING',
    sensorHealth: 'OPTIMAL',
    lastPingTimestamp: '15 sec ago',
    signalStrengthPercent: 92,
  },
  {
    stationId: 'SOI-WB-03',
    stationName: 'Digha Coastal Seawall Station',
    agency: 'Survey of India / WB Maritime',
    location: 'Digha Seawall Frontage, Purba Medinipur (WB)',
    lat: 21.62,
    lng: 87.51,
    observedWaterLevelMeters: 1.58,
    predictedAstroTideMeters: 1.45,
    surgeResidualMeters: 0.13,
    rateOfChangeCmPerHour: 18,
    tideState: 'FLOODING',
    sensorHealth: 'OPTIMAL',
    lastPingTimestamp: '21 sec ago',
    signalStrengthPercent: 89,
  },
];

/**
 * Calculates harmonic semi-diurnal tide at a given virtual elapsed hour
 * incorporating M2 (lunar ~12.42h), S2 (solar ~12.0h), and M4 (shallow water) constituents
 */
export function calculateHarmonicTide(
  hour: number,
  baseAmplitude: number = 1.4,
  lunarPhase: LunarPhase = 'SPRING_TIDE',
  manualOffset: number = 0
): {
  predicted: number;
  observed: number;
  rateCmPerHour: number;
  state: TideState;
} {
  // Phase amplification factors
  let phaseMultiplier = 1.0;
  if (lunarPhase === 'SPRING_TIDE') phaseMultiplier = 1.35;
  if (lunarPhase === 'EQUINOCTIAL_SUPER_TIDE') phaseMultiplier = 1.65;
  if (lunarPhase === 'PERIGEAN_SPRING') phaseMultiplier = 1.5;
  if (lunarPhase === 'NEAP_TIDE') phaseMultiplier = 0.72;

  const ampM2 = baseAmplitude * phaseMultiplier;
  const ampS2 = baseAmplitude * 0.45 * phaseMultiplier;
  const ampM4 = baseAmplitude * 0.18 * phaseMultiplier;

  // Angular frequencies
  const omegaM2 = (2 * Math.PI) / 12.42;
  const omegaS2 = (2 * Math.PI) / 12.0;
  const omegaM4 = (2 * Math.PI) / 6.21;

  // Astronomical prediction
  const pred =
    ampM2 * Math.cos(omegaM2 * hour) +
    ampS2 * Math.cos(omegaS2 * hour + 0.35) +
    ampM4 * Math.cos(omegaM4 * hour + 0.9);

  // Micro-fluctuation sensor noise / shelf wave residual
  const sensorNoise = Math.sin(hour * 4.2) * 0.04 + Math.cos(hour * 7.5) * 0.02;
  const nonTidalResidual = 0.18 + Math.sin(hour * 0.6) * 0.08;

  const obs = pred + nonTidalResidual + sensorNoise + manualOffset;

  // Derivative calculation: d(pred)/dt in m/hr -> cm/hr
  const dM2 = -ampM2 * omegaM2 * Math.sin(omegaM2 * hour);
  const dS2 = -ampS2 * omegaS2 * Math.sin(omegaS2 * hour + 0.35);
  const dM4 = -ampM4 * omegaM4 * Math.sin(omegaM4 * hour + 0.9);
  const dTotal = (dM2 + dS2 + dM4) * 100; // cm/hour

  let state: TideState = 'FLOODING';
  if (Math.abs(dTotal) < 7) {
    state = obs > 0.4 ? 'HIGH_SLACK' : 'LOW_SLACK';
  } else if (dTotal > 0) {
    state = 'FLOODING';
  } else {
    state = 'EBBING';
  }

  return {
    predicted: Number(pred.toFixed(2)),
    observed: Number(Math.max(-2.5, obs).toFixed(2)),
    rateCmPerHour: Math.round(dTotal),
    state,
  };
}

/**
 * Generates a 24-hour harmonic curve for visualization in Recharts
 */
export function generate24HourTideCurve(
  centerHour: number = 0,
  baseAmplitude: number = 1.4,
  lunarPhase: LunarPhase = 'SPRING_TIDE',
  manualOffset: number = 0
): TideCurvePoint[] {
  const points: TideCurvePoint[] = [];

  for (let offset = -12; offset <= 12; offset += 1) {
    const evalHour = centerHour + offset;
    const calc = calculateHarmonicTide(evalHour, baseAmplitude, lunarPhase, manualOffset);

    let timeLabel = `${offset >= 0 ? `+${offset}` : offset}h`;
    if (offset === 0) timeLabel = 'Current / T-0';

    points.push({
      hourOffset: offset,
      timeLabel,
      predictedTide: calc.predicted,
      observedTide: calc.observed,
      residual: Number((calc.observed - calc.predicted).toFixed(2)),
      isLandfallAlignment: offset === 0,
    });
  }

  return points;
}
