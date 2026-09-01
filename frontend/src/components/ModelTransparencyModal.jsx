import React, { useEffect } from 'react';
import { X, Cpu, Layers, BarChart3 } from 'lucide-react';

export default function ModelTransparencyModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-950 border border-cyan-700 rounded-xl text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold text-white tracking-tight">
                Model Validation & Hydro-Tactical Methodology
              </h2>
              <p className="text-xs text-slate-400 font-mono">5-FOLD SPATIAL CROSS-VALIDATION & SHAP ATTRIBUTION</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 text-sm text-slate-300">
          {/* Key Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Spatial Leakage Guard</div>
              <div className="text-base font-extrabold text-cyan-400 mt-1 font-mono">GroupKFold (5-Fold)</div>
              <p className="text-[11px] text-slate-400 mt-1">Entire 500m grid cells isolated during training to test true spatial generalization.</p>
            </div>
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ground Truth Footprint</div>
              <div className="text-base font-extrabold text-amber-400 mt-1 font-mono">499 Daily Flood Labels</div>
              <p className="text-[11px] text-slate-400 mt-1">Anchored across 28 distinct confirmed hubs from LASEMA logs & geocoded news archives.</p>
            </div>
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Default Operational Intent</div>
              <div className="text-base font-extrabold text-emerald-400 mt-1 font-mono">Option B (Safety Standard)</div>
              <p className="text-[11px] text-slate-400 mt-1">Targeting 78% – 92% flood sensitivity to prioritize civilian protection.</p>
            </div>
          </div>

          {/* Measured Threshold Matrix Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Measured 5-Fold Spatial CV Threshold Matrix
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-800/90 bg-slate-950/80">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/90 text-slate-300 font-bold border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-3">Model</th>
                    <th className="p-3">Threshold</th>
                    <th className="p-3">Precision</th>
                    <th className="p-3">Recall (Sensitivity)</th>
                    <th className="p-3">Caught Floods</th>
                    <th className="p-3">Missed Floods</th>
                    <th className="p-3">False Alarms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                  <tr className="bg-emerald-950/20 text-emerald-300">
                    <td className="p-3 font-sans font-bold">Random Forest (Option B)</td>
                    <td className="p-3 font-bold text-white">0.20 (Moderate)</td>
                    <td className="p-3">20.02%</td>
                    <td className="p-3 font-bold text-emerald-400">91.78%</td>
                    <td className="p-3">458 / 499</td>
                    <td className="p-3 text-emerald-400 font-bold">41</td>
                    <td className="p-3">1,830</td>
                  </tr>
                  <tr className="bg-amber-950/20 text-amber-300">
                    <td className="p-3 font-sans font-bold">Random Forest (Option B)</td>
                    <td className="p-3 font-bold text-white">0.35 (Severe)</td>
                    <td className="p-3">21.47%</td>
                    <td className="p-3 font-bold text-amber-400">77.96%</td>
                    <td className="p-3">389 / 499</td>
                    <td className="p-3">110</td>
                    <td className="p-3">1,423</td>
                  </tr>
                  <tr className="bg-slate-900/40">
                    <td className="p-3 font-sans font-medium">XGBoost (Option A)</td>
                    <td className="p-3">0.35 (Severe)</td>
                    <td className="p-3 font-bold text-cyan-400">51.47%</td>
                    <td className="p-3">52.51%</td>
                    <td className="p-3">262 / 499</td>
                    <td className="p-3">237</td>
                    <td className="p-3 text-cyan-400 font-bold">247</td>
                  </tr>
                  <tr className="bg-slate-900/40">
                    <td className="p-3 font-sans font-medium">XGBoost (Option A)</td>
                    <td className="p-3">0.50 (Default)</td>
                    <td className="p-3 font-bold text-cyan-400">66.67%</td>
                    <td className="p-3">48.90%</td>
                    <td className="p-3">244 / 499</td>
                    <td className="p-3">255</td>
                    <td className="p-3 text-cyan-400 font-bold">122</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SHAP Feature Contribution */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              SHAP Feature Attribution Weights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex justify-between items-center">
                <span>1. Terrain Slope (slope_deg)</span>
                <span className="text-cyan-400 font-bold">30.99%</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex justify-between items-center">
                <span>2. Elevation DEM (elevation_m)</span>
                <span className="text-cyan-400 font-bold">24.40%</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex justify-between items-center">
                <span>3. Built-up Impervious Surface (impervious_pct)</span>
                <span className="text-cyan-400 font-bold">20.25%</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex justify-between items-center">
                <span>4. Rainy Season Period (is_rainy_season)</span>
                <span className="text-cyan-400 font-bold">8.94%</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex justify-between items-center">
                <span className="text-amber-300 font-sans">5. Drainage Blockage Risk</span>
                <span className="text-amber-400 font-bold">5.66%</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex justify-between items-center">
                <span>6. 7-Day Cumulative Rainfall</span>
                <span className="text-cyan-400 font-bold">3.66%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-2xl text-xs transition cursor-pointer"
          >
            Dismiss Directive
          </button>
        </div>
      </div>
    </div>
  );
}

