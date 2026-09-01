import React, { useState } from 'react';
import { MapPin, Mountain, ArrowDownRight, Building2, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles, ChevronRight, ChevronLeft, Droplet } from 'lucide-react';

export default function CellDetails({ selectedCell, modelChoice }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!selectedCell) {
    return (
      <div className="fixed top-20 right-4 sm:right-6 z-40 w-80 pointer-events-auto">
        <div className="glass-panel border border-slate-700/60 rounded-3xl p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] text-center text-slate-400 backdrop-blur-2xl">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400 w-fit mx-auto mb-2.5">
            <MapPin className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">Select a Spatial Node</h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Click any grid node on the Lagos map or choose a landmark to stream live elevation, blockage severity, and safety alerts.
          </p>
        </div>
      </div>
    );
  }

  const { grid_id, lat, lon, p, tier, elev, blockage, impervious_pct, slope_deg } = selectedCell;
  const probPercent = Math.round((p || 0) * 100);

  const getTierBadge = (t) => {
    switch (t) {
      case 'severe':
        return {
          label: 'Severe Warning',
          sub: 'Critical Danger',
          bg: 'bg-red-500/20 border-red-500/40 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.25)]',
          icon: ShieldAlert,
          color: '#EF4444',
          action: 'Evacuate low ground, secure assets, clear storm outfalls.'
        };
      case 'moderate':
        return {
          label: 'Moderate Advisory',
          sub: '92% Recall Target',
          bg: 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]',
          icon: AlertTriangle,
          color: '#F59E0B',
          action: 'Inspect street gutters, elevate vulnerable items, monitor downpour.'
        };
      default:
        return {
          label: 'Low Risk',
          sub: 'Normal Baseline',
          bg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
          icon: ShieldCheck,
          color: '#10B981',
          action: 'Baseline conditions. Standard monsoon vigilance.'
        };
    }
  };

  const badge = getTierBadge(tier);
  const IconComponent = badge.icon;

  if (collapsed) {
    return (
      <div className="fixed top-20 right-4 z-40 pointer-events-auto">
        <button
          onClick={() => setCollapsed(false)}
          className="glass-panel border border-cyan-500/40 p-3 rounded-2xl text-cyan-400 hover:text-white shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center gap-2 cursor-pointer transition hover:scale-105 backdrop-blur-2xl"
          title="Expand Telemetry HUD"
        >
          <ChevronLeft className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Node Telemetry</span>
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: badge.color }} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-40 w-80 max-h-[calc(100vh-120px)] overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="glass-panel border border-slate-700/60 rounded-3xl p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-2xl text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-mono font-bold tracking-tight">
              <MapPin className="w-3.5 h-3.5" />
              <span>{grid_id || 'LAGOS-NODE'}</span>
            </div>
            <h3 className="text-xs font-bold text-slate-300 font-mono mt-0.5">
              {lat?.toFixed(4)}°N, {lon?.toFixed(4)}°E
            </h3>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Minimize inspector"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tactical Risk Dial Card */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl opacity-15 pointer-events-none"
            style={{ backgroundColor: badge.color }}
          />

          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Flood Probability
              </div>
              <div className="text-3xl font-extrabold font-mono tracking-tight text-white mt-0.5 flex items-baseline gap-1">
                <span>{probPercent}%</span>
                <span className="text-xs font-normal text-slate-400">P(Risk)</span>
              </div>
            </div>

            <div className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${badge.bg}`}>
              <IconComponent className="w-3.5 h-3.5" />
              <span>{badge.label}</span>
            </div>
          </div>

          {/* Glowing Track Bar */}
          <div className="w-full bg-slate-900 rounded-full h-2 mt-3 overflow-hidden border border-slate-800">
            <div
              className="h-full rounded-full transition-all duration-500 shadow-sm"
              style={{
                width: `${Math.max(6, probPercent)}%`,
                backgroundColor: badge.color,
                boxShadow: `0 0 10px ${badge.color}`
              }}
            />
          </div>

          <div className="text-[11px] text-slate-300 mt-3 pt-2.5 border-t border-slate-900 leading-snug">
            <strong className="text-white">Safety Directive:</strong> {badge.action}
          </div>
        </div>

        {/* Environmental Parameters Grid */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Terrain & Obstruction Matrix
          </label>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            <div className="p-2.5 bg-slate-950/60 rounded-2xl border border-slate-800/70">
              <div className="text-slate-400 flex items-center gap-1 text-[10px] font-sans">
                <Mountain className="w-3 h-3 text-cyan-400" />
                <span>Elevation</span>
              </div>
              <div className="text-sm font-extrabold text-white mt-0.5">{elev !== undefined ? `${elev}m` : '—'}</div>
            </div>

            <div className="p-2.5 bg-slate-950/60 rounded-2xl border border-slate-800/70">
              <div className="text-slate-400 flex items-center gap-1 text-[10px] font-sans">
                <ArrowDownRight className="w-3 h-3 text-cyan-400" />
                <span>Slope</span>
              </div>
              <div className="text-sm font-extrabold text-white mt-0.5">{slope_deg !== undefined ? `${slope_deg}°` : '—'}</div>
            </div>

            <div className="p-2.5 bg-slate-950/60 rounded-2xl border border-slate-800/70">
              <div className="text-slate-400 flex items-center gap-1 text-[10px] font-sans">
                <Building2 className="w-3 h-3 text-amber-400" />
                <span>Impervious</span>
              </div>
              <div className="text-sm font-extrabold text-white mt-0.5">{impervious_pct !== undefined ? `${impervious_pct}%` : '—'}</div>
            </div>

            <div className="p-2.5 bg-slate-950/60 rounded-2xl border border-slate-800/70">
              <div className="text-slate-400 flex items-center gap-1 text-[10px] font-sans">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span>Blockage</span>
              </div>
              <div className="text-sm font-extrabold text-amber-400 mt-0.5">{blockage !== undefined ? `${blockage}` : '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

