import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Shared Google GenAI client utility with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint: AI Predictive Vulnerability & Infrastructure Risk Assessment
app.post('/api/gemini/analyze-vulnerability', async (req: Request, res: Response) => {
  try {
    const { cyclone, infrastructureStats, selectedTimeOffset, customScenario } = req.body;

    const prompt = `
You are the Chief Disaster Response & Predictive Risk Scientist for the Bay of Bengal & Coastal APAC Cyclone Command Center.
Analyze the following meteorological, satellite, and infrastructure vulnerability data:

Cyclone Name: ${cyclone?.name || 'Tropical Cyclone'}
Category: ${cyclone?.category || 'Category 3 Severe Cyclonic Storm'}
Max Sustained Wind: ${cyclone?.windSpeed || 150} km/h (Gusts: ${(cyclone?.windSpeed || 150) * 1.25} km/h)
Central Pressure: ${cyclone?.centralPressure || 960} hPa
Forward Translation Speed: ${cyclone?.forwardSpeed || 18} km/h
Landfall Target: ${cyclone?.landfallTarget || 'Gangetic Delta / Sundarbans Coast'}
Tidal Phase at Landfall: ${cyclone?.tidalPhase || 'Astronomical Spring High Tide (+1.8m)'}
Peak Predicted Storm Surge: ${cyclone?.peakSurge || 4.2} meters
Mangrove Attenuation Zone: ${cyclone?.mangroveBuffer ? 'Sundarbans Active (-0.8m damping)' : 'Low/Degraded (negligible damping)'}
Timeline Offset: ${selectedTimeOffset !== undefined ? selectedTimeOffset + 'h relative to landfall' : 'T-0 Landfall'}

Infrastructure Exposure Summary:
- Power Substations in Inundation Zone (>1.5m surge): ${infrastructureStats?.exposedSubstations || 6}
- Arterial Highway & Embankment Breaches: ${infrastructureStats?.cutOffRoads || 4} sections
- Medical Shelters Near Capacity / Flood Level: ${infrastructureStats?.vulnerableShelters || 3}
- Population in Direct Inundation Zone: ${infrastructureStats?.exposedPopulation || '185,000'} residents
- Parametric Insurance Trigger: ${cyclone?.windSpeed >= 120 && (cyclone?.peakSurge || 0) >= 2.5 ? 'TRIGGERED (Pre-landfall liquidity payout eligible)' : 'Monitoring'}

Provide a rigorous, operationally decisive anticipatory action report formatted in structured JSON with the following keys:
{
  "executiveSummary": "Concise 2-3 sentence strategic threat brief",
  "stormSurgeRiskLevel": "CRITICAL" | "HIGH" | "MODERATE",
  "inundationPathways": ["pathway 1", "pathway 2", "pathway 3"],
  "infrastructureActionPlan": {
    "powerGrid": "Specific de-energization timing, transformer protection, and backup diesel protocols",
    "arterialRoads": "Evacuation corridor maintenance, bridge closures, and earth-moving prepositioning",
    "medicalShelters": "Vertical evacuation, oxygen supply security, and cold-chain vaccine protection"
  },
  "parametricInsuranceLiquidity": {
    "triggerStatus": "ACTIVATED" | "PENDING",
    "recommendedImmediateDisbursementUSD": number,
    "utilizationDirectives": ["directive 1", "directive 2"]
  },
  "anticipatoryEvacuationPriorities": [
    {"zone": "string", "targetPopulation": number, "criticalDeadlineHours": number, "primaryHazard": "string"}
  ],
  "geeRemoteSensingObservations": "Key satellite observations regarding SAR backscatter flood mapping and sea surface temperature (SST) feedback"
}
`;

    if (!process.env.GEMINI_API_KEY) {
      // Fallback deterministic assessment if key is not configured in local environment
      return res.json({
        fallback: true,
        data: {
          executiveSummary: `Severe storm surge inundation threat modeled for ${cyclone?.name || 'Cyclone'} with peak water levels reaching ${cyclone?.peakSurge || 4.2}m during ${cyclone?.tidalPhase || 'Spring High Tide'}. Anticipatory de-energization and road diversion are mandatory within 6 hours.`,
          stormSurgeRiskLevel: "CRITICAL",
          inundationPathways: [
            "Hooghly & Matla river estuary backwater choking resulting in 2.8m tidal push inland",
            "Low-lying coastal polders in Sagar Island and Kakdwip experiencing direct embankment overtopping",
            "Arterial culvert washout along State Highway 1 connecting Kakdwip to Diamond Harbour"
          ],
          infrastructureActionPlan: {
            powerGrid: "De-energize 33kV coastal substations 3 hours prior to sustained 80 km/h wind threshold to prevent catastrophic transformer explosions and electrocution hazards.",
            arterialRoads: "Close low-lying causeways along NH-117; deploy heavy earth-moving equipment and sandbag crews to km 42 breach point.",
            medicalShelters: "Relocate ground-floor emergency clinics to Level 2 in designated multipurpose cyclone shelters; verify 72-hour generator fuel reserves."
          },
          parametricInsuranceLiquidity: {
            triggerStatus: "ACTIVATED",
            recommendedImmediateDisbursementUSD: 14500000,
            utilizationDirectives: [
              "Immediate cash transfer to municipal block officers for community kitchens and potable water tankers",
              "Pre-positioning fuel reserves for emergency diesel pumps and heavy excavators",
              "Emergency ex-gratia advance for low-income artisanal fishermen and smallholder farmers"
            ]
          },
          anticipatoryEvacuationPriorities: [
            { zone: "Sagar Island Southern Tip", targetPopulation: 42000, criticalDeadlineHours: 6, primaryHazard: "Unprotected storm surge wall overtopping" },
            { zone: "Namkhana & Bakkhali Coast", targetPopulation: 38000, criticalDeadlineHours: 8, primaryHazard: "High wind exposure and kutchha roof destructuring" },
            { zone: "Gosaba Mangrove Periphery", targetPopulation: 29000, criticalDeadlineHours: 10, primaryHazard: "Estuary back-flooding and saline water intrusion" }
          ],
          geeRemoteSensingObservations: "Sentinel-1 SAR simulation indicates high coastal soil moisture saturation (>88%), drastically compounding inland rainfall runoff and impeding water drainage into the Bay."
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in analyze-vulnerability:', error);
    // Graceful fallback to guarantee smooth incident response UI
    return res.status(200).json({
      fallback: true,
      error: error.message,
      data: {
        executiveSummary: "Anticipatory modeling indicates critical storm surge inundation threat. Urgent evacuation of zone 1 coastal settlements and selective power grid isolation recommended.",
        stormSurgeRiskLevel: "HIGH",
        inundationPathways: [
          "Primary storm tide surge pushing through river mouths",
          "Backwater inundation along unprotected delta embankments",
          "Saline waterlogging in agricultural lowlands"
        ],
        infrastructureActionPlan: {
          powerGrid: "Execute phased de-energization of vulnerable feeders; inspect emergency generator hookups at medical shelters.",
          arterialRoads: "Clear designated green corridor routes for NDRF convoy movements.",
          medicalShelters: "Elevate critical medical supplies above 2.5m mark; test backup satellite communications."
        },
        parametricInsuranceLiquidity: {
          triggerStatus: "ACTIVATED",
          recommendedImmediateDisbursementUSD: 12000000,
          utilizationDirectives: ["Evacuation fuel reserves", "Community shelter logistics"]
        },
        anticipatoryEvacuationPriorities: [
          { zone: "Coastal Strip Sector A", targetPopulation: 35000, criticalDeadlineHours: 6, primaryHazard: "Direct storm surge" }
        ],
        geeRemoteSensingObservations: "Multi-sensor satellite radar indicates elevated soil saturation compounding runoff."
      }
    });
  }
});

// Endpoint: Multi-Lingual Early Warning Common Alerting Protocol (CAP) & Municipal Dispatches
app.post('/api/gemini/generate-advisories', async (req: Request, res: Response) => {
  try {
    const { cyclone, language = 'English', recipientRole = 'District Magistrate & NDRF', infrastructure = [], customThresholdBreaches = [] } = req.body;

    const infraSummary = Array.isArray(infrastructure) && infrastructure.length > 0
      ? infrastructure.map((n: any) => `- ${n.name} (${n.type}): Ground Elev ${n.elevationMeters}m, Crit Height ${n.floodCriticalHeightMeters}m, Dist ${n.district}`).join('\n')
      : 'No granular node list provided; evaluate general Bay of Bengal littoral grid substations, coastal hospitals, and arterial causeways.';

    const breachSummary = Array.isArray(customThresholdBreaches) && customThresholdBreaches.length > 0
      ? `CRITICAL RISK THRESHOLD BREACHES DEFINED BY EMERGENCY COMMANDER:\n` +
        customThresholdBreaches.map((b: any) => `⚠️ [${b.priorityLevel || 'CRITICAL'}] ${b.nodeName} (${(b.category || 'asset').toUpperCase()}): ${b.breachReasons?.join('; ')} | Directive: ${b.operationalDirective}`).join('\n')
      : 'No custom threshold breach overrides submitted.';

    const prompt = `
You are the Incident Commander for the National Disaster Management Authority (NDMA) coordinating cyclone emergency response in the Bay of Bengal.
Generate an official Early Warning Advisory and Common Alerting Protocol (CAP v1.2) broadcast.

Target Recipient: ${recipientRole}
Language requested: ${language}
Cyclone Name: ${cyclone?.name || 'Tropical Cyclone'}
Intensity: Sustained winds of ${cyclone?.windSpeed || 150} km/h with gusts to ${(cyclone?.windSpeed || 150) * 1.25} km/h
Predicted Surge: ${cyclone?.peakSurge || 4.2}m above astronomical tide
Landfall Timing: ${cyclone?.landfallETA || 'Within 18 hours'}
Impact Area: ${cyclone?.landfallTarget || 'Coastal Coastal Districts'}

Infrastructure Assets to Evaluate:
${infraSummary}

${breachSummary}

Evaluate which infrastructure assets are at HIGH or CRITICAL risk (where predicted water level ${cyclone?.peakSurge || 4.2}m exceeds asset elevation, causes structural disruption, or breaches user-defined safety thresholds).
Ensure the operational directives specifically address any breached critical assets above.
Provide the response in structured JSON with the following format:
{
  "bulletinNumber": "NDMA/EWS/2026/CYC-09",
  "urgency": "IMMEDIATE",
  "severity": "EXTREME",
  "headline": "A concise, hard-hitting emergency warning headline",
  "broadcastContent": "The full operational dispatch in ${language}, clear, authoritative, specifying mandatory evacuation cutoffs, shelter locations, and emergency helpline numbers",
  "actionDirectives": [
    "Immediate directive 1",
    "Immediate directive 2",
    "Immediate directive 3",
    "Immediate directive 4"
  ],
  "highRiskInfrastructure": [
    {
      "id": "node-id",
      "name": "Node name",
      "type": "substation" | "road" | "shelter" | "hospital" | "port" | "water_plant",
      "riskScore": 88,
      "threatSummary": "Specific failure mechanism (e.g. Surge inundation +1.4m overtopping switchyard plinth)",
      "recommendedAction": "Immediate operational order (e.g. Pre-emptive sectional load de-energization)"
    }
  ],
  "capXmlSnippet": "<!-- Valid Common Alerting Protocol (CAP v1.2) XML representation -->",
  "publicSmsText": "Short 150-character SMS emergency alert suitable for broadcast cell-towers"
}
`;

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        fallback: true,
        data: {
          bulletinNumber: "NDMA/EWS/2026/CYC-09",
          urgency: "IMMEDIATE",
          severity: "EXTREME",
          headline: `EXTREME DANGER WARNING: ${cyclone?.name || 'Cyclone'} Landfall Imminent - Evacuate Low-Lying Coastal Zones`,
          broadcastContent: `OFFICIAL RED ALERT: All residents within 5 km of the coastline and tidal river banks must immediately evacuate to designated multi-purpose cyclone shelters. Sustained hurricane-force winds of ${cyclone?.windSpeed || 150} km/h and a catastrophic storm surge of up to ${cyclone?.peakSurge || 4.2}m will breach coastal embankments. Power utilities will shut down electrical grids at 18:00 hrs. Keep emergency battery radios tuned. Emergency Helpline: 1070 / 112.`,
          actionDirectives: [
            "Complete mandatory zero-casualty evacuation of kutcha/thatched households before T-6h.",
            "De-energize 33kV and 11kV electrical distribution lines in inundated sectors.",
            "Preposition NDRF boat teams and road-clearing chain-saw units at Block headquarters.",
            "Verify backup diesel generator fuel and potable water chlorination tablets at all medical relief centers."
          ],
          highRiskInfrastructure: [
            {
              id: "infra-sub-01",
              name: "Kakdwip 132/33kV Grid Substation",
              type: "substation",
              riskScore: 92,
              threatSummary: `Modeled storm surge (${cyclone?.peakSurge || 4.2}m) overtops substation ground elevation (1.8m) by +${((cyclone?.peakSurge || 4.2) - 1.8).toFixed(1)}m, risking catastrophic switchyard explosion.`,
              recommendedAction: "Mandatory de-energization of 33kV bay feeders 3 hours prior to sustained gale threshold."
            },
            {
              id: "infra-hosp-01",
              name: "Kakdwip Sub-Divisional Hospital",
              type: "hospital",
              riskScore: 84,
              threatSummary: "Ground-floor emergency ward and diesel generator room prone to 0.7m saline backwater ingress.",
              recommendedAction: "Evacuate non-ambulatory patients vertically to 2nd floor; deploy sandbag cofferdam around auxiliary generator."
            },
            {
              id: "infra-road-02",
              name: "Bakkhali Coastal Highway (SH-1 Causeway)",
              type: "road",
              riskScore: 95,
              threatSummary: "Direct wave impact overtopping culverts with 1.5m scouring; impassable to civilian transport.",
              recommendedAction: "Total traffic closure; deploy NDRF multi-axle amphibious trucks for evacuation convoys."
            }
          ],
          capXmlSnippet: `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>NDMA-${Date.now()}</identifier><sender>alerts@ndma.gov</sender><status>Actual</status><msgType>Alert</msgType><scope>Public</scope><info><category>Met</category><event>Cyclone Storm Surge</event><urgency>Immediate</urgency><severity>Extreme</severity><headline>${cyclone?.name || 'Cyclone'} Landfall Red Alert</headline></info></alert>`,
          publicSmsText: `EMERGENCY ALERT: Cyclone ${cyclone?.name || 'Alert'}. Landfall in 18h with ${cyclone?.windSpeed || 150}km/h winds & ${cyclone?.peakSurge || 4.2}m surge. Evacuate to nearest shelter NOW. Call 1070.`
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in generate-advisories:', error);
    return res.status(200).json({
      fallback: true,
      data: {
        bulletinNumber: "NDMA/EWS/2026/CYC-09",
        urgency: "IMMEDIATE",
        severity: "EXTREME",
        headline: "EMERGENCY CYCLONE ADVISORY",
        broadcastContent: "Immediate precautionary evacuation required for coastal lowlands. Shelter stations activated. Follow official directives.",
        actionDirectives: ["Activate emergency shelters", "Pre-position relief materials"],
        highRiskInfrastructure: [
          {
            id: "infra-sub-01",
            name: "Kakdwip 132/33kV Grid Substation",
            type: "substation",
            riskScore: 88,
            threatSummary: "Surge overtopping risk to 33kV switchyard plinth.",
            recommendedAction: "Execute phased de-energization."
          }
        ],
        publicSmsText: "ALERT: Cyclone warning. Evacuate low-lying areas immediately. Call 1070."
      }
    });
  }
});

// Endpoint: Emergency Voice Broadcast TTS generation using gemini-3.8-flash-lite-tts
app.post('/api/gemini/tts-broadcast', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Zephyr' } = req.body;
    const cleanText = (text || 'Emergency Cyclone Warning. Please evacuate to the designated shelters immediately.').slice(0, 300);

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ fallback: true, message: 'Audio synthesis requires configured GEMINI_API_KEY. Web Speech API fallback available on client.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style: 'Authoritative, calm, and urgent emergency disaster response commander',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || 'Zephyr' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({ success: true, audioData: base64Audio });
    } else {
      return res.json({ fallback: true, message: 'No audio part returned' });
    }
  } catch (error: any) {
    console.error('Error in tts-broadcast:', error);
    return res.status(200).json({ fallback: true, error: error.message });
  }
});

// Endpoint: AI Comprehensive Impact Assessment Report using gemini-3.8-flash
app.post('/api/gemini/generate-impact-summary', async (req: Request, res: Response) => {
  try {
    const {
      scenario,
      surgeMetrics,
      vulnerableInfrastructure = [],
      timeOffset = 0,
      mangroveOverride = true,
      focusMode = 'comprehensive',
    } = req.body;

    const infraText = Array.isArray(vulnerableInfrastructure) && vulnerableInfrastructure.length > 0
      ? vulnerableInfrastructure.map((n: any) => `- ${n.name} (${(n.type || 'asset').toUpperCase()}): Ground Elev ${n.elevationMeters}m | Flood Depth: +${(n.floodDepthMeters || 0).toFixed(1)}m | Status: ${(n.status || 'normal').toUpperCase()} | Risk: ${n.riskScore || 0}% | Action: ${n.recommendedAction || 'Monitor'}`).join('\n')
      : 'No critical assets exceed direct inundation thresholds under current hydrodynamic parameters.';

    const prompt = `
You are the Senior Disaster Impact Analyst and Hydrodynamic Risk Modeler for the Bay of Bengal & Coastal APAC Cyclone Emergency Directorate.
Generate an authoritative, text-based, human-readable Impact Assessment Report for state emergency operations centers, humanitarian coordinators, and public utility engineers.

SCENARIO TELEMETRY:
- Cyclone Name: ${scenario?.name || 'Tropical Cyclone'} (${scenario?.category || 'Severe Storm'})
- Central Pressure: ${scenario?.centralPressure || 960} hPa
- Sustained Winds: ${scenario?.windSpeed || 150} km/h (Peak Gusts: ${Math.round((scenario?.windSpeed || 150) * 1.25)} km/h)
- Forward Translation Speed: ${scenario?.forwardSpeed || 16} km/h
- Landfall Target: ${scenario?.landfallTarget || 'Coastal Belt'}
- Landfall Timing: ${scenario?.landfallETA || 'Within 18 hours'}
- Simulation Timeline Offset: ${timeOffset >= 0 ? `+${timeOffset}h` : `${timeOffset}h`} relative to landfall (T=0)
- Bioshield Barrier: ${mangroveOverride ? 'Sundarbans Mangrove Bioshield Active (-0.85m wave damping)' : 'Mangrove Buffer Degraded / Low Damping'}

CURRENT HYDRODYNAMIC SURGE METRICS:
- Total Water Level (TWL): ${surgeMetrics?.totalWaterLevelMeters || 4.2} meters
- Pure Storm Surge: ${surgeMetrics?.pureSurgeMeters || 3.1} meters
- Astronomical Tide Superposition: ${surgeMetrics?.astronomicalTideMeters || 1.1} meters
- Inverse Barometer Setup: ${surgeMetrics?.inverseBarometerMeters || 0.55} meters
- Wind Setup (Shallow Continental Shelf): ${surgeMetrics?.windSetupMeters || 1.95} meters
- Modeled Inundation Footprint: ${surgeMetrics?.inundationAreaSqKm || 450} sq km
- Population in Direct Inundation Zone: ${(surgeMetrics?.populationAtRisk || 120000).toLocaleString()} residents

VULNERABLE INFRASTRUCTURE ASSETS:
${infraText}

FOCUS MODE: ${focusMode} (e.g. comprehensive operational brief)

Write a detailed, structured, highly readable operational document in Markdown format with the following sections:
# 🚨 EXECUTIVE IMPACT ASSESSMENT: ${scenario?.name || 'Cyclone'}
Include threat level classification, peak risk window, and top-line strategic danger.

## 🌊 1. HYDRODYNAMIC & SURGE HAZARD DYNAMICS
Detail how barometric depression and shallow-shelf wind setup combine with astronomical tide, river mouth backwater funneling, and polder embankment overtopping.

## ⚡ 2. CRITICAL INFRASTRUCTURE DAMAGE & FAILURE THRESHOLDS
Detail specific destruction risks for:
- Electrical Grid & Substations (switchyard plinth overtopping, transformer fire hazards, de-energization timing)
- Arterial Causeways & Roads (culvert blowouts, scouring, emergency convoy impassability)
- Medical Relief Centers & Shelters (cold-chain vaccine preservation, vertical evacuation, auxiliary generator backup)
- Ports & Marine Anchorages

## 👥 3. POPULATION EXPOSURE & COMMUNITY ISOLATION RISK
Analyze the ${(surgeMetrics?.populationAtRisk || 120000).toLocaleString()} residents at risk, isolated polder islands, potable water saline contamination, and vulnerable thatched settlements.

## 🛡️ 4. SECTORAL CONTINGENCY DIRECTIVES
Provide clear bulleted operational orders for:
- State Electricity Transmission Utilities
- Public Works Department (PWD) Highway Engineers
- Chief District Medical Officers
- National Disaster Response Force (NDRF) & Coast Guard

## ⏱️ 5. TIME-CRITICAL OPERATIONAL DECISION WINDOWS
Breakdown mandatory milestones for:
- **T-12h to T-6h**: Mandatory evacuation completion & switchyard prep
- **T-6h to T-0h (Landfall)**: Total bridge/causeway lockdown & de-energization
- **T+0h to T+12h**: Emergency de-watering, search & rescue, restoration

Write the report in a direct, professional, authoritative, and human-readable style without robotic boilerplate.
`;

    if (!process.env.GEMINI_API_KEY) {
      // Deterministic calibrated fallback report
      const twl = surgeMetrics?.totalWaterLevelMeters || 4.2;
      const popRisk = (surgeMetrics?.populationAtRisk || 120000).toLocaleString();
      const inunArea = surgeMetrics?.inundationAreaSqKm || 450;
      const windKmh = scenario?.windSpeed || 150;
      const cName = scenario?.name || 'Tropical Cyclone';
      const target = scenario?.landfallTarget || 'Coastal Lowlands';

      const fallbackReport = `# 🚨 EXECUTIVE IMPACT ASSESSMENT: ${cName}

**OPERATIONAL CLASSIFICATION: CATEGORY RED — SEVERE SURGE INUNDATION & STRUCTURAL BREACH**
*Dispatched by Coastal Emergency Operations Command Cell*

${cName} is tracking toward **${target}** with sustained core winds of **${windKmh} km/h** (gusts to **${Math.round(windKmh * 1.25)} km/h**). Real-time hydrodynamic modeling calculates a Total Water Level (**TWL**) of **${twl}m** above chart datum at current timeline offset (${timeOffset >= 0 ? `+${timeOffset}h` : `${timeOffset}h`}). Over **${popRisk} residents** across **${inunArea} sq km** of coastal floodplains face severe salt-water inundation and physical disruption.

---

## 🌊 1. HYDRODYNAMIC & SURGE HAZARD DYNAMICS
- **Astronomical Superposition:** Peak storm surge (+${(surgeMetrics?.pureSurgeMeters || 3.1)}m) is coinciding with high astronomical tides (+${(surgeMetrics?.astronomicalTideMeters || 1.1)}m), producing catastrophic overtopping along low-elevation earthen polders.
- **Estuary Funneling:** Deltaic channel geometry along the Hooghly, Matla, and Dhamra river mouths causes severe backwater choking, projecting high saline water levels up to 35 km upstream.
- **Mangrove Buffer Attenuation:** ${mangroveOverride ? 'Active Sundarbans bioshield reduces kinetic wave run-up by ~0.85m in inner estuaries, but outer unprotected seawalls will experience structural failure.' : 'Low bioshield protection drastically increases shoreline erosion and rapid polder wall collapse.'}

---

## ⚡ 2. CRITICAL INFRASTRUCTURE DAMAGE & FAILURE THRESHOLDS
- **Power Grid & Substations:** Switchyards with ground elevations below ${twl}m face direct water contact over electrical busbars. Controlled sectional de-energization must be finalized to prevent terminal flashovers and multi-week transformer burnouts.
- **Arterial Highway Causeways:** Low-lying state highways and causeways suffer culvert overtopping and roadbed scouring, severing primary vehicular evacuation lifelines.
- **Medical Centers & Emergency Shelters:** Ground floors in frontline health clinics risk 0.5m - 1.2m water ingress. Auxiliary diesel fuel drums and cold-chain vaccine freezers must be relocated immediately to Level 2.
- **Marine Ports & Anchorages:** Heavy sea swell prevents tug operations; all cargo berths require double-mooring and gantry crane tie-downs.

---

## 👥 3. POPULATION EXPOSURE & COMMUNITY ISOLATION RISK
- **${popRisk} Citizens at Risk:** High-density mud-and-thatch (kutchha) dwellings located seaward of primary embankments will experience 100% structural destabilization.
- **Saline Ingress & Drinking Water:** Over 350 freshwater community ponds risk saltwater contamination, requiring immediate distribution of halogen water purification tablets and mobile filtration trailers.
- **Polder Island Choking:** Island blocks (such as Ghoramara, Gosaba, and Sagar South) will become completely isolated by water transit within 4 hours.

---

## 🛡️ 4. SECTORAL CONTINGENCY DIRECTIVES
- **Power Transmission Authority:** Execute mandatory trip sequence on all 33kV and 11kV coastal distribution lines 3 hours before sustained 80 km/h winds arrive.
- **PWD Highway Directorate:** Pre-position JCB excavators, sandbag reserves, and amphibious tree-clearing squads at Block nodal hubs. Close inundated causeways to civilian traffic.
- **Public Health Authorities:** Transition hospital triage to 2nd floors; activate satellite telemetry and inspect hospital rooftop generator fuel supply.
- **Disaster Response Forces (NDRF / SDRF):** Deploy motorized inflatable rescue boats (IRBs) to designated high-ground assembly points for post-landfall medical evacuations.

---

## ⏱️ 5. TIME-CRITICAL OPERATIONAL DECISION WINDOWS
| Time Window | Operational Milestone | Tactical Action |
| :--- | :--- | :--- |
| **T-12h to T-6h** | Pre-Landfall Evacuation Window | Zero-casualty relocation of vulnerable households to multipurpose shelters |
| **T-6h to T-0h** | Lockdown & De-energization | Complete 33kV switchyard isolation; total vehicular road closure on causeways |
| **T+0h to T+12h** | Landfall & Inundation Peak | Strictly shelter-in-place; continuous radio emergency helpline monitoring |
| **T+12h to T+24h** | Emergency Relief & Dewatering | Clear arterial corridors; deploy water purification and medical rescue convoys |
`;

      return res.json({
        success: true,
        fallback: true,
        data: {
          reportMarkdown: fallbackReport,
          generatedAt: new Date().toISOString(),
          modelUsed: 'deterministic-fallback',
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const reportMarkdown = response.text || '';
    return res.json({
      success: true,
      data: {
        reportMarkdown,
        generatedAt: new Date().toISOString(),
        modelUsed: 'gemini-3.8-flash',
      },
    });
  } catch (error: any) {
    console.error('Error in generate-impact-summary:', error);
    return res.status(200).json({
      fallback: true,
      error: error.message,
      data: {
        reportMarkdown: `# ⚠️ IMPACT ASSESSMENT BULLETIN: ${req.body?.scenario?.name || 'Tropical Cyclone'}\n\nAnticipatory modeling indicates critical storm surge threat with Total Water Level approaching ${req.body?.surgeMetrics?.totalWaterLevelMeters || 4.2}m.\n\n### Urgent Operational Directives:\n- Execute emergency evacuation of vulnerable coastal strips.\n- Pre-emptively de-energize inundated electrical substations.\n- Move medical cold-chain supplies above ground-floor water ingress level.`,
        generatedAt: new Date().toISOString(),
        modelUsed: 'emergency-fallback',
      },
    });
  }
});

// Serve frontend with Vite middlewares in development or static in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`BayShield AI Cyclone Forecaster listening on port ${PORT}`);
});
