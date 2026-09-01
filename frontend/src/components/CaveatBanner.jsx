import React, { useState } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';

export default function CaveatBanner({ onOpenTransparencyModal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-amber-950/70 border-b border-amber-600/30 text-amber-200 px-4 py-2.5 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-bold text-amber-300 uppercase tracking-wide text-[11px]">
                Early-Stage Risk Indicator Notice:
              </span>
              <span>
                Trained on <strong>499 known flood events across 28 confirmed locations in Lagos</strong> — not a certified meteorological forecast.
              </span>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-amber-400 hover:text-amber-100 underline font-medium cursor-pointer inline-flex items-center gap-0.5 ml-1"
              >
                {expanded ? 'Show less' : 'Read full disclaimer'}
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            {expanded && (
              <p className="mt-2 text-amber-200/90 leading-relaxed border-t border-amber-500/20 pt-2 text-[11px]">
                Precision and recall on unseen terrain are moderate (~50%), meaning roughly half of flagged alerts may be false alarms, and some real flood risk may be missed. 
                <strong className="text-amber-100 block sm:inline sm:ml-1">
                  Option B safety tiers intentionally prioritize catching real floods (up to 92% sensitivity) over avoiding false alarms in emergency situations.
                </strong>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onOpenTransparencyModal}
          className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-100 border border-amber-500/40 px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer self-end md:self-center"
        >
          <Info className="w-3 h-3" />
          <span>Validation Matrix</span>
        </button>
      </div>
    </div>
  );
}


