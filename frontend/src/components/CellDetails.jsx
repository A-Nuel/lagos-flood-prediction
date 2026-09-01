import React from 'react';
import { Target, MapPin, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function CellDetails({ selectedCell, modelChoice }) {
  if (!selectedCell) {
    return (
      <div className="bg-[#0F172A]/95 backdrop-blur border border-[#1E293B] rounded shadow-2xl p-4 text-[#94A3B8] text-xs font-mono">
        <div className="flex items-center gap-2 text-white mb-1">
          <Target className="w-4 h-4 text-[#3B82F6]" />
          <span className="font-semibold uppercase text-xs">Spatial Node Inspector</span>
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-1">Select any grid coordinate or sector from the telemetry panel.</p>
      </div>
    );
  }

  const { grid_id, lat, lon, p, tier, elev, blockage, impervious_pct, slope_deg } = selectedCell;
  const probPercent = Math.round((p || 0) * 100);
  const isOptionB = modelChoice === 'random_forest';

  const getTierAction = (t) => {
    switch (t) {
      case 'severe':
        return {
          colorClass: 'text-[#EF4444]',
          borderClass: 'border-[#EF4444]',
          action: isOptionB
            ? 'Evacuate Lowlands immediately. Disperse assets to Zone B.'
            : 'Critical Inundation Alert (>50% Precision). Immediate drainage bypass required.'
        };
      case 'moderate':
        return {
          colorClass: 'text-[#F59E0B]',
          borderClass: 'border-[#F59E0B]',
          action: isOptionB
            ? 'Precautionary Alert (92% Sensitivity). Clear storm gutters and monitor runoff.'
            : 'Localized ponding expected. Inspect street drainage.'
        };
      default:
        return {
          colorClass: 'text-[#10B981]',
          borderClass: 'border-[#10B981]',
          action: 'Nominal baseline hydrological conditions. Standard vigilance.'
        };
    }
  };

  const actionInfo = getTierAction(tier);

  return (
    <div className="bg-[#0F172A]/95 backdrop-blur border border-[#1E293B] rounded shadow-2xl w-full max-w-[480px] overflow-hidden text-slate-100">
      {/* Header */}
      <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#1E293B]">
        <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-[#3B82F6]" />
          <span>Spatial Node Inspector</span>
        </h4>
        <span className="text-[10px] text-[#94A3B8] font-mono bg-[#0B0F19] px-2 py-0.5 rounded border border-[#1E293B]">
          ID: {grid_id || 'LG-772'}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col sm:flex-row gap-4">
        {/* Elevation Matrix */}
        <div className="flex-1 bg-[#0B0F19] border border-[#1E293B] rounded p-3 text-xs">
          <div className="text-[9px] text-[#94A3B8] uppercase tracking-widest mb-2 font-semibold font-mono">
            Elevation Matrix
          </div>
          <div className="flex justify-between items-end border-b border-[#1E293B] pb-1 mb-2">
            <span className="text-[#94A3B8]">Base Elevation</span>
            <span className="font-mono text-sm text-white">
              {elev !== undefined ? elev : '2.1'} <span className="text-[10px] text-[#94A3B8]">m</span>
            </span>
          </div>
          <div className="flex justify-between items-end border-b border-[#1E293B] pb-1 mb-2">
            <span className="text-[#94A3B8]">Slope Grdt.</span>
            <span className="font-mono text-sm text-white">
              {slope_deg !== undefined ? slope_deg : '1.4'} <span className="text-[10px] text-[#94A3B8]">%</span>
            </span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-[#94A3B8]">Impervious</span>
            <span className="font-mono text-sm text-amber-400">
              {impervious_pct !== undefined ? impervious_pct : '45'} <span className="text-[10px] text-[#94A3B8]">%</span>
            </span>
          </div>
        </div>

        {/* Calculated Risk & Immediate Action */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="text-[9px] text-[#94A3B8] uppercase tracking-widest mb-1 font-semibold font-mono">
              Calculated Risk
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-mono font-light ${actionInfo.colorClass}`}>{probPercent}</span>
              <span className={`text-sm font-mono ${actionInfo.colorClass}`}>%</span>
            </div>
            <div className="text-[10px] font-mono text-[#94A3B8] mt-1">
              GPS: {lat?.toFixed(4)}° N, {lon?.toFixed(4)}° E
            </div>
          </div>

          <div className={`mt-3 bg-[#0B0F19] border-l-2 ${actionInfo.borderClass} p-2 rounded-r border-y border-r border-[#1E293B]`}>
            <div className={`text-[9px] font-semibold uppercase ${actionInfo.colorClass} tracking-wider mb-0.5 font-mono`}>
              Immediate Action
            </div>
            <div className="text-[11px] text-[#94A3B8] leading-tight">
              {actionInfo.action}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


