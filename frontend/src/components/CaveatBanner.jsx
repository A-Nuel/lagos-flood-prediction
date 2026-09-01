import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

export default function CaveatBanner({ onOpenTransparencyModal }) {
  return (
    <div className="fixed top-14 left-0 right-0 z-40 bg-[#F59E0B]/10 border-b border-[#F59E0B]/20 px-4 py-1.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 overflow-hidden">
        <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
        <p className="text-[#F59E0B]/90 font-mono text-[11px] sm:text-xs truncate sm:whitespace-normal">
          <strong className="text-[#F59E0B] font-semibold">MODEL NOTICE:</strong> Trained on 499 known events across 28 confirmed sectors. Option B safety tiers prioritize catching real floods (up to 92% sensitivity) over avoiding false positives.
        </p>
      </div>

      <button
        onClick={onOpenTransparencyModal}
        className="hidden md:flex items-center gap-1 text-[11px] font-mono text-[#F59E0B] hover:text-white uppercase shrink-0 transition cursor-pointer underline decoration-[#F59E0B]/50"
      >
        <span>Methodology Details</span>
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
}



