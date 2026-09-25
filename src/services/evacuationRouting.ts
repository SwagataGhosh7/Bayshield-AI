import {
  EvacuationOrigin,
  EvacuationDestination,
  EvacuationRoute,
  RouteLeg,
  RouteHazard,
  RouteObjective,
} from '../types/cyclone';

// Predefined High-Exposure Evacuation Origins
export const EVACUATION_ORIGINS: EvacuationOrigin[] = [
  {
    id: 'origin-sagar',
    name: 'Sagar Island (Gangasagar)',
    region: 'South 24 Parganas, WB',
    lat: 21.642,
    lng: 88.082,
    populationAtRisk: 212000,
    meanElevationMeters: 1.4,
  },
  {
    id: 'origin-bakkhali',
    name: 'Bakkhali & Fraserganj Beach',
    region: 'South 24 Parganas, WB',
    lat: 21.564,
    lng: 88.261,
    populationAtRisk: 84000,
    meanElevationMeters: 1.1,
  },
  {
    id: 'origin-namkhana',
    name: 'Namkhana Riverhead',
    region: 'South 24 Parganas, WB',
    lat: 21.765,
    lng: 88.232,
    populationAtRisk: 145000,
    meanElevationMeters: 1.6,
  },
  {
    id: 'origin-gosaba',
    name: 'Gosaba / Sundarbans Delta',
    region: 'Sundarbans Biosphere, WB',
    lat: 22.164,
    lng: 88.805,
    populationAtRisk: 245000,
    meanElevationMeters: 1.3,
  },
  {
    id: 'origin-digha',
    name: 'Digha Coastal Promenade',
    region: 'Purba Medinipur, WB',
    lat: 21.628,
    lng: 87.512,
    populationAtRisk: 96000,
    meanElevationMeters: 2.3,
  },
  {
    id: 'origin-haldia',
    name: 'Haldia Industrial Port Zone',
    region: 'Purba Medinipur, WB',
    lat: 22.025,
    lng: 88.085,
    populationAtRisk: 178000,
    meanElevationMeters: 2.9,
  },
  {
    id: 'origin-dhamra',
    name: 'Dhamra Port & Estuary',
    region: 'Bhadrak District, Odisha',
    lat: 20.795,
    lng: 86.962,
    populationAtRisk: 110000,
    meanElevationMeters: 1.9,
  },
  {
    id: 'origin-sittwe',
    name: 'Sittwe Coastal Peninsula',
    region: 'Rakhine Coast, Myanmar',
    lat: 20.142,
    lng: 92.892,
    populationAtRisk: 165000,
    meanElevationMeters: 2.1,
  },
];

// Predefined Safe Inland Evacuation Hubs & Relief Shelters
export const EVACUATION_DESTINATIONS: EvacuationDestination[] = [
  {
    id: 'dest-dh-hub',
    name: 'Diamond Harbour Elevated Relief Hub',
    type: 'staging_base',
    lat: 22.195,
    lng: 88.205,
    capacity: 35000,
    currentOccupancy: 8400,
    elevationMeters: 4.8,
    distanceKmApprox: 45,
  },
  {
    id: 'dest-canning-shelter',
    name: 'Canning Central Cyclone Shelter Complex',
    type: 'shelter',
    lat: 22.312,
    lng: 88.658,
    capacity: 28000,
    currentOccupancy: 11200,
    elevationMeters: 4.2,
    distanceKmApprox: 38,
  },
  {
    id: 'dest-kolkata-depot',
    name: 'Kolkata Metropolitan Emergency Depot',
    type: 'staging_base',
    lat: 22.525,
    lng: 88.352,
    capacity: 85000,
    currentOccupancy: 14500,
    elevationMeters: 7.5,
    distanceKmApprox: 95,
  },
  {
    id: 'dest-kharagpur-base',
    name: 'Kharagpur Disaster Logistics Base',
    type: 'staging_base',
    lat: 22.335,
    lng: 87.325,
    capacity: 45000,
    currentOccupancy: 6200,
    elevationMeters: 12.0,
    distanceKmApprox: 82,
  },
  {
    id: 'dest-bhadrak-stadium',
    name: 'Bhadrak Elevated Municipal Base',
    type: 'staging_base',
    lat: 21.055,
    lng: 86.502,
    capacity: 32000,
    currentOccupancy: 5100,
    elevationMeters: 8.5,
    distanceKmApprox: 65,
  },
  {
    id: 'dest-cox-ridge',
    name: 'Cox’s Bazar Inland Ridge Shelter Complex',
    type: 'shelter',
    lat: 21.435,
    lng: 92.012,
    capacity: 40000,
    currentOccupancy: 9500,
    elevationMeters: 14.5,
    distanceKmApprox: 70,
  },
];

/**
 * Route leg coordinates generator for realistic corridors
 */
function interpolateWaypoints(
  start: [number, number],
  end: [number, number],
  midpoints: [number, number][] = []
): [number, number][] {
  return [start, ...midpoints, end];
}

/**
 * Automated Route Planning Engine
 * Computes Safest, Fastest, and Alternative routes based on dynamic surge depth,
 * road elevation, road closure thresholds, and traffic congestion models.
 */
export function calculateEvacuationRoutes(params: {
  originId: string;
  destinationId: string;
  totalWaterLevel: number;
  windSpeedKmh: number;
  objective?: RouteObjective;
}): {
  origin: EvacuationOrigin;
  destination: EvacuationDestination;
  routes: EvacuationRoute[];
  recommendedRouteId: string;
} {
  const { originId, destinationId, totalWaterLevel, windSpeedKmh, objective = 'safest' } = params;

  const origin =
    EVACUATION_ORIGINS.find((o) => o.id === originId) || EVACUATION_ORIGINS[0];
  const destination =
    EVACUATION_DESTINATIONS.find((d) => d.id === destinationId) || EVACUATION_DESTINATIONS[0];

  const routes: EvacuationRoute[] = [];

  // Approximate baseline distance between origin and destination
  const latDiff = destination.lat - origin.lat;
  const lngDiff = destination.lng - origin.lng;
  const directDistanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;

  // Congestion multiplier based on total water level (higher water = more mass panic & traffic choke)
  const baseCongestion = Math.max(1.1, Math.min(2.8, 1.0 + (totalWaterLevel / 4.0) * 1.2));

  // -------------------------------------------------------------
  // 1. SAFEST ROUTE: Prioritizes elevated national highways, bypasses low culverts
  // -------------------------------------------------------------
  const safestDistanceKm = Math.round(directDistanceKm * 1.35);
  // Route goes further inland where ground elevation is higher
  const inlandOffset = 0.08;
  const midLat1 = origin.lat + latDiff * 0.35;
  const midLng1 = origin.lng + lngDiff * 0.25 - inlandOffset;
  const midLat2 = origin.lat + latDiff * 0.75;
  const midLng2 = origin.lng + lngDiff * 0.7 - inlandOffset;

  const safestCoordinates: [number, number][] = [
    [origin.lat, origin.lng],
    [origin.lat + 0.04, origin.lng + 0.02],
    [midLat1, midLng1],
    [midLat1 + 0.08, midLng1 + 0.03],
    [midLat2, midLng2],
    [destination.lat - 0.03, destination.lng - 0.01],
    [destination.lat, destination.lng],
  ];

  const safestAvgElevation = 4.2;
  const safestFloodExposure = Math.max(0, Number((totalWaterLevel - safestAvgElevation).toFixed(2)));
  const safestCongestionFactor = Number((baseCongestion * 1.15).toFixed(2));
  const safestAvgSpeed = 52 / safestCongestionFactor;
  const safestMinutes = Math.round((safestDistanceKm / safestAvgSpeed) * 60);
  const safestScore = Math.max(75, Math.min(98, Math.round(96 - safestFloodExposure * 15)));

  const safestHazards: RouteHazard[] = [];
  if (safestFloodExposure > 0) {
    safestHazards.push({
      id: 'h-safe-1',
      type: 'flood_inundation',
      location: 'Low-Lying Approach Ramp (Km 14)',
      lat: midLat1,
      lng: midLng1,
      severity: safestFloodExposure > 0.3 ? 'high' : 'medium',
      description: `Water ponding up to +${safestFloodExposure}m during high astronomical tide.`,
      mitigationAdvice: 'High-clearance emergency transit buses prioritized.',
    });
  }
  if (safestCongestionFactor > 1.8) {
    safestHazards.push({
      id: 'h-safe-2',
      type: 'traffic_congestion',
      location: 'Highway Merge Chokepoint (Km 36)',
      lat: midLat2,
      lng: midLng2,
      severity: 'medium',
      description: 'Slow-moving convoy queue due to manual vehicle screening checkpoint.',
      mitigationAdvice: 'Activate two-lane contraflow evacuation protocol.',
    });
  }

  const safestRoute: EvacuationRoute = {
    id: 'route-safest',
    name: 'Safest Inland Ridge Expressway (NH High-Elevation Route)',
    type: 'safest',
    originName: origin.name,
    destinationName: destination.name,
    totalDistanceKm: safestDistanceKm,
    totalMinutes: safestMinutes,
    safetyScore: safestScore,
    maxSurgeExposureMeters: safestFloodExposure,
    averageElevationMeters: safestAvgElevation,
    congestionIndex: safestCongestionFactor > 2.0 ? 'heavy' : 'moderate',
    overallStatus: safestFloodExposure > 0.4 ? 'caution' : 'clear',
    coordinates: safestCoordinates,
    recommendedVehicleTypes: [
      'Heavy Evacuation Buses',
      'Civil Defense Convoys',
      'Civilian Light Vehicles',
      'Ambulances',
    ],
    legs: [
      {
        fromName: `${origin.name} Access`,
        toName: 'Inland State Highway Feeder',
        highwayNumber: 'SH Arterial',
        distanceKm: Math.round(safestDistanceKm * 0.3),
        estimatedMinutes: Math.round(safestMinutes * 0.32),
        roadElevationMeters: 3.2,
        currentFloodDepthMeters: Math.max(0, Number((totalWaterLevel - 3.2).toFixed(2))),
        congestionFactor: safestCongestionFactor,
        passability: totalWaterLevel > 3.6 ? 'caution' : 'open',
        coordinates: safestCoordinates.slice(0, 3),
      },
      {
        fromName: 'Inland State Highway Feeder',
        toName: 'National Highway Elevated Expressway',
        highwayNumber: 'NH-117/116 Main',
        distanceKm: Math.round(safestDistanceKm * 0.45),
        estimatedMinutes: Math.round(safestMinutes * 0.42),
        roadElevationMeters: 4.8,
        currentFloodDepthMeters: 0,
        congestionFactor: safestCongestionFactor * 1.1,
        passability: 'open',
        coordinates: safestCoordinates.slice(2, 5),
      },
      {
        fromName: 'National Highway Elevated Expressway',
        toName: destination.name,
        highwayNumber: 'Municipal Relief Corridor',
        distanceKm: Math.round(safestDistanceKm * 0.25),
        estimatedMinutes: Math.round(safestMinutes * 0.26),
        roadElevationMeters: 4.5,
        currentFloodDepthMeters: 0,
        congestionFactor: safestCongestionFactor * 0.9,
        passability: 'open',
        coordinates: safestCoordinates.slice(4),
      },
    ],
    hazards: safestHazards,
  };
  routes.push(safestRoute);

  // -------------------------------------------------------------
  // 2. FASTEST ROUTE: Most direct corridor, shorter distance, higher speed
  // -------------------------------------------------------------
  const fastestDistanceKm = Math.round(directDistanceKm * 1.12);
  const fMidLat1 = origin.lat + latDiff * 0.45;
  const fMidLng1 = origin.lng + lngDiff * 0.48;

  const fastestCoordinates: [number, number][] = [
    [origin.lat, origin.lng],
    [origin.lat + 0.06, origin.lng + 0.05],
    [fMidLat1, fMidLng1],
    [destination.lat - 0.05, destination.lng - 0.02],
    [destination.lat, destination.lng],
  ];

  // Faster route stays closer to the coast/river valley, meaning lower elevation
  const fastestAvgElevation = 2.4;
  const fastestFloodExposure = Math.max(0, Number((totalWaterLevel - fastestAvgElevation).toFixed(2)));
  const fastestCongestionFactor = Number((baseCongestion * 1.45).toFixed(2));
  const fastestAvgSpeed = 65 / fastestCongestionFactor;
  const fastestMinutes = Math.round((fastestDistanceKm / fastestAvgSpeed) * 60);
  const fastestScore = Math.max(45, Math.min(88, Math.round(88 - fastestFloodExposure * 28)));

  const fastestHazards: RouteHazard[] = [];
  if (fastestFloodExposure > 0.15) {
    fastestHazards.push({
      id: 'h-fast-1',
      type: 'flood_inundation',
      location: 'Estuary Low-Culvert Crossing (Km 22)',
      lat: fMidLat1,
      lng: fMidLng1,
      severity: fastestFloodExposure > 0.5 ? 'critical' : 'high',
      description: `Active surge runup submerging road by +${fastestFloodExposure}m. Low sedan clearance exceeded.`,
      mitigationAdvice: 'Restricted to 4WD military and high-axle disaster trucks only.',
    });
  }
  fastestHazards.push({
    id: 'h-fast-2',
    type: 'traffic_congestion',
    location: 'Coastal Bridge Toll Barrier',
    lat: fMidLat1 - 0.02,
    lng: fMidLng1 - 0.01,
    severity: 'high',
    description: 'Heavy bottleneck: 3.2km queue moving at 12 km/h due to bridge gale wind restrictions.',
    mitigationAdvice: 'Disable toll gates; waive manual ticketing for rapid throughput.',
  });

  const fastestRoute: EvacuationRoute = {
    id: 'route-fastest',
    name: 'Direct Arterial Coastal Highway (Fastest Transit)',
    type: 'fastest',
    originName: origin.name,
    destinationName: destination.name,
    totalDistanceKm: fastestDistanceKm,
    totalMinutes: fastestMinutes,
    safetyScore: fastestScore,
    maxSurgeExposureMeters: fastestFloodExposure,
    averageElevationMeters: fastestAvgElevation,
    congestionIndex: fastestCongestionFactor > 2.4 ? 'gridlock' : 'heavy',
    overallStatus: fastestFloodExposure > 0.5 ? 'high_risk' : fastestFloodExposure > 0.2 ? 'caution' : 'clear',
    coordinates: fastestCoordinates,
    recommendedVehicleTypes: [
      'High-Clearance 4WD Only',
      'NDRF Heavy Rescue Trucks',
      'Emergency Convoys',
    ],
    legs: [
      {
        fromName: `${origin.name} Hub`,
        toName: 'River Delta Causeway',
        highwayNumber: 'Coastal Expressway Link',
        distanceKm: Math.round(fastestDistanceKm * 0.4),
        estimatedMinutes: Math.round(fastestMinutes * 0.42),
        roadElevationMeters: 2.1,
        currentFloodDepthMeters: Math.max(0, Number((totalWaterLevel - 2.1).toFixed(2))),
        congestionFactor: fastestCongestionFactor,
        passability: totalWaterLevel > 2.5 ? 'caution' : 'open',
        coordinates: fastestCoordinates.slice(0, 3),
      },
      {
        fromName: 'River Delta Causeway',
        toName: destination.name,
        highwayNumber: 'NH Direct Spur',
        distanceKm: Math.round(fastestDistanceKm * 0.6),
        estimatedMinutes: Math.round(fastestMinutes * 0.58),
        roadElevationMeters: 2.9,
        currentFloodDepthMeters: Math.max(0, Number((totalWaterLevel - 2.9).toFixed(2))),
        congestionFactor: fastestCongestionFactor * 1.1,
        passability: totalWaterLevel > 3.3 ? 'caution' : 'open',
        coordinates: fastestCoordinates.slice(2),
      },
    ],
    hazards: fastestHazards,
  };
  routes.push(fastestRoute);

  // -------------------------------------------------------------
  // 3. ALTERNATIVE BYPASS ROUTE: Western/Eastern circumferential ring
  // -------------------------------------------------------------
  const altDistanceKm = Math.round(directDistanceKm * 1.52);
  const altMidLat1 = origin.lat + latDiff * 0.25;
  const altMidLng1 = origin.lng + lngDiff * 0.15 - 0.15;
  const altMidLat2 = origin.lat + latDiff * 0.65;
  const altMidLng2 = origin.lng + lngDiff * 0.55 - 0.14;

  const altCoordinates: [number, number][] = [
    [origin.lat, origin.lng],
    [altMidLat1, altMidLng1],
    [altMidLat2, altMidLng2],
    [destination.lat + 0.02, destination.lng - 0.05],
    [destination.lat, destination.lng],
  ];

  const altAvgElevation = 5.6;
  const altFloodExposure = 0.0;
  const altCongestionFactor = Number((baseCongestion * 0.85).toFixed(2));
  const altAvgSpeed = 48 / altCongestionFactor;
  const altMinutes = Math.round((altDistanceKm / altAvgSpeed) * 60);
  const altScore = 94;

  const altRoute: EvacuationRoute = {
    id: 'route-alternative',
    name: 'Western Outer Circumferential Bypass (Zero-Flood Contingency)',
    type: 'alternative',
    originName: origin.name,
    destinationName: destination.name,
    totalDistanceKm: altDistanceKm,
    totalMinutes: altMinutes,
    safetyScore: altScore,
    maxSurgeExposureMeters: altFloodExposure,
    averageElevationMeters: altAvgElevation,
    congestionIndex: 'low',
    overallStatus: 'clear',
    coordinates: altCoordinates,
    recommendedVehicleTypes: [
      'All Vehicles',
      'Two-Wheelers & Three-Wheelers',
      'Commercial Freight Trucks',
      'School Evacuation Buses',
    ],
    legs: [
      {
        fromName: `${origin.name}`,
        toName: 'Outer District Ring Road',
        highwayNumber: 'MDR-22',
        distanceKm: Math.round(altDistanceKm * 0.5),
        estimatedMinutes: Math.round(altMinutes * 0.5),
        roadElevationMeters: 5.2,
        currentFloodDepthMeters: 0,
        congestionFactor: altCongestionFactor,
        passability: 'open',
        coordinates: altCoordinates.slice(0, 3),
      },
      {
        fromName: 'Outer District Ring Road',
        toName: destination.name,
        highwayNumber: 'State Expressway Bypass',
        distanceKm: Math.round(altDistanceKm * 0.5),
        estimatedMinutes: Math.round(altMinutes * 0.5),
        roadElevationMeters: 6.0,
        currentFloodDepthMeters: 0,
        congestionFactor: altCongestionFactor,
        passability: 'open',
        coordinates: altCoordinates.slice(2),
      },
    ],
    hazards: [
      {
        id: 'h-alt-1',
        type: 'bridge_closure',
        location: 'Old Irrigation Canal Siphon',
        lat: altMidLat1,
        lng: altMidLng1,
        severity: 'low',
        description: 'Single-lane alternate passage over old masonry arch bridge.',
        mitigationAdvice: 'Police traffic marshals on-site enforcing alternating 5-minute passes.',
      },
    ],
  };
  routes.push(altRoute);

  // Determine recommended route based on objective
  let recommendedRouteId = safestRoute.id;
  if (objective === 'fastest') {
    // If fastest is flooded >0.4m, safety override forces safest
    if (fastestFloodExposure > 0.4) {
      recommendedRouteId = safestRoute.id;
    } else {
      recommendedRouteId = fastestRoute.id;
    }
  } else if (objective === 'balanced') {
    recommendedRouteId = safestRoute.id;
  }

  return {
    origin,
    destination,
    routes,
    recommendedRouteId,
  };
}
