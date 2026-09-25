import React from 'react';
import { GEESatelliteFeed } from '../types/cyclone';
import { Satellite, Eye, Radio, Thermometer, CloudRain, ShieldCheck, Activity } from 'lucide-react';

interface GEEFeedsPanelProps {
  satelliteFeeds: GEESatelliteFeed[];
  onToggleFeed: (id: string) => void;
  mangroveOverride: boolean;
  onToggleMangrove: () => void;
}

export const GEEFeedsPanel: React.FC<GEEFeedsPanelProps> = ({
  satelliteFeeds,
  onToggleFeed,
  mangroveOverride,
  onToggleMangrove,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-3 text-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-slate-100">
            Google Earth Engine (GEE) & Met Feeds
          </h3>
        </div>
        <span className="text-[11px] text-cyan-400 font-mono flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
          Multi-Sensor Fusion
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Autonomous ingestion from Copernicus Sentinel SAR, ISRO INSAT-3DR, and NASA GPM feeds calibrated for shallow Bay of Bengal bathymetry.
      </p>

      {/* Satellite Feeds List */}
      <div className="space-y-2">
        {satelliteFeeds.map((feed) => {
          let IconComp = Satellite;
          if (feed.id === 'sar_flood') IconComp = Radio;
          if (feed.id === 'sentinel2_mangroves') IconComp = ShieldCheck;
          if (feed.id === 'insat_thermal') IconComp = Eye;
          if (feed.id === 'sst_anomaly') IconComp = Thermometer;
          if (feed.id === 'gpm_rain') IconComp = CloudRain;

          return (
            <div
              key={feed.id}
              className={`p-2.5 rounded-lg border transition-all ${
                feed.active
                  ? 'bg-slate-950/80 border-cyan-500/40 shadow-sm'
                  : 'bg-slate-950/30 border-slate-800/80 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <div
                    className={`p-1.5 rounded mt-0.5 ${
                      feed.active ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-200">{feed.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {feed.satellitePlatform} · {feed.resolution}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onToggleFeed(feed.id)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                    feed.active
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {feed.active ? 'Active' : 'Enable'}
                </button>
              </div>

              {/* Feed Telemetry Metric */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">{feed.liveMetric}</span>
                <span className="text-[10px] text-slate-500">{feed.lastPassTimestamp}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nature-based Solution: Sundarbans Mangrove Buffer Toggle */}
      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between">
        <div>
          <div className="font-semibold text-xs text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Sundarbans Bioshield Attenuation (-0.85m)
          </div>
          <div className="text-[11px] text-emerald-400/80">
            {mangroveOverride
              ? 'Dense mangrove buffer active; dampens surge energy'
              : 'Degraded mangrove buffer; zero wave energy dissipation'}
          </div>
        </div>

        <button
          onClick={onToggleMangrove}
          className={`text-xs px-2.5 py-1 rounded font-medium transition ${
            mangroveOverride
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {mangroveOverride ? 'Buffering' : 'Bypass'}
        </button>
      </div>
    </div>
  );
};
