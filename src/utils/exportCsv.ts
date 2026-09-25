import {
  CycloneScenario,
  InfrastructureNode,
  EvacuationCorridor,
  CoastalSurgeZone,
} from '../types/cyclone';
import { evaluateNodeVulnerability, calculateZoneSurgeRisk } from '../services/surgePhysics';

/**
 * Escapes fields for RFC 4180 compliant CSV export
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function generateInfrastructureRiskCsv(params: {
  scenario: CycloneScenario;
  totalWaterLevel: number;
  pureSurge: number;
  astronomicalTide: number;
  timeOffset: number;
  infrastructure: InfrastructureNode[];
  corridors: EvacuationCorridor[];
  coastalZones: CoastalSurgeZone[];
  sectorImpactData?: Array<{
    sector: string;
    downtimeHours: number;
    economicLossM: number;
    criticalThreat: string;
  }>;
  mangroveOverride?: boolean;
}): string {
  const {
    scenario,
    totalWaterLevel,
    pureSurge,
    astronomicalTide,
    timeOffset,
    infrastructure,
    corridors,
    coastalZones,
    sectorImpactData = [],
    mangroveOverride = true,
  } = params;

  const lines: string[] = [];

  // Metadata Header Block
  lines.push('# ==============================================================================');
  lines.push('# BAYSHIELD AI - CYCLONE IMPACT & INFRASTRUCTURE VULNERABILITY FORECAST REPORT');
  lines.push('# Common Emergency Operations Center Data Exchange Specification');
  lines.push('# ==============================================================================');
  lines.push(`Generated At,${escapeCsv(new Date().toISOString())}`);
  lines.push(`Cyclone Name,${escapeCsv(scenario.name)}`);
  lines.push(`Basin & Landfall Target,${escapeCsv(`${scenario.basin} | ${scenario.landfallTarget}`)}`);
  lines.push(`Category & Intensity,${escapeCsv(`${scenario.category} (${scenario.windSpeed} km/h sustained, Gusts ${scenario.gusts} km/h)`)}`);
  lines.push(`Central Pressure,${escapeCsv(`${scenario.centralPressure} hPa`)}`);
  lines.push(`Simulation Timeline Phase,${escapeCsv(timeOffset === 0 ? 'T-0 Landfall' : `T${timeOffset > 0 ? '+' : ''}${timeOffset} Hours`)}`);
  lines.push(`Peak Total Water Level (TWL),${escapeCsv(`${totalWaterLevel.toFixed(2)} m`)}`);
  lines.push(`Pure Meteorological Surge,${escapeCsv(`${pureSurge.toFixed(2)} m`)}`);
  lines.push(`Astronomical Tide Component,${escapeCsv(`${astronomicalTide.toFixed(2)} m (${scenario.tidalPhase})`)}`);
  lines.push(`Sundarbans Mangrove Buffer Active,${escapeCsv(mangroveOverride ? 'YES (-0.85m Energy Dissipation)' : 'NO (Degraded/Bypassed)')}`);
  lines.push('');

  // 1. Critical Infrastructure Assets Section
  lines.push('# ------------------------------------------------------------------------------');
  lines.push('# SECTION 1: CRITICAL INFRASTRUCTURE ASSETS EXPOSURE AUDIT');
  lines.push('# ------------------------------------------------------------------------------');
  lines.push([
    'Asset ID',
    'Asset Name',
    'Sector Type',
    'District / Jurisdiction',
    'Ground Elevation (m ASL)',
    'Critical Flood Threshold (m)',
    'Modeled Flood Depth (m)',
    'Operational Status',
    'Vulnerability Risk Score (0-100)',
    'Mandated Mitigation Action',
    'Operational Notes',
  ].map(escapeCsv).join(','));

  infrastructure.forEach((node) => {
    const v = evaluateNodeVulnerability(node, totalWaterLevel, scenario.windSpeed);
    lines.push([
      node.id,
      node.name,
      node.type.toUpperCase(),
      node.district,
      node.elevationMeters,
      node.floodCriticalHeightMeters,
      v.floodDepthMeters > 0 ? `+${v.floodDepthMeters}` : '0.00 (Dry)',
      v.status.toUpperCase(),
      v.riskScore,
      v.urgentRecommendation,
      node.notes,
    ].map(escapeCsv).join(','));
  });

  lines.push('');

  // 2. Coastal Surge Risk Intensity Zones Section
  lines.push('# ------------------------------------------------------------------------------');
  lines.push('# SECTION 2: COASTAL SURGE RISK INTENSITY BY LITTORAL SECTOR');
  lines.push('# ------------------------------------------------------------------------------');
  lines.push([
    'Zone ID',
    'Coastal Zone Name',
    'Region',
    'Mean Elevation (m)',
    'Embankment Crest (m)',
    'Modeled Local Surge (m)',
    'Crest Overtopping Depth (m)',
    'Threat Classification',
    'Composite Risk Score (0-100)',
    'Breach Probability (%)',
    'Total Exposed Population',
    'Immediate Evacuees Required',
    'Official Municipal Mandate',
  ].map(escapeCsv).join(','));

  coastalZones.forEach((zone) => {
    const r = calculateZoneSurgeRisk(zone, scenario, totalWaterLevel, mangroveOverride);
    lines.push([
      zone.id,
      zone.name,
      zone.region,
      zone.meanElevationMeters,
      zone.embankmentHeightMeters,
      r.localSurgeMeters,
      r.overtoppingDepthMeters > 0 ? `+${r.overtoppingDepthMeters}` : '0.00 (Safe)',
      r.riskLevel,
      r.riskScore,
      `${r.breachProbabilityPercent}%`,
      zone.populationAtRisk,
      r.evacueeCount,
      r.evacuationMandate,
    ].map(escapeCsv).join(','));
  });

  lines.push('');

  // 3. Utility Downtime & Economic Loss Impact Summary
  if (sectorImpactData.length > 0) {
    lines.push('# ------------------------------------------------------------------------------');
    lines.push('# SECTION 3: UTILITY DOWNTIME & ECONOMIC LOSS PROJECTION');
    lines.push('# ------------------------------------------------------------------------------');
    lines.push([
      'Utility Sector',
      'Predicted Restoration Downtime (Hours)',
      'Estimated Economic Loss ($M USD)',
      'Primary Disruption Mechanism',
    ].map(escapeCsv).join(','));

    sectorImpactData.forEach((s) => {
      lines.push([
        s.sector,
        `${s.downtimeHours} hrs`,
        `$${s.economicLossM}M`,
        s.criticalThreat,
      ].map(escapeCsv).join(','));
    });

    lines.push('');
  }

  // 4. Arterial Evacuation Corridors & Road Arteries
  lines.push('# ------------------------------------------------------------------------------');
  lines.push('# SECTION 4: ARTERIAL EVACUATION HIGHWAYS & CHOKEPOINTS');
  lines.push('# ------------------------------------------------------------------------------');
  lines.push([
    'Corridor ID',
    'Route Name',
    'Highway Number',
    'Origin Point',
    'Destination Point',
    'Mean Elevation (m)',
    'Passability Status',
    'Vulnerable Culvert Points',
    'Evacuation Throughput (Vehicles/Hr)',
  ].map(escapeCsv).join(','));

  corridors.forEach((c) => {
    lines.push([
      c.id,
      c.name,
      c.highwayNumber,
      c.from,
      c.to,
      c.elevationMeters,
      c.passability.toUpperCase(),
      c.culvertRiskCount,
      c.evacuationCapacityVehiclesPerHour,
    ].map(escapeCsv).join(','));
  });

  return lines.join('\r\n');
}

/**
 * Triggers a browser download of the CSV report
 */
export function downloadInfrastructureRiskCsv(params: {
  scenario: CycloneScenario;
  totalWaterLevel: number;
  pureSurge: number;
  astronomicalTide: number;
  timeOffset: number;
  infrastructure: InfrastructureNode[];
  corridors: EvacuationCorridor[];
  coastalZones: CoastalSurgeZone[];
  sectorImpactData?: Array<{
    sector: string;
    downtimeHours: number;
    economicLossM: number;
    criticalThreat: string;
  }>;
  mangroveOverride?: boolean;
}) {
  const csvContent = generateInfrastructureRiskCsv(params);
  // Prepend UTF-8 BOM so Microsoft Excel handles special characters cleanly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanScenarioName = params.scenario.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const phaseTag = params.timeOffset === 0 ? 'T-0_Landfall' : `T${params.timeOffset > 0 ? '+' : ''}${params.timeOffset}h`;
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `BayShield_Disaster_Report_${cleanScenarioName}_${phaseTag}_${dateStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads an RFC 4180 CSV audit export of historical breach alert records
 */
export function downloadBreachAlertHistoryCsv(records: Array<{
  id: string;
  timestamp: string;
  dateStr: string;
  sessionRelativeSeconds: number;
  timelineStepHour: number;
  timelineLabel: string;
  scenarioName: string;
  nodeName: string;
  nodeType: string;
  district: string;
  totalWaterLevelMeters: number;
  windSpeedKmh: number;
  floodDepthMeters: number;
  riskScore: number;
  severity: string;
  breachReasons: string[];
  operationalDirective: string;
}>) {
  const lines: string[] = [];

  lines.push('# ==============================================================================');
  lines.push('# BAYSHIELD AI - SIMULATION SESSION INFRASTRUCTURE BREACH ALERT AUDIT LOG');
  lines.push('# ==============================================================================');
  lines.push(`Exported At,${escapeCsv(new Date().toISOString())}`);
  lines.push(`Total Breach Records,${records.length}`);
  lines.push('');

  lines.push(
    [
      'Record ID',
      'Event Timestamp',
      'Session Elapsed (s)',
      'Timeline Step',
      'Scenario',
      'Severity',
      'Facility Name',
      'Category',
      'District',
      'Total Water Level (m)',
      'Flood Inundation Depth (m)',
      'Wind Speed (km/h)',
      'Risk Score (/100)',
      'Breach Reasons',
      'Operational Directive',
    ].join(',')
  );

  records.forEach((r) => {
    lines.push(
      [
        escapeCsv(r.id),
        escapeCsv(r.timestamp),
        r.sessionRelativeSeconds,
        escapeCsv(r.timelineLabel),
        escapeCsv(r.scenarioName),
        escapeCsv(r.severity),
        escapeCsv(r.nodeName),
        escapeCsv(r.nodeType),
        escapeCsv(r.district),
        r.totalWaterLevelMeters,
        r.floodDepthMeters,
        r.windSpeedKmh,
        r.riskScore,
        escapeCsv(r.breachReasons.join('; ')),
        escapeCsv(r.operationalDirective),
      ].join(',')
    );
  });

  const csvContent = lines.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  const filename = `BayShield_Breach_Alert_History_${dateStr}_${timeStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
