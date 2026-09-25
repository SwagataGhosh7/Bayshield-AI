import {
  CoastalSurgeZone,
  InfrastructureNode,
} from '../types/cyclone';
import { evaluateNodeVulnerability } from './surgePhysics';

export interface CompromisedNodeDetail {
  id: string;
  name: string;
  type: string;
  riskScore: number;
  status: string;
  elevationMeters: number;
  floodDepthMeters: number;
  action: string;
}

export type DensityLevel = 'ZERO' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL_CLUSTER';

export interface ZoneNodeDensityMetrics {
  zoneId: string;
  zoneName: string;
  region: string;
  polygon: [number, number][];
  centroid: [number, number];
  totalNodes: number;
  highRiskNodes: number;
  moderateRiskNodes: number;
  safeNodes: number;
  densityRatio: number; // highRiskNodes / Math.max(1, totalNodes)
  densityLevel: DensityLevel;
  densityColor: string;
  densityBorderColor: string;
  densityFillOpacity: number;
  compromisedNodes: CompromisedNodeDetail[];
  allNodes: InfrastructureNode[];
  operationalMandate: string;
}

/**
 * Standard Ray-Casting Point-in-Polygon algorithm
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculates geographic centroid of polygon coordinates
 */
export function getPolygonCentroid(polygon: [number, number][]): [number, number] {
  if (polygon.length === 0) return [21.5, 88.0];
  let sumLat = 0;
  let sumLng = 0;
  polygon.forEach(([lat, lng]) => {
    sumLat += lat;
    sumLng += lng;
  });
  return [sumLat / polygon.length, sumLng / polygon.length];
}

/**
 * Haversine distance in kilometers
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes density metrics and assigns nodes to coastal surge zones
 */
export function calculateAllZonesDensity(
  zones: CoastalSurgeZone[],
  infrastructure: InfrastructureNode[],
  totalWaterLevel: number,
  windSpeed: number
): ZoneNodeDensityMetrics[] {
  // Precompute centroids
  const zoneCentroids = zones.map((z) => ({
    zone: z,
    centroid: getPolygonCentroid(z.polygon),
  }));

  // Map each infrastructure node to a zone
  const nodesByZoneId: Record<string, InfrastructureNode[]> = {};
  zones.forEach((z) => {
    nodesByZoneId[z.id] = [];
  });

  infrastructure.forEach((node) => {
    let assignedZoneId: string | null = null;

    // 1. Point in polygon check
    for (const z of zones) {
      if (isPointInPolygon([node.lat, node.lng], z.polygon)) {
        assignedZoneId = z.id;
        break;
      }
    }

    // 2. Proximity fallback to nearest zone centroid if within 45km
    if (!assignedZoneId) {
      let minDist = 45; // 45km max threshold
      for (const zc of zoneCentroids) {
        const dist = haversineDistanceKm(node.lat, node.lng, zc.centroid[0], zc.centroid[1]);
        if (dist < minDist) {
          minDist = dist;
          assignedZoneId = zc.zone.id;
        }
      }
    }

    if (assignedZoneId && nodesByZoneId[assignedZoneId]) {
      nodesByZoneId[assignedZoneId].push(node);
    }
  });

  // Calculate density metrics per zone
  return zones.map((zone) => {
    const assignedNodes = nodesByZoneId[zone.id] || [];
    const centroid = getPolygonCentroid(zone.polygon);

    const compromisedNodes: CompromisedNodeDetail[] = [];
    let highRiskCount = 0;
    let moderateRiskCount = 0;
    let safeCount = 0;

    assignedNodes.forEach((node) => {
      const vuln = evaluateNodeVulnerability(node, totalWaterLevel, windSpeed);
      const isHighRisk =
        vuln.riskScore >= 60 ||
        vuln.status === 'critical' ||
        vuln.status === 'de_energized' ||
        vuln.status === 'flooded' ||
        vuln.isInundated;

      if (isHighRisk) {
        highRiskCount++;
        compromisedNodes.push({
          id: node.id,
          name: node.name,
          type: node.type,
          riskScore: vuln.riskScore,
          status: vuln.status,
          elevationMeters: node.elevationMeters,
          floodDepthMeters: vuln.floodDepthMeters,
          action: vuln.urgentRecommendation,
        });
      } else if (vuln.riskScore >= 35 || vuln.status === 'warning') {
        moderateRiskCount++;
      } else {
        safeCount++;
      }
    });

    const totalNodes = assignedNodes.length;
    const densityRatio = totalNodes > 0 ? highRiskCount / totalNodes : 0;

    // Density Classification:
    // Uses absolute count of high-risk nodes combined with proportion
    let densityLevel: DensityLevel = 'ZERO';
    let densityColor = '#334155'; // Slate-700
    let densityBorderColor = '#64748b';
    let densityFillOpacity = 0.22;
    let operationalMandate = 'All facility plinths remain above critical flood stage.';

    if (highRiskCount >= 6) {
      densityLevel = 'CRITICAL_CLUSTER';
      densityColor = '#991b1b'; // Red-800 / Crimson
      densityBorderColor = '#f87171';
      densityFillOpacity = 0.72;
      operationalMandate = 'SEVERE COMPROMISED CLUSTER: Mandatory high-voltage grid shutdown & amphibious boat deployment.';
    } else if (highRiskCount >= 4) {
      densityLevel = 'HIGH';
      densityColor = '#ef4444'; // Red-500
      densityBorderColor = '#fca5a5';
      densityFillOpacity = 0.62;
      operationalMandate = 'HIGH CONCENTRATION: Pre-position sandbag cofferdams, seal hospital generators, and impose causeway closures.';
    } else if (highRiskCount >= 2) {
      densityLevel = 'MODERATE';
      densityColor = '#f97316'; // Orange-500
      densityBorderColor = '#fed7aa';
      densityFillOpacity = 0.52;
      operationalMandate = 'MODERATE STRESS: Monitor sluice gates and prepare backup diesel generator inventory.';
    } else if (highRiskCount === 1) {
      densityLevel = 'LOW';
      densityColor = '#eab308'; // Yellow-500
      densityBorderColor = '#fef08a';
      densityFillOpacity = 0.42;
      operationalMandate = 'LOCALIZED IMPACT: Single vulnerable facility undergoing precautionary protocol.';
    }

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      region: zone.region,
      polygon: zone.polygon,
      centroid,
      totalNodes,
      highRiskNodes: highRiskCount,
      moderateRiskNodes: moderateRiskCount,
      safeNodes: safeCount,
      densityRatio,
      densityLevel,
      densityColor,
      densityBorderColor,
      densityFillOpacity,
      compromisedNodes,
      allNodes: assignedNodes,
      operationalMandate,
    };
  });
}
