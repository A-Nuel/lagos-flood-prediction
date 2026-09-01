import React from 'react';
import { Target, MapPin, AlertTriangle, ShieldCheck, ShieldAlert, Mountain, ArrowDownRight, Building2 } from 'lucide-react';

export default function CellDetails({ selectedCell, modelChoice }) {
  if (!selectedCell) {
    return (
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3.5 text-[#94A3B8] text-xs font-mono">
        <div className="flex items-center gap-1.5 text-white mb-1">
          <Target className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span className="font-semibold uppercase text-[11px] tracking-wider">Spatial Node Inspector</span>
        </div>
        <p className="text-[11px] text-[#94A3B8]">Click any map coordinate or select a sector above to inspect terrain & flood risk.</p>
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
          label: 'Severe Warning',
          colorClass: 'text-[#EF4444]',
          bgClass: 'bg-[#EF4444]/10 border-[#EF4444]/30',
          barClass: 'bg-[#EF4444]',
          action: isOptionB
            ? 'High inundation risk. Pre-deploy pumps and clear secondary collectors.'
            : 'Critical flood zone (>50% Precision). Immediate drainage diversion required.'
        };
      case 'moderate':
        return {
          label: 'Moderate Advisory',
          colorClass: 'text-[#F59E0B]',
          bgClass: 'bg-[#F59E0B]/10 border-[#F59E0B]/30',
          barClass: 'bg-[#F59E0B]',
          action: isOptionB
            ? 'Precautionary Warning (92% Sensitivity). Inspect street drainage and monitor rainfall.'
            : 'Moderate flood risk. Localized street ponding possible in low depressions.'
        };
      default:
        return {
          label: 'Low Risk',
          colorClass: 'text-[#10B981]',
          bgClass: 'bg-[#10B981]/10 border-[#10B981]/30',
          barClass: 'bg-[#10B981]',
          action: 'Normal hydrological baseline. Standard urban drainage monitoring.'
        };
    }
  };

  const actionInfo = getTierAction(tier);

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3.5 space-y-3 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-2.5">
        <div className="flex items-center gap-1.5 font-mono">
          <Target className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span className="font-bold text-xs text-white">{grid_id || 'LAGOS-NODE'}</span>
          <span className="text-[10px] text-[#94A3B8]">
            ({lat?.toFixed(3)}°, {lon?.toFixed(3)}°)
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${actionInfo.bgClass} ${actionInfo.colorClass}`}>
          {actionInfo.label}
        </span>
      </div>

      {/* Risk Gauge Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-baseline font-mono text-xs">
          <span className="text-[#94A3B8]">Simulated Risk Probability</span>
          <span className={`font-bold text-sm ${actionInfo.colorClass}`}>{probPercent}%</span>
        </div>
        <div className="w-full bg-[#0B0F19] rounded-full h-1.5 overflow-hidden border border-[#1E293B]">
          <div
            className={`h-full transition-all duration-300 ${actionInfo.barClass}`}
            style={{ width: `${Math.max(4, Math.min(100, probPercent))}%` }}
          />
        </div>
      </div>

      {/* Elevation & Terrain Attributes Matrix */}
      <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
        <div className="bg-[#0B0F19] border border-[#1E293B] rounded p-1.5">
          <div className="text-[9px] text-[#94A3B8] uppercase">Elevation</div>
          <div className="text-xs font-bold text-white mt-0.5">
            {elev !== undefined ? `${elev}m` : '—'}
          </div>
        </div>
        <div className="bg-[#0B0F19] border border-[#1E293B] rounded p-1.5">
          <div className="text-[9px] text-[#94A3B8] uppercase">Slope</div>
          <div className="text-xs font-bold text-white mt-0.5">
            {slope_deg !== undefined ? `${slope_deg}°` : '—'}
          </div>
        </div>
        <div className="bg-[#0B0F19] border border-[#1E293B] rounded p-1.5">
          <div className="text-[9px] text-[#94A3B8] uppercase">Impervious</div>
          <div className="text-xs font-bold text-amber-400 mt-0.5">
            {impervious_pct !== undefined ? `${impervious_pct}%` : '—'}
          </div>
        </div>
      </div>

      {/* Recommended Directive */}
      <div className={`bg-[#0B0F19] border-l-2 p-2 rounded-r border-y border-r border-[#1E293B] ${actionInfo.colorClass === 'text-[#EF4444]' ? 'border-l-[#EF4444]' : actionInfo.colorClass === 'text-[#F59E0B]' ? 'border-l-[#F59E0B]' : 'border-l-[#10B981]'}`}>
        <div className={`text-[9px] font-bold uppercase tracking-wider font-mono ${actionInfo.colorClass}`}>
          Operational Directive
        </div>
        <div className="text-[11px] text-[#94A3B8] leading-tight mt-0.5">
          {actionInfo.action}
        </div>
      </div>
    </div>
  );
}



