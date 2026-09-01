import React, { useState } from 'react';
import { AlertTriangle, Info, ChevronRight, X, ShieldAlert } from 'lucide-react';

export default function CaveatBanner({ onOpenTransparencyModal }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-amber-950/80 border-b border-amber-600/40 text-amber-200 px-4 py-3 shadow-lg backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-400 mt-0.5 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 text-sm uppercase tracking-wider">
                Early-Stage Risk Indicator & Safety Disclaimer
              </span>
              <span className="bg-amber-500/30 text-amber-200 text-xs px-2 py-0.5 rounded-full border border-amber-500/40 font-mono">
                Option B: High-Recall Safety Tiers
              </span>
            </div>
            {!collapsed && (
              <p className="text-xs md:text-sm text-amber-200/90 mt-1 leading-relaxed max-w-4xl">
                Trained on <strong className="text-amber-100">499 known flood events across 28 confirmed locations in Lagos</strong> — an early-stage indicator, not a certified forecast. Precision and recall are moderate (~50%), meaning roughly half of flagged alerts may be false alarms, and some real flood risk may be missed. 
                <span className="text-amber-300 font-semibold block sm:inline sm:ml-1">
                  Moderate and severe alerts explicitly prioritize catching real floods (up to 92% sensitivity) over avoiding false alarms.
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={onOpenTransparencyModal}
            className="flex items-center gap-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-100 px-3 py-1.5 rounded-lg border border-amber-500/40 font-medium transition cursor-pointer"
          >
            <Info className="w-4 h-4" />
            <span>Validation & SHAP Metrics</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-amber-400 hover:text-amber-200 p-1 hover:bg-amber-500/10 rounded transition text-xs"
            title={collapsed ? "Expand full disclaimer" : "Collapse banner"}
          >
            {collapsed ? "Expand" : "Minimize"}
          </button>
        </div>
      </div>
    </div>
  );
}
