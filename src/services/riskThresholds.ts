import {
  InfrastructureType,
  InfrastructureNode,
  RiskThresholdSettings,
  ThresholdBreachDetail,
} from '../types/cyclone';

export const DEFAULT_RISK_THRESHOLDS: RiskThresholdSettings = {
  substation: {
    category: 'substation',
    label: 'Power Grid Substations',
    criticalRiskScore: 70,
    criticalWaterDepthMeters: 0.35,
    criticalWindSpeedKmh: 100,
    enabled: true,
    priorityLevel: 'CRITICAL',
    operationalDirective: 'Mandatory sectional de-energization to prevent 33kV switchyard arc-flash explosions and transformer failure.',
  },
  road: {
    category: 'road',
    label: 'Arterial Roads & Causeways',
    criticalRiskScore: 65,
    criticalWaterDepthMeters: 0.30,
    criticalWindSpeedKmh: 90,
    enabled: true,
    priorityLevel: 'CRITICAL',
    operationalDirective: 'Impose total vehicular blockade; divert emergency evacuation convoys to inland elevated bypass corridors.',
  },
  hospital: {
    category: 'hospital',
    label: 'Hospitals & Medical Centers',
    criticalRiskScore: 60,
    criticalWaterDepthMeters: 0.20,
    criticalWindSpeedKmh: 110,
    enabled: true,
    priorityLevel: 'CRITICAL',
    operationalDirective: 'Evacuate non-ambulatory patients vertically to Level 2; deploy sandbag cofferdams around auxiliary diesel generators.',
  },
  shelter: {
    category: 'shelter',
    label: 'Cyclone Shelters',
    criticalRiskScore: 75,
    criticalWaterDepthMeters: 0.80,
    criticalWindSpeedKmh: 130,
    enabled: true,
    priorityLevel: 'HIGH',
    operationalDirective: 'Inspect rooftop emergency exits, verify 72-hour potable water chlorination, and deploy emergency lighting.',
  },
  water_plant: {
    category: 'water_plant',
    label: 'Water Treatment Plants',
    criticalRiskScore: 70,
    criticalWaterDepthMeters: 0.40,
    criticalWindSpeedKmh: 100,
    enabled: true,
    priorityLevel: 'HIGH',
    operationalDirective: 'Seal clean water holding reservoirs against saline storm tide backwater; engage submersible de-watering pumps.',
  },
  port: {
    category: 'port',
    label: 'Ports & Marine Terminals',
    criticalRiskScore: 70,
    criticalWaterDepthMeters: 0.90,
    criticalWindSpeedKmh: 85,
    enabled: true,
    priorityLevel: 'CRITICAL',
    operationalDirective: 'Hoist Great Danger Signal No. 10; halt all crane operations, double-moor cargo vessels, and clear jetty aprons.',
  },
};

export const STRICT_SAFETY_PRESET: RiskThresholdSettings = {
  substation: {
    ...DEFAULT_RISK_THRESHOLDS.substation,
    criticalRiskScore: 50,
    criticalWaterDepthMeters: 0.15,
    criticalWindSpeedKmh: 80,
  },
  road: {
    ...DEFAULT_RISK_THRESHOLDS.road,
    criticalRiskScore: 50,
    criticalWaterDepthMeters: 0.15,
    criticalWindSpeedKmh: 75,
  },
  hospital: {
    ...DEFAULT_RISK_THRESHOLDS.hospital,
    criticalRiskScore: 45,
    criticalWaterDepthMeters: 0.10,
    criticalWindSpeedKmh: 85,
  },
  shelter: {
    ...DEFAULT_RISK_THRESHOLDS.shelter,
    criticalRiskScore: 60,
    criticalWaterDepthMeters: 0.40,
    criticalWindSpeedKmh: 100,
  },
  water_plant: {
    ...DEFAULT_RISK_THRESHOLDS.water_plant,
    criticalRiskScore: 55,
    criticalWaterDepthMeters: 0.25,
    criticalWindSpeedKmh: 80,
  },
  port: {
    ...DEFAULT_RISK_THRESHOLDS.port,
    criticalRiskScore: 55,
    criticalWaterDepthMeters: 0.50,
    criticalWindSpeedKmh: 70,
  },
};

export const RESILIENT_FACILITY_PRESET: RiskThresholdSettings = {
  substation: {
    ...DEFAULT_RISK_THRESHOLDS.substation,
    criticalRiskScore: 85,
    criticalWaterDepthMeters: 0.70,
    criticalWindSpeedKmh: 130,
  },
  road: {
    ...DEFAULT_RISK_THRESHOLDS.road,
    criticalRiskScore: 80,
    criticalWaterDepthMeters: 0.50,
    criticalWindSpeedKmh: 110,
  },
  hospital: {
    ...DEFAULT_RISK_THRESHOLDS.hospital,
    criticalRiskScore: 75,
    criticalWaterDepthMeters: 0.45,
    criticalWindSpeedKmh: 135,
  },
  shelter: {
    ...DEFAULT_RISK_THRESHOLDS.shelter,
    criticalRiskScore: 85,
    criticalWaterDepthMeters: 1.20,
    criticalWindSpeedKmh: 150,
  },
  water_plant: {
    ...DEFAULT_RISK_THRESHOLDS.water_plant,
    criticalRiskScore: 80,
    criticalWaterDepthMeters: 0.75,
    criticalWindSpeedKmh: 120,
  },
  port: {
    ...DEFAULT_RISK_THRESHOLDS.port,
    criticalRiskScore: 85,
    criticalWaterDepthMeters: 1.40,
    criticalWindSpeedKmh: 110,
  },
};

const STORAGE_KEY = 'bayshield_custom_risk_thresholds';

export function loadThresholdSettings(): RiskThresholdSettings {
  if (typeof window === 'undefined') return DEFAULT_RISK_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults in case of missing keys
      return {
        ...DEFAULT_RISK_THRESHOLDS,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn('Could not read custom risk thresholds from storage:', err);
  }
  return DEFAULT_RISK_THRESHOLDS;
}

export function saveThresholdSettings(settings: RiskThresholdSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Could not save custom risk thresholds to storage:', err);
  }
}

/**
 * Evaluates all infrastructure nodes against active custom thresholds.
 * Returns breach details for any assets exceeding the user-defined limits.
 */
export function evaluateInfrastructureBreaches(
  nodes: InfrastructureNode[],
  totalWaterLevel: number,
  windSpeed: number,
  thresholds: RiskThresholdSettings
): ThresholdBreachDetail[] {
  const breaches: ThresholdBreachDetail[] = [];

  nodes.forEach((node) => {
    const threshold = thresholds[node.type];
    if (!threshold || !threshold.enabled) return;

    // Calculate site-specific water level and flood depth
    const floodDepth = Math.max(0, Number((totalWaterLevel - node.elevationMeters).toFixed(2)));

    // Calculate risk score based on depth ratio and wind force
    const depthRatio = floodDepth / Math.max(0.5, node.floodCriticalHeightMeters);
    const windRatio = windSpeed / 160;
    const computedRiskScore = Math.min(100, Math.round(depthRatio * 65 + windRatio * 35));

    const breachReasons: string[] = [];

    // 1. Water depth breach
    if (floodDepth >= threshold.criticalWaterDepthMeters && floodDepth > 0) {
      breachReasons.push(
        `Flood depth +${floodDepth.toFixed(2)}m exceeds custom limit of ${threshold.criticalWaterDepthMeters.toFixed(2)}m (Site ground elev: ${node.elevationMeters}m)`
      );
    }

    // 2. Risk score breach
    if (computedRiskScore >= threshold.criticalRiskScore) {
      breachReasons.push(
        `Risk score ${computedRiskScore}% exceeds custom threshold of ${threshold.criticalRiskScore}%`
      );
    }

    // 3. Wind speed breach
    if (windSpeed >= threshold.criticalWindSpeedKmh) {
      breachReasons.push(
        `Sustained wind ${windSpeed} km/h exceeds category limit of ${threshold.criticalWindSpeedKmh} km/h`
      );
    }

    if (breachReasons.length > 0) {
      breaches.push({
        nodeId: node.id,
        nodeName: node.name,
        category: node.type,
        riskScore: computedRiskScore,
        floodDepthMeters: floodDepth,
        breachReasons,
        priorityLevel: threshold.priorityLevel,
        operationalDirective: threshold.operationalDirective,
        elevationMeters: node.elevationMeters,
        thresholdRiskScore: threshold.criticalRiskScore,
        thresholdDepthMeters: threshold.criticalWaterDepthMeters,
      });
    }
  });

  return breaches;
}
