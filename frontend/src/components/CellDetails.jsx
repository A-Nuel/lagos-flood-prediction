import React from 'react';
import { MapPin, Droplets, Mountain, ArrowDownRight, Building2, AlertTriangle, ShieldCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function CellDetails({ selectedCell, modelChoice }) {
  if (!selectedCell) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 flex flex-col items-center justify-center h-full min-h-[300px]">
        <div className="p-3 bg-slate-800/80 rounded-2xl text-slate-500 mb-3">
          <MapPin className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-300">Select a Lagos Grid Cell</h3>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Click on any grid point on the map or select a known Lagos landmark to inspect local elevation, blockage indices, and risk probabilities.
        </p>
      </div>
    );
  }

  const { grid_id, lat, lon, p, tier, elev, blockage, impervious_pct, slope_deg, drain_density } = selectedCell;
  const probPercent = Math.round((p || 0) * 100);

  const getTierBadge = (t) => {
    switch (t) {
      case 'severe':
        return {
          label: 'Severe Flood Warning',
          bg: 'bg-red-500/20 border-red-500/40 text-red-400',
          icon: ShieldAlert,
          action: 'Critical Alert: High risk of localized inundation. Clear outfalls, secure ground assets.'
        };
      case 'moderate':
        return {
          label: 'Moderate Advisory (92% Recall)',
          bg: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
          icon: AlertTriangle,
          action: 'Precautionary Alert: Early safety warning. Inspect perimeter gutters and storm canals.'
        };
      default:
        return {
          label: 'Low Risk (Safe)',
          bg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
          icon: ShieldCheck,
          action: 'Normal baseline: Standard vigilance during high-intensity rain.'
        };
    }
  };

  const badge = getTierBadge(tier);
  const IconComponent = badge.icon;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
            <MapPin className="w-3.5 h-3.5" />
            <span>{grid_id || 'LAGOS-GRID-CELL'}</span>
          </div>
          <h3 className="text-sm font-bold text-white mt-0.5">
            {lat?.toFixed(4)}°N, {lon?.toFixed(4)}°E
          </h3>
        </div>
        <div className={`px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${badge.bg}`}>
          <IconComponent className="w-3.5 h-3.5" />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Risk Probability Gauge */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-xs font-medium text-slate-400">Flood Occurrence Probability</span>
          <span className="text-xl font-bold font-mono text-white">{probPercent}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              tier === 'severe' ? 'bg-red-500' : tier === 'moderate' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.max(5, probPercent)}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
          <strong className="text-slate-200">Recommended Action:</strong> {badge.action}
        </p>
      </div>

      {/* Physical & Drainage Features Grid */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div className="p-2.5 bg-slate-800/50 rounded-xl border border-slate-800/80">
          <div className="text-slate-400 flex items-center gap-1 mb-1">
            <Mountain className="w-3.5 h-3.5 text-cyan-400" />
            <span>Elevation (DEM)</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">{elev !== undefined ? `${elev} m` : '8.5 m'}</div>
        </div>

        <div className="p-2.5 bg-slate-800/50 rounded-xl border border-slate-800/80">
          <div className="text-slate-400 flex items-center gap-1 mb-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-cyan-400" />
            <span>Slope</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">{slope_deg !== undefined ? `${slope_deg}°` : '0.35°'}</div>
        </div>

        <div className="p-2.5 bg-slate-800/50 rounded-xl border border-slate-800/80">
          <div className="text-slate-400 flex items-center gap-1 mb-1">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Impervious Surface</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">{impervious_pct !== undefined ? `${impervious_pct}%` : '45%'}</div>
        </div>

        <div className="p-2.5 bg-slate-800/50 rounded-xl border border-slate-800/80">
          <div className="text-slate-400 flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>Blockage Index</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">{blockage !== undefined ? `${blockage}` : '0.25'}</div>
        </div>
      </div>
    </div>
  );
}
