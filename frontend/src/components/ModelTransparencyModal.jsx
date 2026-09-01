import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0F172A] border border-[#1E293B] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#1E293B] bg-[#0B0F19] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg text-[#3B82F6]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight font-mono">
                Model Validation Matrix & SHAP Attribution
              </h2>
              <p className="text-[11px] text-[#94A3B8] font-mono">5-FOLD SPATIAL CROSS-VALIDATION ON UNSEEN TERRAIN</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#1E293B] rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 text-sm text-slate-300">
          {/* Key Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-[#0B0F19] border border-[#1E293B] rounded-lg">
              <div className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider font-mono">Spatial Leakage Guard</div>
              <div className="text-sm font-bold text-[#3B82F6] mt-1 font-mono">GroupKFold (5-Fold)</div>
              <p className="text-[11px] text-[#94A3B8] mt-1">Entire 500m grid cells isolated during training to test true spatial generalization.</p>
            </div>
            <div className="p-3.5 bg-[#0B0F19] border border-[#1E293B] rounded-lg">
              <div className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider font-mono">Ground Truth Dataset</div>
              <div className="text-sm font-bold text-[#F59E0B] mt-1 font-mono">499 Daily Flood Labels</div>
              <p className="text-[11px] text-[#94A3B8] mt-1">Anchored across 28 distinct confirmed hubs from LASEMA logs & news archives.</p>
            </div>
            <div className="p-3.5 bg-[#0B0F19] border border-[#1E293B] rounded-lg">
              <div className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider font-mono">Default Standard</div>
              <div className="text-sm font-bold text-[#10B981] mt-1 font-mono">Option B (Safety Focus)</div>
              <p className="text-[11px] text-[#94A3B8] mt-1">Targeting 78% – 92% flood sensitivity to prioritize civilian protection.</p>
            </div>
          </div>

          {/* Measured Threshold Matrix Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
              <Layers className="w-4 h-4 text-[#3B82F6]" />
              Measured 5-Fold Spatial CV Threshold Performance
            </h3>
            <div className="overflow-x-auto rounded-lg border border-[#1E293B] bg-[#0B0F19]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#1E293B]/70 text-[#94A3B8] font-bold border-b border-[#1E293B] text-[11px]">
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
                <tbody className="divide-y divide-[#1E293B] text-slate-300 text-[11px]">
                  <tr className="bg-[#10B981]/5 text-[#10B981]">
                    <td className="p-3 font-bold text-white">Random Forest (Option B)</td>
                    <td className="p-3 font-bold text-white">0.20 (Moderate)</td>
                    <td className="p-3">20.02%</td>
                    <td className="p-3 font-bold text-[#10B981]">91.78%</td>
                    <td className="p-3 font-bold text-white">458 / 499</td>
                    <td className="p-3 text-[#10B981] font-bold">41</td>
                    <td className="p-3">1,830</td>
                  </tr>
                  <tr className="bg-[#F59E0B]/5 text-[#F59E0B]">
                    <td className="p-3 font-bold text-white">Random Forest (Option B)</td>
                    <td className="p-3 font-bold text-white">0.35 (Severe)</td>
                    <td className="p-3">21.47%</td>
                    <td className="p-3 font-bold text-[#F59E0B]">77.96%</td>
                    <td className="p-3 font-bold text-white">389 / 499</td>
                    <td className="p-3">110</td>
                    <td className="p-3">1,423</td>
                  </tr>
                  <tr className="hover:bg-[#1E293B]/30">
                    <td className="p-3 font-medium text-slate-300">XGBoost (Option A)</td>
                    <td className="p-3 text-slate-300">0.35 (Severe)</td>
                    <td className="p-3 font-bold text-[#3B82F6]">51.47%</td>
                    <td className="p-3">52.51%</td>
                    <td className="p-3">262 / 499</td>
                    <td className="p-3">237</td>
                    <td className="p-3 text-[#3B82F6] font-bold">247</td>
                  </tr>
                  <tr className="hover:bg-[#1E293B]/30">
                    <td className="p-3 font-medium text-slate-300">XGBoost (Option A)</td>
                    <td className="p-3 text-slate-300">0.50 (Default)</td>
                    <td className="p-3 font-bold text-[#3B82F6]">66.67%</td>
                    <td className="p-3">48.90%</td>
                    <td className="p-3">244 / 499</td>
                    <td className="p-3">255</td>
                    <td className="p-3 text-[#3B82F6] font-bold">122</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SHAP Feature Contribution */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
              <BarChart3 className="w-4 h-4 text-[#10B981]" />
              SHAP Feature Attribution Weights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-[#0B0F19] rounded-lg border border-[#1E293B] flex justify-between items-center">
                <span>1. Terrain Slope (slope_deg)</span>
                <span className="text-[#3B82F6] font-bold">30.99%</span>
              </div>
              <div className="p-2.5 bg-[#0B0F19] rounded-lg border border-[#1E293B] flex justify-between items-center">
                <span>2. Elevation DEM (elevation_m)</span>
                <span className="text-[#3B82F6] font-bold">24.40%</span>
              </div>
              <div className="p-2.5 bg-[#0B0F19] rounded-lg border border-[#1E293B] flex justify-between items-center">
                <span>3. Built-up Impervious Surface (impervious_pct)</span>
                <span className="text-[#3B82F6] font-bold">20.25%</span>
              </div>
              <div className="p-2.5 bg-[#0B0F19] rounded-lg border border-[#1E293B] flex justify-between items-center">
                <span>4. Rainy Season Period (is_rainy_season)</span>
                <span className="text-[#3B82F6] font-bold">8.94%</span>
              </div>
              <div className="p-2.5 bg-[#0B0F19] rounded-lg border border-[#1E293B] flex justify-between items-center">
                <span className="text-[#F59E0B]">5. Drainage Blockage Risk</span>
                <span className="text-[#F59E0B] font-bold">5.66%</span>
              </div>
              <div className="p-2.5 bg-[#0B0F19] rounded-lg border border-[#1E293B] flex justify-between items-center">
                <span>6. 7-Day Cumulative Rainfall</span>
                <span className="text-[#3B82F6] font-bold">3.66%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1E293B] bg-[#0B0F19] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold rounded-lg text-xs uppercase tracking-wider transition cursor-pointer"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


