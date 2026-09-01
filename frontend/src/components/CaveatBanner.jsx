import React, { useState } from 'react';
import { ShieldAlert, Info, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export default function CaveatBanner({ onOpenTransparencyModal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-auto">
      <div className="glass-panel border border-amber-500/30 rounded-2xl p-2.5 sm:px-4 sm:py-2 text-amber-200 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(245,158,11,0.15)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3">
          {/* Ticker Lead */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-5 h-5 rounded-full bg-amber-400/20 radar-ring" />
              <div className="p-1 bg-amber-500/20 border border-amber-400/40 rounded-lg text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
              <span className="text-xs font-bold text-amber-300 tracking-wide uppercase">
                Early-Stage Risk Indicator
              </span>
              <span className="hidden sm:inline text-slate-500 text-xs">•</span>
              <span className="text-[11px] text-amber-200/80 font-mono">
                499 Events across 28 Hubs (Option B: 92% Sensitivity)
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenTransparencyModal}
              className="text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Validation Matrix</span>
            </button>

            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-amber-400 hover:text-white rounded-lg hover:bg-amber-500/20 transition cursor-pointer"
              title={expanded ? "Collapse Details" : "Expand Full Notice"}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Deep Disclaimer */}
        {expanded && (
          <div className="mt-2.5 pt-2.5 border-t border-amber-500/20 text-xs text-amber-100/90 leading-relaxed space-y-1.5 animate-in fade-in duration-200">
            <p>
              This model operates on <strong>500m spatial grids</strong> trained on confirmed Lagos news and disaster rescue data. Precision and recall on unseen terrain are moderate (~50%). Roughly half of flagged alerts may represent heightened vulnerability rather than guaranteed inundation.
            </p>
            <p className="text-amber-300 font-medium">
              Option B safety tiers intentionally minimize dangerous false negatives by maintaining up to 92% flood detection sensitivity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

