export type CycloneCategory =
  | 'Depression'
  | 'Deep Depression'
  | 'Cyclonic Storm'
  | 'Severe Cyclonic Storm'
  | 'Very Severe Cyclonic Storm'
  | 'Extremely Severe Cyclonic Storm'
  | 'Super Cyclonic Storm';

export interface ForecastPoint {
  timeOffsetHours: number; // e.g. -48, -24, -12, 0 (landfall), +6, +12, +24
  label: string;
  lat: number;
  lng: number;
  windSpeedKmh: number;
  centralPressureHpa: number;
  surgeHeightMeters: number;
  astronomicalTideMeters: number;
  totalWaterLevelMeters: number;
  rainRateMmPerHour: number;
}

export interface CycloneScenario {
  id: string;
  name: string;
  basin: string; // e.g. 'Bay of Bengal - North', 'Odisha Coast', 'Bengal Delta'
  category: CycloneCategory;
  windSpeed: number; // km/h
  gusts: number; // km/h
  centralPressure: number; // hPa
  forwardSpeed: number; // km/h
  landfallTarget: string;
  landfallETA: string;
  tidalPhase: string; // e.g. 'Astronomical Spring High Tide (+1.9m)'
  astronomicalTideMeters: number;
  peakSurge: number; // meters
  mangroveBuffer: boolean;
  mangroveDampingFactorMeters: number;
  rmaxKm: number; // Radius of maximum wind
  currentCoordinates: { lat: number; lng: number };
  landfallCoordinates: { lat: number; lng: number };
  forecastTrack: ForecastPoint[];
  historicalAnalogue?: string;
  description: string;
}

export type InfrastructureType =
  | 'substation'
  | 'road'
  | 'shelter'
  | 'hospital'
  | 'water_plant'
  | 'port';

export interface InfrastructureNode {
  id: string;
  name: string;
  type: InfrastructureType;
  lat: number;
  lng: number;
  elevationMeters: number;
  floodCriticalHeightMeters: number;
  district: string;
  capacity?: number;
  status: 'normal' | 'warning' | 'critical' | 'de_energized' | 'flooded';
  currentRiskScore: number; // 0 to 100
  recommendedAction: string;
  notes: string;
}

export interface EvacuationCorridor {
  id: string;
  name: string;
  highwayNumber: string;
  from: string;
  to: string;
  coordinates: [number, number][];
  elevationMeters: number;
  passability: 'open' | 'caution' | 'impassable';
  culvertRiskCount: number;
  evacuationCapacityVehiclesPerHour: number;
}

export interface GEESatelliteFeed {
  id: string;
  name: string;
  sensor: string;
  dataType: string;
  resolution: string;
  satellitePlatform: string;
  lastPassTimestamp: string;
  active: boolean;
  colorScale: string;
  description: string;
  liveMetric: string;
}

export interface ParametricInsurancePolicy {
  policyId: string;
  district: string;
  primaryPeril: string;
  windTriggerThresholdKmh: number;
  surgeTriggerThresholdMeters: number;
  currentWindObservedKmh: number;
  currentSurgeObservedMeters: number;
  triggerStatus: 'MONITORING' | 'TRIGGER_ACTIVATED' | 'LIQUIDITY_RELEASED';
  totalCoverageUSD: number;
  immediatePreLandfallPayoutUSD: number;
  beneficiaryHouseholds: number;
  settlementSpeedHours: number;
}

export interface AnticipatoryActionReport {
  executiveSummary: string;
  stormSurgeRiskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  inundationPathways: string[];
  infrastructureActionPlan: {
    powerGrid: string;
    arterialRoads: string;
    medicalShelters: string;
  };
  parametricInsuranceLiquidity: {
    triggerStatus: 'ACTIVATED' | 'PENDING';
    recommendedImmediateDisbursementUSD: number;
    utilizationDirectives: string[];
  };
  anticipatoryEvacuationPriorities: Array<{
    zone: string;
    targetPopulation: number;
    criticalDeadlineHours: number;
    primaryHazard: string;
  }>;
  geeRemoteSensingObservations: string;
}

export interface IdentifiedHighRiskNode {
  id: string;
  name: string;
  type: InfrastructureType;
  riskScore: number;
  threatSummary: string;
  recommendedAction: string;
  floodDepthMeters?: number;
  status?: InfrastructureNode['status'];
}

export interface EarlyWarningAdvisory {
  bulletinNumber: string;
  urgency: 'IMMEDIATE' | 'EXPECTED' | 'FUTURE';
  severity: 'EXTREME' | 'SEVERE' | 'MODERATE';
  headline: string;
  broadcastContent: string;
  actionDirectives: string[];
  capXmlSnippet?: string;
  publicSmsText: string;
  highRiskInfrastructure?: IdentifiedHighRiskNode[];
}

export type SurgeRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'CATASTROPHIC';

export interface CoastalSurgeZone {
  id: string;
  name: string;
  region: string;
  polygon: [number, number][];
  meanElevationMeters: number;
  embankmentHeightMeters: number;
  mangroveProtectionPercent: number;
  populationAtRisk: number;
  criticalAssetsCount: number;
  funnelingFactor: number;
  description: string;
}

export interface ZoneCalculatedRisk {
  zoneId: string;
  localSurgeMeters: number;
  overtoppingDepthMeters: number;
  riskScore: number; // 0 - 100
  riskLevel: SurgeRiskLevel;
  breachProbabilityPercent: number;
  evacueeCount: number;
  evacuationMandate: string;
  keyVulnerabilities: string[];
}

export type RouteObjective = 'safest' | 'fastest' | 'balanced';

export interface RouteHazard {
  id: string;
  type: 'flood_inundation' | 'culvert_washout' | 'traffic_congestion' | 'bridge_closure';
  location: string;
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigationAdvice: string;
}

export interface RouteLeg {
  fromName: string;
  toName: string;
  highwayNumber: string;
  distanceKm: number;
  estimatedMinutes: number;
  roadElevationMeters: number;
  currentFloodDepthMeters: number;
  congestionFactor: number; // 1.0 (free) to 3.5+ (jammed)
  passability: 'open' | 'caution' | 'impassable';
  coordinates: [number, number][];
}

export interface EvacuationRoute {
  id: string;
  name: string;
  type: 'safest' | 'fastest' | 'alternative';
  originName: string;
  destinationName: string;
  totalDistanceKm: number;
  totalMinutes: number;
  safetyScore: number; // 0 to 100%
  maxSurgeExposureMeters: number;
  averageElevationMeters: number;
  congestionIndex: 'low' | 'moderate' | 'heavy' | 'gridlock';
  overallStatus: 'clear' | 'caution' | 'high_risk';
  legs: RouteLeg[];
  hazards: RouteHazard[];
  coordinates: [number, number][];
  recommendedVehicleTypes: string[];
}

export interface EvacuationOrigin {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  populationAtRisk: number;
  meanElevationMeters: number;
}

export interface EvacuationDestination {
  id: string;
  name: string;
  type: 'shelter' | 'hospital' | 'staging_base';
  lat: number;
  lng: number;
  capacity: number;
  currentOccupancy: number;
  elevationMeters: number;
  distanceKmApprox: number;
}

export interface HistoricalCycloneEvent {
  id: string;
  name: string;
  year: number;
  month: string;
  category: string;
  peakWindsKmh: number;
  centralPressureHpa: number;
  peakSurgeMeters: number;
  totalWaterLevelMeters: number;
  economicDamageBillionUsd: number;
  substationsAffected: number;
  embankmentBreachKm: number;
  evacueesCount: number;
  casualtiesReported: number;
  landfallLocation: string;
  landfallCoordinates: { lat: number; lng: number };
  trackCoordinates: [number, number][];
  primaryDisruptionSignature: string;
  resilienceLessonsLearned: string;
  timelineDates: string;
}

export interface CategoryRiskThreshold {
  category: InfrastructureType;
  label: string;
  criticalRiskScore: number; // 0 - 100
  criticalWaterDepthMeters: number; // meters above ground elevation
  criticalWindSpeedKmh: number; // km/h
  enabled: boolean;
  priorityLevel: 'CRITICAL' | 'HIGH';
  operationalDirective: string;
}

export type RiskThresholdSettings = Record<InfrastructureType, CategoryRiskThreshold>;

export interface ThresholdBreachDetail {
  nodeId: string;
  nodeName: string;
  category: InfrastructureType;
  riskScore: number;
  floodDepthMeters: number;
  breachReasons: string[];
  priorityLevel: 'CRITICAL' | 'HIGH';
  operationalDirective: string;
  elevationMeters: number;
  thresholdRiskScore: number;
  thresholdDepthMeters: number;
}

export type BreachSeverityLevel = 'CATASTROPHIC' | 'CRITICAL' | 'SEVERE' | 'WARNING';

export type StickyNoteColor = 'yellow' | 'cyan' | 'rose' | 'amber' | 'emerald' | 'purple';

export interface MapStickyNote {
  id: string;
  nodeId?: string;
  nodeName?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  title: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  color: StickyNoteColor;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface HistoricalBreachAlertRecord {
  id: string;
  timestamp: string;
  dateStr: string;
  sessionRelativeSeconds: number;
  timelineStepHour: number;
  timelineLabel: string;
  scenarioId: string;
  scenarioName: string;
  nodeId: string;
  nodeName: string;
  nodeType: InfrastructureType;
  district: string;
  totalWaterLevelMeters: number;
  windSpeedKmh: number;
  floodDepthMeters: number;
  riskScore: number;
  severity: BreachSeverityLevel;
  breachReasons: string[];
  operationalDirective: string;
}
