import React from 'react';
import { X, CheckCircle2, AlertOctagon, HelpCircle, BarChart3, Layers, ShieldCheck } from 'lucide-react';

export default function ModelTransparencyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Model Validation & Methodology Transparency</h2>
              <p className="text-xs text-slate-400">Strict 5-Fold Spatial Cross-Validation & SHAP Feature Attribution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm text-slate-300">
          {/* Key Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
              <div className="text-xs text-slate-400 uppercase font-semibold">Validation Strategy</div>
              <div className="text-lg font-bold text-cyan-400 mt-1">GroupKFold (5-Fold)</div>
              <p className="text-xs text-slate-400 mt-1">Entire 500m grid cells held out. Strict 0 spatial leakage between train & test.</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
              <div className="text-xs text-slate-400 uppercase font-semibold">Training Labels</div>
              <div className="text-lg font-bold text-amber-400 mt-1">499 Daily Events</div>
              <p className="text-xs text-slate-400 mt-1">Sourced from LASEMA distress logs & verified Lagos news archives across 28 hubs.</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
              <div className="text-xs text-slate-400 uppercase font-semibold">Default Safety Tier</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">Option B (Random Forest)</div>
              <p className="text-xs text-slate-400 mt-1">Prioritizes 78% – 92% flood sensitivity over false alarm suppression.</p>
            </div>
          </div>

          {/* Measured Threshold Matrix Table */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Measured 5-Fold Spatial CV Threshold Matrix
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated on 25,449 total out-of-fold predictions across 15,057 unique Lagos grid cells.
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
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
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  <tr className="bg-emerald-950/20 text-emerald-300">
                    <td className="p-3 font-sans font-medium">Random Forest (Option B)</td>
                    <td className="p-3 font-bold">0.20 (Moderate)</td>
                    <td className="p-3">20.02%</td>
                    <td className="p-3 font-bold text-emerald-400">91.78%</td>
                    <td className="p-3">458 / 499</td>
                    <td className="p-3 text-emerald-400 font-bold">41</td>
                    <td className="p-3">1,830</td>
                  </tr>
                  <tr className="bg-amber-950/20 text-amber-300">
                    <td className="p-3 font-sans font-medium">Random Forest (Option B)</td>
                    <td className="p-3 font-bold">0.35 (Severe)</td>
                    <td className="p-3">21.47%</td>
                    <td className="p-3 font-bold text-amber-400">77.96%</td>
                    <td className="p-3">389 / 499</td>
                    <td className="p-3">110</td>
                    <td className="p-3">1,423</td>
                  </tr>
                  <tr className="bg-slate-900/60">
                    <td className="p-3 font-sans font-medium">XGBoost (Option A)</td>
                    <td className="p-3">0.35 (Severe)</td>
                    <td className="p-3 font-bold text-cyan-400">51.47%</td>
                    <td className="p-3">52.51%</td>
                    <td className="p-3">262 / 499</td>
                    <td className="p-3">237</td>
                    <td className="p-3 font-bold text-cyan-400">247</td>
                  </tr>
                  <tr className="bg-slate-900/60">
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
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              SHAP Feature Importance & Contribution Ranking
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span>1. Terrain Slope (<code className="text-cyan-300">slope_deg</code>)</span>
                <span className="font-mono text-cyan-400 font-bold">30.99%</span>
              </div>
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span>2. Elevation DEM (<code className="text-cyan-300">elevation_m</code>)</span>
                <span className="font-mono text-cyan-400 font-bold">24.40%</span>
              </div>
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span>3. Built-up Impervious Surface (<code className="text-cyan-300">impervious_pct</code>)</span>
                <span className="font-mono text-cyan-400 font-bold">20.25%</span>
              </div>
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span>4. Rainy Season Indicator (<code className="text-cyan-300">is_rainy_season</code>)</span>
                <span className="font-mono text-cyan-400 font-bold">8.94%</span>
              </div>
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span className="text-amber-300 font-medium">5. Drainage Blockage Risk (<code className="text-amber-300">composite_blockage_risk</code>)</span>
                <span className="font-mono text-amber-400 font-bold">5.66%</span>
              </div>
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span>6. 7-Day Cumulative Rainfall (<code className="text-cyan-300">rainfall_7d_sum</code>)</span>
                <span className="font-mono text-cyan-400 font-bold">3.66%</span>
              </div>
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span className="text-amber-300 font-medium">7. Drain Density (<code className="text-amber-300">drain_density</code>)</span>
                <span className="font-mono text-amber-400 font-bold">3.57%</span>
              </div>
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span className="text-amber-300 font-medium">8. Drain Coverage Gap (<code className="text-amber-300">drain_coverage_gap</code>)</span>
                <span className="font-mono text-amber-400 font-bold">1.25%</span>
              </div>
            </div>
          </div>

          {/* Documented Methodological Limitations */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
            <h4 className="font-semibold text-amber-300 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" />
              Documented Model Limitations & Hydrological Context
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400 leading-relaxed">
              <li>
                <strong className="text-slate-300">Fuzzy News Event Windows:</strong> Historical flood reports from media and disaster agencies usually represent the aftermath rather than the exact hour of cloudburst. Label windows use a ±3 day buffer, which introduces temporal noise into single-day rainfall readings.
              </li>
              <li>
                <strong className="text-slate-300">Lagged Cumulative Impact:</strong> 7-day cumulative rainfall (<code className="text-cyan-300">rainfall_7d_sum</code>) carries 12× more predictive weight than 24h rainfall because soil saturation and canal capacity deficits precede major surface flooding.
              </li>
              <li>
                <strong className="text-slate-300">Early-Stage Training Footprint:</strong> 28 distinct spatial grid cells represent the positive training anchor. Predictions outside these anchors rely on generalized physical terrain rules (low slope + high imperviousness + drain deficit).
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Close Transparency Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
