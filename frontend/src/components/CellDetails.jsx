import React from 'react';
import { MapPin, Mountain, ArrowDownRight, Building2, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function CellDetails({ selectedCell, modelChoice }) {
  if (!selectedCell) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-slate-400">
        <MapPin className="w-6 h-6 mx-auto mb-2 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-200">No Grid Cell Selected</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Click any point on the Lagos map or select a landmark to inspect local elevation, slope, imperviousness, and simulated risk.
        </p>
      </div>
    );
  }

  const { grid_id, lat, lon, p, tier, elev, blockage, impervious_pct, slope_deg } = selectedCell;
  const probPercent = Math.round((p || 0) * 100);

  const getTierInfo = (t) => {
    const isOptionB = modelChoice === 'random_forest';
    switch (t) {
      case 'severe':
        return {
          label: 'Severe Flood Warning',
          badgeClass: 'bg-red-950/80 text-red-200 border-red-700 font-bold',
          barClass: 'bg-red-500',
          icon: ShieldAlert,
          action: isOptionB
            ? 'High danger of localized inundation. Clear secondary street drains, elevate sensitive ground assets.'
            : 'High-confidence flood zone (>50% Precision). Immediate drainage clearance and asset protection required.'
        };
      case 'moderate':
        return {
          label: 'Moderate Advisory',
          badgeClass: 'bg-amber-950/80 text-amber-200 border-amber-700 font-bold',
          barClass: 'bg-amber-500',
          icon: AlertTriangle,
          action: isOptionB
            ? 'Safety Warning (92% Sensitivity): Precautionary alert. Inspect neighborhood gutters and monitor downpour.'
            : 'Precautionary Advisory (63% Recall): Localized street ponding possible in low-elevation pockets.'
        };
      default:
        return {
          label: 'Low Risk',
          badgeClass: 'bg-emerald-950/80 text-emerald-200 border-emerald-700 font-bold',
          barClass: 'bg-emerald-500',
          icon: ShieldCheck,
          action: 'Baseline hydrological conditions. Standard monsoon vigilance.'
        };
    }
  };


  const info = getTierInfo(tier);
  const Icon = info.icon;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-cyan-400 font-bold">
            <MapPin className="w-3.5 h-3.5" />
            <span>{grid_id || 'LAGOS-NODE'}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {lat?.toFixed(4)}°N, {lon?.toFixed(4)}°E
          </div>
        </div>

        <div className={`px-2.5 py-1 rounded-md border font-semibold flex items-center gap-1.5 ${info.badgeClass}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{info.label}</span>
        </div>
      </div>

      {/* Probability Gauge */}
      <div className="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800/80">
        <div className="flex justify-between items-center text-slate-300 font-medium">
          <span>Simulated Flood Risk Probability</span>
          <span className="text-base font-bold font-mono text-white">{probPercent}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${info.barClass}`}
            style={{ width: `${Math.max(4, probPercent)}%` }}
          />
        </div>
        <div className="text-[11px] text-slate-400 pt-1">
          <strong className="text-slate-200">Recommended Directive:</strong> {info.action}
        </div>
      </div>

      {/* Feature Attributes Table */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
          <div className="text-slate-400 flex items-center gap-1 text-[11px]">
            <Mountain className="w-3 h-3 text-cyan-400" />
            <span>DEM Elevation</span>
          </div>
          <div className="text-sm font-bold text-white font-mono mt-0.5">
            {elev !== undefined ? `${elev} m` : '—'}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
          <div className="text-slate-400 flex items-center gap-1 text-[11px]">
            <ArrowDownRight className="w-3 h-3 text-cyan-400" />
            <span>Terrain Slope</span>
          </div>
          <div className="text-sm font-bold text-white font-mono mt-0.5">
            {slope_deg !== undefined ? `${slope_deg}°` : '—'}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
          <div className="text-slate-400 flex items-center gap-1 text-[11px]">
            <Building2 className="w-3 h-3 text-amber-400" />
            <span>Impervious Surface</span>
          </div>
          <div className="text-sm font-bold text-white font-mono mt-0.5">
            {impervious_pct !== undefined ? `${impervious_pct}%` : '—'}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
          <div className="text-slate-400 flex items-center gap-1 text-[11px]">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>Blockage Index</span>
          </div>
          <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
            {blockage !== undefined ? `${blockage}` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

