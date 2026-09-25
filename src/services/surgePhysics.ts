import {
  CycloneScenario,
  InfrastructureNode,
  CoastalSurgeZone,
  ZoneCalculatedRisk,
  SurgeRiskLevel,
} from '../types/cyclone';

export interface CalculatedSurgeMetrics {
  inverseBarometerMeters: number;
  windSetupMeters: number;
  bathymetricAmplificationFactor: number;
  pureSurgeMeters: number;
  mangroveDampingMeters: number;
  astronomicalTideMeters: number;
  totalWaterLevelMeters: number;
  inundationAreaSqKm: number;
  populationAtRisk: number;
}

/**
 * Calculates storm surge and total water level using geophysical equations
 * tailored to the unique bathymetry and funnel geometry of the Bay of Bengal.
 */
export function calculateSurgePhysics(
  scenario: CycloneScenario,
  timeOffsetHours: number = 0,
  mangroveActiveOverride?: boolean,
  astronomicalTideOverride?: number
): CalculatedSurgeMetrics {
  const pressure = scenario.centralPressure;
  const windKmh = scenario.windSpeed;
  const windMps = windKmh / 3.6;

  // 1. Inverse Barometer Effect: ~1.04 cm per 1 hPa deficit below standard 1013 hPa
  const pressureDeficit = Math.max(0, 1013 - pressure);
  const inverseBarometerMeters = Number(((pressureDeficit * 1.04) / 100).toFixed(2));

  // 2. Wind Stress Setup on Shallow Continental Shelf
  // Formula: eta_wind = (rho_air * C_d * U10^2 * Fetch) / (rho_water * g * mean_depth)
  // Calibrated for Bay of Bengal northern shallow shelf (mean shelf depth ~25m, fetch ~220km)
  const cd = 0.0026; // Drag coefficient at high tropical cyclone winds
  const shelfDepth = 28; // meters (shallow northern bay)
  const fetchKm = 240;
  const g = 9.81;
  const windSetupMeters = Number(
    ((1.2 * cd * Math.pow(windMps, 2) * (fetchKm * 1000)) / (1025 * g * shelfDepth) * 0.045).toFixed(2)
  );

  // 3. Bathymetric & Delta Funneling Amplification Factor
  // The concave geometry of the Gangetic and Bengal Delta funnels and amplifies the surge
  const bathymetricAmplificationFactor = 1.35;

  let rawSurge = (inverseBarometerMeters + windSetupMeters) * bathymetricAmplificationFactor;

  // Time decay factor relative to landfall ETA (Gaussian peak at Landfall T=0)
  const sigma = 8; // spread in hours
  const timeFactor = Math.exp(-Math.pow(timeOffsetHours, 2) / (2 * Math.pow(sigma, 2)));
  let timeScaledSurge = rawSurge * (0.2 + 0.8 * timeFactor);

  // 4. Mangrove Attenuation Barrier (e.g. Sundarbans biosphere buffer)
  // Dense Rhizophora and Avicennia roots attenuate surge wave energy by ~0.5m to 0.9m
  const isMangroveActive = mangroveActiveOverride !== undefined ? mangroveActiveOverride : scenario.mangroveBuffer;
  const mangroveDampingMeters = isMangroveActive ? scenario.mangroveDampingFactorMeters : 0.0;
  const pureSurgeMeters = Math.max(0.4, Number((timeScaledSurge - (isMangroveActive ? mangroveDampingMeters * 0.7 : 0)).toFixed(2)));

  // 5. Astronomical Tide Superposition (M2 semi-diurnal tidal cycle ~12.42h period)
  // Bay of Bengal spring tidal range reaches 3.5m - 4.5m in northern estuaries
  const tidalPeriodHours = 12.42;
  const tidePhase = (timeOffsetHours % tidalPeriodHours) / tidalPeriodHours * 2 * Math.PI;
  const theoreticalTide = Number((scenario.astronomicalTideMeters * Math.cos(tidePhase)).toFixed(2));
  const astronomicalTideMeters =
    astronomicalTideOverride !== undefined
      ? Number(astronomicalTideOverride.toFixed(2))
      : theoreticalTide;

  // 6. Total Water Level (TWL) = Pure Surge + Astronomical Tide
  const totalWaterLevelMeters = Number(Math.max(0, pureSurgeMeters + astronomicalTideMeters).toFixed(2));

  // 7. Area and Population Estimations based on DEM elevation curves
  // Delta topography: steep increase in exposure once surge exceeds 2.5m
  const inundationAreaSqKm = Math.round(180 + Math.pow(totalWaterLevelMeters, 2.4) * 45);
  const populationAtRisk = Math.round(45000 + Math.pow(totalWaterLevelMeters, 2.2) * 28000);

  return {
    inverseBarometerMeters,
    windSetupMeters,
    bathymetricAmplificationFactor,
    pureSurgeMeters,
    mangroveDampingMeters,
    astronomicalTideMeters,
    totalWaterLevelMeters,
    inundationAreaSqKm,
    populationAtRisk,
  };
}

/**
 * Calculates flood depth and vulnerability state for an individual infrastructure node
 */
export function evaluateNodeVulnerability(
  node: InfrastructureNode,
  totalWaterLevelMeters: number,
  cycloneWindKmh: number
): {
  floodDepthMeters: number;
  isInundated: boolean;
  riskScore: number;
  status: InfrastructureNode['status'];
  urgentRecommendation: string;
} {
  // Flood depth at site = Total Water Level - Ground Elevation
  const floodDepthMeters = Number(Math.max(0, totalWaterLevelMeters - node.elevationMeters).toFixed(2));
  const isInundated = floodDepthMeters > 0;

  // Composite risk score: combination of water depth relative to critical threshold + wind force
  const depthRatio = floodDepthMeters / Math.max(0.5, node.floodCriticalHeightMeters);
  const windRatio = cycloneWindKmh / 160;

  let riskScore = Math.min(100, Math.round(depthRatio * 65 + windRatio * 35));

  let status: InfrastructureNode['status'] = 'normal';
  let urgentRecommendation = 'Continue regular monitoring and alert log.';

  if (node.type === 'substation') {
    if (floodDepthMeters >= node.floodCriticalHeightMeters || riskScore >= 75) {
      status = 'de_energized';
      riskScore = Math.max(riskScore, 85);
      urgentRecommendation = 'EMERGENCY: Initiate immediate sectional load shedding and de-energize 33kV switchyard to avert transformer explosion.';
    } else if (floodDepthMeters > 0.3 || riskScore >= 50) {
      status = 'warning';
      urgentRecommendation = 'Position portable submersible de-watering pumps; elevate auxiliary control panels.';
    }
  } else if (node.type === 'road') {
    if (floodDepthMeters >= 0.4 || riskScore >= 75) {
      status = 'flooded';
      urgentRecommendation = 'IMPASSABLE: Close corridor to civilian traffic; reroute evacuation convoys via elevated bypass.';
    } else if (floodDepthMeters > 0.1 || riskScore >= 45) {
      status = 'warning';
      urgentRecommendation = 'CAUTION: Heavy waterlogging on low culverts; high-clearance military/NDRF vehicles only.';
    }
  } else if (node.type === 'shelter' || node.type === 'hospital') {
    if (floodDepthMeters >= node.floodCriticalHeightMeters) {
      status = 'critical';
      urgentRecommendation = 'EVACUATE VERTICAL: Move patients/evacuees to 2nd tier; activate roof-mounted diesel generator.';
    } else if (floodDepthMeters > 0 || riskScore >= 50) {
      status = 'warning';
      urgentRecommendation = 'Secure ground-level potable water storage; deploy sandbags around generator foundation.';
    }
  }

  return {
    floodDepthMeters,
    isInundated,
    riskScore,
    status,
    urgentRecommendation,
  };
}

/**
 * Computes localized surge intensity, overtopping depth, breach probability,
 * and evacuation mandates for a specific coastal zone based on the active cyclone scenario.
 */
export function calculateZoneSurgeRisk(
  zone: CoastalSurgeZone,
  scenario: CycloneScenario,
  totalWaterLevelMeters: number,
  mangroveActiveOverride: boolean = true
): ZoneCalculatedRisk {
  // Compute approximate distance from zone centroid to cyclone landfall center
  const lats = zone.polygon.map((p) => p[0]);
  const lngs = zone.polygon.map((p) => p[1]);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  const dLat = (centerLat - scenario.landfallCoordinates.lat) * 111;
  const dLng =
    (centerLng - scenario.landfallCoordinates.lng) *
    111 *
    Math.cos((centerLat * Math.PI) / 180);
  const distKm = Math.sqrt(dLat * dLat + dLng * dLng);

  // Distance decay from radius of maximum winds
  const rmax = scenario.rmaxKm || 45;
  const decayFactor = Math.max(
    0.2,
    Math.exp(-Math.pow(Math.max(0, distKm - rmax), 1.25) / 190)
  );

  // Mangrove barrier damping for this zone
  const isMangroveActive = mangroveActiveOverride;
  const mangroveAttenuation = isMangroveActive
    ? (zone.mangroveProtectionPercent / 100) * 0.9
    : 0.05;

  // Local effective surge accounting for estuary funneling geometry and storm decay
  const rawSurgeAtZone = totalWaterLevelMeters * decayFactor * zone.funnelingFactor;
  const localSurgeMeters = Number(
    Math.max(0.25, rawSurgeAtZone - mangroveAttenuation).toFixed(2)
  );

  // Embankment overtopping depth
  const overtoppingDepthMeters = Number(
    Math.max(0, localSurgeMeters - zone.embankmentHeightMeters).toFixed(2)
  );

  // Inundation Risk Score (0 - 100)
  const overtopRatio = Math.min(2.5, overtoppingDepthMeters / 1.4);
  const surgeVsElevRatio = Math.min(
    2.0,
    localSurgeMeters / Math.max(0.6, zone.meanElevationMeters)
  );
  const windFactor = scenario.windSpeed / 175;

  const rawScore = overtopRatio * 45 + surgeVsElevRatio * 35 + windFactor * 20;
  const riskScore = Math.min(100, Math.max(10, Math.round(rawScore)));

  // Risk Level Category
  let riskLevel: SurgeRiskLevel = 'LOW';
  let breachProbabilityPercent = 5;
  let evacFraction = 0.08;
  let evacuationMandate = 'Advisory: Secure marine craft and monitor sirens';

  if (riskScore >= 80 || overtoppingDepthMeters >= 0.8) {
    riskLevel = 'CATASTROPHIC';
    breachProbabilityPercent = Math.min(
      99,
      Math.round(75 + overtoppingDepthMeters * 20)
    );
    evacFraction = 0.85;
    evacuationMandate = 'ZERO-CASUALTY FORCED EVACUATION: Mandatory total clearance of zone';
  } else if (riskScore >= 65 || overtoppingDepthMeters >= 0.3) {
    riskLevel = 'SEVERE';
    breachProbabilityPercent = Math.min(
      85,
      Math.round(50 + overtoppingDepthMeters * 28)
    );
    evacFraction = 0.6;
    evacuationMandate = 'MANDATORY EVACUATION: Relocate all residents within 2km of coastal line';
  } else if (riskScore >= 48 || overtoppingDepthMeters > 0) {
    riskLevel = 'HIGH';
    breachProbabilityPercent = Math.min(
      52,
      Math.round(25 + overtoppingDepthMeters * 35)
    );
    evacFraction = 0.35;
    evacuationMandate = 'PREVENTATIVE EVACUATION: Kutcha houses and vulnerable families to shelters';
  } else if (riskScore >= 30) {
    riskLevel = 'MODERATE';
    breachProbabilityPercent = 18;
    evacFraction = 0.15;
    evacuationMandate = 'YELLOW ALERT: Standby at community shelters; suspend fishing';
  }

  const evacueeCount = Math.round(zone.populationAtRisk * evacFraction);

  const keyVulnerabilities: string[] = [];
  if (overtoppingDepthMeters > 0) {
    keyVulnerabilities.push(
      `Embankment overtopping modeled at +${overtoppingDepthMeters}m above crest`
    );
  } else {
    const freeboard = Number(
      (zone.embankmentHeightMeters - localSurgeMeters).toFixed(2)
    );
    keyVulnerabilities.push(`Embankment crest freeboard margin: ${freeboard}m`);
  }

  if (zone.mangroveProtectionPercent > 35 && isMangroveActive) {
    keyVulnerabilities.push(
      `Mangrove buffer active: -${mangroveAttenuation.toFixed(2)}m wave dissipation`
    );
  } else if (zone.mangroveProtectionPercent < 20) {
    keyVulnerabilities.push('Negligible natural mangrove barrier; open sea wave energy');
  }

  if (zone.funnelingFactor >= 1.3) {
    keyVulnerabilities.push(
      `Estuary funnel geometry amplification: ${zone.funnelingFactor}x`
    );
  }

  return {
    zoneId: zone.id,
    localSurgeMeters,
    overtoppingDepthMeters,
    riskScore,
    riskLevel,
    breachProbabilityPercent,
    evacueeCount,
    evacuationMandate,
    keyVulnerabilities,
  };
}

